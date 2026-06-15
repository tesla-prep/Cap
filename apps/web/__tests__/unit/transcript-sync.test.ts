import type { QueryResult, QueryResultRow } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
	classifyTranscriptSyncDiscoveryRows,
	type TranscriptSyncDiscoveryRow,
	type TranscriptSyncDiscoveryVideo,
} from "@/lib/transcript-sync/planner";
import {
	insertTranscriptSyncRecord,
	recordTranscriptSyncError,
	type TranscriptSyncQueryClient,
} from "@/lib/transcript-sync/postgres";
import {
	normalizeTranscriptText,
	parseWebVtt,
} from "@/lib/transcript-sync/vtt";

vi.mock("@cap/env", () => ({
	serverEnv: vi.fn(() => ({
		TRANSCRIPT_SYNC_POSTGRES_URL:
			"postgres://cap_transcripts_app:test@localhost:5432/cap_transcripts",
	})),
}));

vi.mock("server-only", () => ({}));

type QueryCall = {
	text: string;
	params?: readonly unknown[];
};

type QueryResponse = {
	rowCount: number | null;
	rows: QueryResultRow[];
};

function makeQueryClient(responses: QueryResponse[]) {
	const calls: QueryCall[] = [];
	const client: TranscriptSyncQueryClient & { calls: QueryCall[] } = {
		calls,
		query: async <T extends QueryResultRow = QueryResultRow>(
			text: string,
			params?: readonly unknown[],
		): Promise<QueryResult<T>> => {
			calls.push({ text, params });
			const response = responses.shift() ?? { rowCount: 0, rows: [] };

			return {
				command: "",
				fields: [],
				oid: 0,
				rowCount: response.rowCount,
				rows: response.rows as T[],
			};
		},
	};

	return client;
}

describe("transcript sync VTT normalization", () => {
	it("parses cue timestamps, cue IDs, tags, and entities", () => {
		const cues = parseWebVtt(`WEBVTT

intro
00:00:01.000 --> 00:00:03.500
<v Speaker>Hello &amp; welcome</v>

00:00:04.000 --> 00:00:05.250 align:start
Second line
continued
`);

		expect(cues).toEqual([
			{
				index: 0,
				cueId: "intro",
				startSeconds: 1,
				endSeconds: 3.5,
				text: "Hello & welcome",
			},
			{
				index: 1,
				cueId: null,
				startSeconds: 4,
				endSeconds: 5.25,
				text: "Second line continued",
			},
		]);
		expect(normalizeTranscriptText(cues)).toBe(
			"Hello & welcome\nSecond line continued",
		);
	});
});

describe("transcript sync discovery planner", () => {
	it("classifies active uploads, completed transcripts, null status videos, and already synced rows", () => {
		const rows: TranscriptSyncDiscoveryRow<TranscriptSyncDiscoveryVideo>[] = [
			{
				video: { id: "active-video", transcriptionStatus: null },
				uploadPhase: "processing",
			},
			{
				video: { id: "completed-video", transcriptionStatus: "COMPLETE" },
				uploadPhase: null,
			},
			{
				video: { id: "queued-video", transcriptionStatus: null },
				uploadPhase: null,
			},
			{
				video: { id: "synced-video", transcriptionStatus: "COMPLETE" },
				uploadPhase: null,
			},
			{
				video: { id: "error-video", transcriptionStatus: "ERROR" },
				uploadPhase: null,
			},
		];

		const plan = classifyTranscriptSyncDiscoveryRows(
			rows,
			new Set(["synced-video"]),
		);

		expect(plan.toSync.map((video) => video.id)).toEqual(["completed-video"]);
		expect(plan.toQueue.map((video) => video.id)).toEqual(["queued-video"]);
		expect(plan.skippedActiveUpload.map((video) => video.id)).toEqual([
			"active-video",
		]);
		expect(plan.skippedAlreadySynced.map((video) => video.id)).toEqual([
			"synced-video",
		]);
		expect(plan.skippedUnsupportedStatus.map((video) => video.id)).toEqual([
			"error-video",
		]);
	});
});

describe("transcript sync Postgres helpers", () => {
	it("inserts transcript records idempotently without overwriting synced rows", async () => {
		const client = makeQueryClient([{ rowCount: 1, rows: [] }]);

		const inserted = await insertTranscriptSyncRecord(
			{
				videoId: "video-1",
				organizationId: "org-1",
				ownerId: "user-1",
				videoName: "Demo",
				rawVtt: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello",
				plainText: "Hello",
				cues: [
					{
						index: 0,
						cueId: null,
						startSeconds: 0,
						endSeconds: 1,
						text: "Hello",
					},
				],
				sourceTranscriptionStatus: "COMPLETE",
				sourceCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
				sourceUpdatedAt: new Date("2026-01-01T00:01:00.000Z"),
			},
			client,
		);

		expect(inserted).toBe(true);
		expect(client.calls[0]?.text).toContain(
			"ON CONFLICT (video_id, variant) DO UPDATE",
		);
		expect(client.calls[0]?.text).toContain(
			"WHERE video_transcripts.status <> 'SYNCED'",
		);
		expect(client.calls[0]?.params?.[7]).toBe(
			JSON.stringify([
				{
					index: 0,
					cueId: null,
					startSeconds: 0,
					endSeconds: 1,
					text: "Hello",
				},
			]),
		);
	});

	it("returns false when a transcript row was already synced", async () => {
		const client = makeQueryClient([{ rowCount: 0, rows: [] }]);

		const inserted = await insertTranscriptSyncRecord(
			{
				videoId: "video-1",
				organizationId: "org-1",
				ownerId: "user-1",
				videoName: "Demo",
				rawVtt: "WEBVTT",
				plainText: "",
				cues: [],
				sourceTranscriptionStatus: "COMPLETE",
				sourceCreatedAt: null,
				sourceUpdatedAt: null,
			},
			client,
		);

		expect(inserted).toBe(false);
	});

	it("records retryable errors without replacing successful transcript rows", async () => {
		const client = makeQueryClient([{ rowCount: 1, rows: [] }]);

		await recordTranscriptSyncError(
			{
				videoId: "video-2",
				organizationId: "org-1",
				ownerId: "user-1",
				videoName: "Missing transcript",
				sourceTranscriptionStatus: "COMPLETE",
				sourceCreatedAt: null,
				sourceUpdatedAt: null,
				error: new Error("Transcript object not found"),
			},
			client,
		);

		expect(client.calls[0]?.text).toContain(
			"error_count = video_transcripts.error_count + 1",
		);
		expect(client.calls[0]?.text).toContain(
			"WHERE video_transcripts.status <> 'SYNCED'",
		);
		expect(client.calls[0]?.params?.at(-1)).toBe("Transcript object not found");
	});
});
