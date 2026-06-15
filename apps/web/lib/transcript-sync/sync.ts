import "server-only";

import { db } from "@cap/database";
import { videos, videoUploads } from "@cap/database/schema";
import { serverEnv } from "@cap/env";
import { Storage } from "@cap/web-backend";
import type { Organisation, Video } from "@cap/web-domain";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { Effect, Option } from "effect";
import { runPromise } from "@/lib/server";
import { transcribeVideo } from "@/lib/transcribe";
import { decodeStorageVideo } from "@/lib/video-storage";
import {
	classifyTranscriptSyncDiscoveryRows,
	type TranscriptSyncDiscoveryRow,
} from "./planner";
import {
	ensureTranscriptSyncSchema,
	getSyncedVideoIds,
	insertTranscriptSyncRecord,
	recordTranscriptSyncError,
} from "./postgres";
import { normalizeTranscriptText, parseWebVtt } from "./vtt";

type DbVideo = typeof videos.$inferSelect;

export type TranscriptSyncMode = "sweep" | "backfill";

export type TranscriptSyncOptions = {
	mode?: TranscriptSyncMode;
	batchSize?: number;
};

export type TranscriptSyncSummary = {
	mode: TranscriptSyncMode;
	organizationId: string;
	scanned: number;
	queued: number;
	synced: number;
	skippedAlreadySynced: number;
	skippedActiveUpload: number;
	skippedUnsupportedStatus: number;
	failed: number;
	errors: Array<{ videoId: string; message: string }>;
};

const DEFAULT_SWEEP_BATCH_SIZE = 50;
const DEFAULT_BACKFILL_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 500;

export async function runTranscriptSync(
	options: TranscriptSyncOptions = {},
): Promise<TranscriptSyncSummary> {
	const env = serverEnv();
	const organizationId = env.TRANSCRIPT_SYNC_ORG_ID;
	if (!organizationId) {
		throw new Error("TRANSCRIPT_SYNC_ORG_ID is required");
	}

	const mode = options.mode ?? "sweep";
	const batchSize = normalizeBatchSize(
		options.batchSize,
		mode === "backfill"
			? DEFAULT_BACKFILL_BATCH_SIZE
			: DEFAULT_SWEEP_BATCH_SIZE,
	);

	await ensureTranscriptSyncSchema();

	const rows = await discoverTranscriptSyncRows(organizationId, batchSize);
	const videoIds = rows.map((row) => row.video.id);
	const syncedVideoIds = await getSyncedVideoIds(videoIds);
	const plan = classifyTranscriptSyncDiscoveryRows(rows, syncedVideoIds);

	const summary: TranscriptSyncSummary = {
		mode,
		organizationId,
		scanned: rows.length,
		queued: 0,
		synced: 0,
		skippedAlreadySynced: plan.skippedAlreadySynced.length,
		skippedActiveUpload: plan.skippedActiveUpload.length,
		skippedUnsupportedStatus: plan.skippedUnsupportedStatus.length,
		failed: 0,
		errors: [],
	};

	for (const video of plan.toQueue) {
		if (!env.DEEPGRAM_API_KEY) {
			await recordVideoError(video, "Missing DEEPGRAM_API_KEY");
			summary.failed += 1;
			summary.errors.push({
				videoId: video.id,
				message: "Missing DEEPGRAM_API_KEY",
			});
			continue;
		}

		const result = await transcribeVideo(
			video.id as Video.VideoId,
			video.ownerId,
		);
		if (result.success) {
			summary.queued += 1;
			continue;
		}

		await recordVideoError(video, result.message);
		summary.failed += 1;
		summary.errors.push({ videoId: video.id, message: result.message });
	}

	for (const video of plan.toSync) {
		try {
			const synced = await retry(() => syncCompletedTranscript(video));
			if (synced) summary.synced += 1;
			else summary.skippedAlreadySynced += 1;
		} catch (error) {
			await recordVideoError(video, error);
			summary.failed += 1;
			summary.errors.push({
				videoId: video.id,
				message: stringifySyncError(error),
			});
		}
	}

	console.log("[transcript-sync] Sweep complete", summary);
	return summary;
}

export async function discoverTranscriptSyncRows(
	organizationId: string,
	limit: number,
): Promise<TranscriptSyncDiscoveryRow<DbVideo>[]> {
	const rows = await db()
		.select({
			video: videos,
			uploadPhase: videoUploads.phase,
		})
		.from(videos)
		.leftJoin(videoUploads, eq(videos.id, videoUploads.videoId))
		.where(
			and(
				eq(videos.orgId, organizationId as Organisation.OrganisationId),
				or(
					isNull(videos.transcriptionStatus),
					eq(videos.transcriptionStatus, "COMPLETE"),
				),
			),
		)
		.orderBy(asc(videos.createdAt))
		.limit(limit);

	return rows;
}

async function syncCompletedTranscript(video: DbVideo) {
	const rawVtt = await readTranscriptObject(video);
	if (rawVtt === null) {
		throw new Error("Transcript object not found");
	}

	const cues = parseWebVtt(rawVtt);
	const plainText = normalizeTranscriptText(cues);

	return insertTranscriptSyncRecord({
		videoId: video.id,
		organizationId: video.orgId,
		ownerId: video.ownerId,
		videoName: video.name,
		rawVtt,
		plainText,
		cues,
		sourceTranscriptionStatus: video.transcriptionStatus ?? "COMPLETE",
		sourceCreatedAt: video.createdAt,
		sourceUpdatedAt: video.updatedAt,
	});
}

async function readTranscriptObject(video: DbVideo) {
	const vttContent = await Effect.gen(function* () {
		const [bucket] = yield* Storage.getAccessForVideo(
			decodeStorageVideo(video),
		);
		return yield* bucket.getObject(
			`${video.ownerId}/${video.id}/transcription.vtt`,
		);
	}).pipe(runPromise);

	if (Option.isNone(vttContent)) return null;
	return vttContent.value;
}

async function recordVideoError(video: DbVideo, error: unknown) {
	await recordTranscriptSyncError({
		videoId: video.id,
		organizationId: video.orgId,
		ownerId: video.ownerId,
		videoName: video.name,
		sourceTranscriptionStatus: video.transcriptionStatus,
		sourceCreatedAt: video.createdAt,
		sourceUpdatedAt: video.updatedAt,
		error,
	});
}

async function retry<T>(operation: () => Promise<T>, attempts = 3) {
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError;
}

function normalizeBatchSize(input: number | undefined, fallback: number) {
	if (!input || !Number.isFinite(input)) return fallback;
	return Math.max(1, Math.min(Math.floor(input), MAX_BATCH_SIZE));
}

function stringifySyncError(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Transcript sync failed";
}
