import "server-only";

import { serverEnv } from "@cap/env";
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { TRANSCRIPT_SYNC_SCHEMA_SQL } from "./schema";
import type { TranscriptCue } from "./vtt";

export type TranscriptSyncQueryClient = {
	query<T extends QueryResultRow = QueryResultRow>(
		text: string,
		params?: readonly unknown[],
	): Promise<QueryResult<T>>;
};

export type TranscriptSyncRecordInput = {
	videoId: string;
	organizationId: string;
	ownerId: string;
	videoName: string | null;
	variant?: string;
	rawVtt: string;
	plainText: string;
	cues: readonly TranscriptCue[];
	sourceTranscriptionStatus: string;
	sourceCreatedAt: Date | null;
	sourceUpdatedAt: Date | null;
};

export type TranscriptSyncErrorInput = {
	videoId: string;
	organizationId: string;
	ownerId: string;
	videoName: string | null;
	variant?: string;
	sourceTranscriptionStatus: string | null;
	sourceCreatedAt: Date | null;
	sourceUpdatedAt: Date | null;
	error: unknown;
};

let transcriptSyncPool: Pool | undefined;

export function getTranscriptSyncPool() {
	if (transcriptSyncPool) return transcriptSyncPool;

	const connectionString = serverEnv().TRANSCRIPT_SYNC_POSTGRES_URL;
	if (!connectionString) {
		throw new Error("TRANSCRIPT_SYNC_POSTGRES_URL is required");
	}

	transcriptSyncPool = new Pool({
		connectionString,
		application_name: "cap_transcript_sync",
		max: 5,
	});
	return transcriptSyncPool;
}

export async function ensureTranscriptSyncSchema(
	client: TranscriptSyncQueryClient = getTranscriptSyncPool(),
) {
	await client.query(TRANSCRIPT_SYNC_SCHEMA_SQL);
}

export async function getSyncedVideoIds(
	videoIds: readonly string[],
	client: TranscriptSyncQueryClient = getTranscriptSyncPool(),
	variant = "default",
) {
	if (videoIds.length === 0) return new Set<string>();

	const result = await client.query<{ video_id: string }>(
		`
			SELECT video_id
			FROM video_transcripts
			WHERE video_id = ANY($1::text[])
				AND variant = $2
				AND status = 'SYNCED'
		`,
		[videoIds, variant],
	);

	return new Set(result.rows.map((row) => row.video_id));
}

export async function insertTranscriptSyncRecord(
	input: TranscriptSyncRecordInput,
	client: TranscriptSyncQueryClient = getTranscriptSyncPool(),
) {
	const variant = input.variant ?? "default";
	const result = await client.query<{ video_id: string }>(
		`
			INSERT INTO video_transcripts (
				video_id,
				organization_id,
				owner_id,
				variant,
				video_name,
				raw_vtt,
				plain_text,
				cues,
				status,
				source_transcription_status,
				source_created_at,
				source_updated_at,
				first_synced_at,
				synced_at,
				last_attempted_at,
				error_count,
				last_error,
				last_error_at,
				updated_at
			)
			VALUES (
				$1,
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8::jsonb,
				'SYNCED',
				$9,
				$10,
				$11,
				now(),
				now(),
				now(),
				0,
				NULL,
				NULL,
				now()
			)
			ON CONFLICT (video_id, variant) DO UPDATE SET
				organization_id = EXCLUDED.organization_id,
				owner_id = EXCLUDED.owner_id,
				video_name = EXCLUDED.video_name,
				raw_vtt = EXCLUDED.raw_vtt,
				plain_text = EXCLUDED.plain_text,
				cues = EXCLUDED.cues,
				status = 'SYNCED',
				source_transcription_status = EXCLUDED.source_transcription_status,
				source_created_at = EXCLUDED.source_created_at,
				source_updated_at = EXCLUDED.source_updated_at,
				first_synced_at = COALESCE(video_transcripts.first_synced_at, now()),
				synced_at = now(),
				last_attempted_at = now(),
				last_error = NULL,
				last_error_at = NULL,
				updated_at = now()
			WHERE video_transcripts.status <> 'SYNCED'
			RETURNING video_id
		`,
		[
			input.videoId,
			input.organizationId,
			input.ownerId,
			variant,
			input.videoName,
			input.rawVtt,
			input.plainText,
			JSON.stringify(input.cues),
			input.sourceTranscriptionStatus,
			input.sourceCreatedAt,
			input.sourceUpdatedAt,
		],
	);

	return (result.rowCount ?? 0) > 0;
}

export async function recordTranscriptSyncError(
	input: TranscriptSyncErrorInput,
	client: TranscriptSyncQueryClient = getTranscriptSyncPool(),
) {
	const variant = input.variant ?? "default";
	const errorMessage = stringifyError(input.error);

	await client.query(
		`
			INSERT INTO video_transcripts (
				video_id,
				organization_id,
				owner_id,
				variant,
				video_name,
				cues,
				status,
				source_transcription_status,
				source_created_at,
				source_updated_at,
				last_attempted_at,
				error_count,
				last_error,
				last_error_at,
				updated_at
			)
			VALUES (
				$1,
				$2,
				$3,
				$4,
				$5,
				'[]'::jsonb,
				'ERROR',
				$6,
				$7,
				$8,
				now(),
				1,
				$9,
				now(),
				now()
			)
			ON CONFLICT (video_id, variant) DO UPDATE SET
				organization_id = EXCLUDED.organization_id,
				owner_id = EXCLUDED.owner_id,
				video_name = EXCLUDED.video_name,
				source_transcription_status = EXCLUDED.source_transcription_status,
				source_created_at = EXCLUDED.source_created_at,
				source_updated_at = EXCLUDED.source_updated_at,
				last_attempted_at = now(),
				error_count = video_transcripts.error_count + 1,
				last_error = EXCLUDED.last_error,
				last_error_at = now(),
				updated_at = now()
			WHERE video_transcripts.status <> 'SYNCED'
		`,
		[
			input.videoId,
			input.organizationId,
			input.ownerId,
			variant,
			input.videoName,
			input.sourceTranscriptionStatus,
			input.sourceCreatedAt,
			input.sourceUpdatedAt,
			errorMessage,
		],
	);
}

export function stringifyError(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;

	try {
		return JSON.stringify(error);
	} catch {
		return "Unknown transcript sync error";
	}
}
