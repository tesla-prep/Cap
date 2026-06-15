import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@cap/env";
import { NextResponse } from "next/server";
import {
	runTranscriptSync,
	type TranscriptSyncMode,
} from "@/lib/transcript-sync/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	return handleTranscriptSync(request);
}

export async function POST(request: Request) {
	return handleTranscriptSync(request);
}

async function handleTranscriptSync(request: Request) {
	const cronSecret = serverEnv().TRANSCRIPT_SYNC_CRON_SECRET;
	if (!cronSecret) {
		return NextResponse.json(
			{ error: "Server misconfiguration" },
			{ status: 500 },
		);
	}

	const authHeader = request.headers.get("authorization");
	const expected = `Bearer ${cronSecret}`;
	if (
		!authHeader ||
		authHeader.length !== expected.length ||
		!timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
	) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const mode = parseMode(url.searchParams.get("mode"));
	const batchSize = parseBatchSize(url.searchParams.get("batchSize"));

	try {
		const summary = await runTranscriptSync({ mode, batchSize });
		return NextResponse.json({ success: true, ...summary });
	} catch (error) {
		console.error("[transcript-sync] Cron failed", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Transcript sync failed",
			},
			{ status: 500 },
		);
	}
}

function parseMode(value: string | null): TranscriptSyncMode {
	return value === "backfill" ? "backfill" : "sweep";
}

function parseBatchSize(value: string | null) {
	if (!value) return undefined;

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return undefined;

	return parsed;
}
