export type TranscriptCue = {
	index: number;
	cueId: string | null;
	startSeconds: number;
	endSeconds: number;
	text: string;
};

const TIMESTAMP_LINE =
	/^((?:(?:\d{2}:)?\d{2}:)?\d{2}\.\d{3})\s+-->\s+((?:(?:\d{2}:)?\d{2}:)?\d{2}\.\d{3})(?:\s+.*)?$/;

export function parseWebVtt(vtt: string): TranscriptCue[] {
	const normalized = vtt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
	const blocks = normalized.split(/\n{2,}/);
	const cues: TranscriptCue[] = [];

	for (const block of blocks) {
		const lines = block
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		if (lines.length === 0) continue;

		const firstLine = lines[0];
		if (!firstLine) continue;

		if (
			firstLine === "WEBVTT" ||
			firstLine.startsWith("WEBVTT ") ||
			firstLine.startsWith("NOTE") ||
			firstLine === "STYLE" ||
			firstLine === "REGION"
		) {
			continue;
		}

		let cueId: string | null = null;
		let timingLineIndex = 0;
		let match = lines[timingLineIndex]?.match(TIMESTAMP_LINE);

		if (!match && lines.length > 1) {
			cueId = firstLine;
			timingLineIndex = 1;
			match = lines[timingLineIndex]?.match(TIMESTAMP_LINE);
		}

		const start = match?.[1];
		const end = match?.[2];
		if (!start || !end) continue;

		const text = cleanCueText(lines.slice(timingLineIndex + 1).join(" "));
		if (!text) continue;

		cues.push({
			index: cues.length,
			cueId,
			startSeconds: parseVttTimestamp(start),
			endSeconds: parseVttTimestamp(end),
			text,
		});
	}

	return cues;
}

export function normalizeTranscriptText(cues: readonly TranscriptCue[]) {
	return cues.map((cue) => cue.text).join("\n");
}

function parseVttTimestamp(timestamp: string) {
	const parts = timestamp.split(":");
	const secondsPart = parts.at(-1);
	if (!secondsPart) return 0;

	const seconds = Number(secondsPart);
	const minutes = Number(parts.at(-2) ?? 0);
	const hours = Number(parts.at(-3) ?? 0);

	return hours * 3600 + minutes * 60 + seconds;
}

function cleanCueText(text: string) {
	return decodeHtmlEntities(text.replace(/<[^>]+>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

function decodeHtmlEntities(text: string) {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}
