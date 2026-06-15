export type TranscriptSyncStatus =
	| "PROCESSING"
	| "COMPLETE"
	| "ERROR"
	| "SKIPPED"
	| "NO_AUDIO"
	| null;

export type TranscriptSyncDiscoveryVideo = {
	id: string;
	transcriptionStatus: TranscriptSyncStatus;
};

export type TranscriptSyncUploadPhase =
	| "uploading"
	| "processing"
	| "generating_thumbnail"
	| "complete"
	| "error"
	| null;

export type TranscriptSyncDiscoveryRow<
	TVideo extends TranscriptSyncDiscoveryVideo,
> = {
	video: TVideo;
	uploadPhase: TranscriptSyncUploadPhase;
};

export type TranscriptSyncPlan<TVideo extends TranscriptSyncDiscoveryVideo> = {
	toQueue: TVideo[];
	toSync: TVideo[];
	skippedActiveUpload: TVideo[];
	skippedAlreadySynced: TVideo[];
	skippedUnsupportedStatus: TVideo[];
};

const ACTIVE_UPLOAD_PHASES = new Set<TranscriptSyncUploadPhase>([
	"uploading",
	"processing",
	"generating_thumbnail",
]);

export function classifyTranscriptSyncDiscoveryRows<
	TVideo extends TranscriptSyncDiscoveryVideo,
>(
	rows: readonly TranscriptSyncDiscoveryRow<TVideo>[],
	syncedVideoIds: ReadonlySet<string>,
): TranscriptSyncPlan<TVideo> {
	const plan: TranscriptSyncPlan<TVideo> = {
		toQueue: [],
		toSync: [],
		skippedActiveUpload: [],
		skippedAlreadySynced: [],
		skippedUnsupportedStatus: [],
	};

	for (const row of rows) {
		if (ACTIVE_UPLOAD_PHASES.has(row.uploadPhase)) {
			plan.skippedActiveUpload.push(row.video);
			continue;
		}

		if (syncedVideoIds.has(row.video.id)) {
			plan.skippedAlreadySynced.push(row.video);
			continue;
		}

		if (row.video.transcriptionStatus === "COMPLETE") {
			plan.toSync.push(row.video);
			continue;
		}

		if (row.video.transcriptionStatus === null) {
			plan.toQueue.push(row.video);
			continue;
		}

		plan.skippedUnsupportedStatus.push(row.video);
	}

	return plan;
}
