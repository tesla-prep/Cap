"use client";

import { Button } from "@cap/ui";
import type { Video } from "@cap/web-domain";
import {
	faRectangleList,
	faRotateRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

type AiGenerationStatus =
	| "QUEUED"
	| "PROCESSING"
	| "COMPLETE"
	| "ERROR"
	| "SKIPPED";

interface Chapter {
	title: string;
	start: number;
}

interface SummaryProps {
	videoId: Video.VideoId;
	onSeek?: (time: number) => void;
	initialAiData?: {
		title?: string | null;
		summary?: string | null;
		chapters?: Chapter[] | null;
		aiGenerationStatus?: AiGenerationStatus | null;
	};
	aiGenerationEnabled?: boolean;
	isSummaryDisabled?: boolean;
}

const formatTime = (time: number) => {
	const minutes = Math.floor(time / 60);
	const seconds = Math.floor(time % 60);
	return `${minutes.toString().padStart(2, "0")}:${seconds
		.toString()
		.padStart(2, "0")}`;
};

const SkeletonLoader = () => (
	<div className="p-4 space-y-6 animate-pulse">
		<div>
			<div className="mb-3 w-24 h-6 bg-gray-200 rounded"></div>
			<div className="mb-4 w-32 h-3 bg-gray-100 rounded"></div>
			<div className="space-y-3">
				<div className="w-full h-4 bg-gray-200 rounded"></div>
				<div className="w-5/6 h-4 bg-gray-200 rounded"></div>
				<div className="w-4/5 h-4 bg-gray-200 rounded"></div>
				<div className="w-full h-4 bg-gray-200 rounded"></div>
				<div className="w-3/4 h-4 bg-gray-200 rounded"></div>
			</div>
		</div>

		<div>
			<div className="mb-4 w-24 h-6 bg-gray-200 rounded"></div>
			<div className="space-y-2">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="flex items-center p-2">
						<div className="mr-3 w-12 h-4 bg-gray-200 rounded"></div>
						<div className="flex-1 h-4 bg-gray-200 rounded"></div>
					</div>
				))}
			</div>
		</div>
	</div>
);

export const Summary: React.FC<SummaryProps> = ({
	videoId,
	onSeek,
	initialAiData,
	isSummaryDisabled = false,
	aiGenerationEnabled = false,
}) => {
	const [isRetrying, setIsRetrying] = useState(false);
	const [retryError, setRetryError] = useState<string | null>(null);

	const aiData = initialAiData || null;
	const aiGenerationStatus = aiData?.aiGenerationStatus;

	const isLoading =
		aiGenerationEnabled &&
		(aiGenerationStatus === "QUEUED" || aiGenerationStatus === "PROCESSING") &&
		!aiData?.summary &&
		!aiData?.chapters?.length;

	const canRetry =
		aiGenerationStatus === "ERROR" || aiGenerationStatus === "SKIPPED";

	const handleSeek = (time: number) => {
		if (onSeek) {
			onSeek(time);
		}
	};

	const handleRetry = async () => {
		setIsRetrying(true);
		setRetryError(null);

		try {
			const response = await fetch(`/api/videos/${videoId}/retry-ai`, {
				method: "POST",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to retry AI generation");
			}

			window.location.reload();
		} catch (error) {
			setRetryError(
				error instanceof Error
					? error.message
					: "Failed to retry AI generation",
			);
		} finally {
			setIsRetrying(false);
		}
	};

	if (isSummaryDisabled) return null;

	if (isLoading) {
		return (
			<div className="flex flex-col h-full">
				<div className="overflow-y-auto flex-1">
					<SkeletonLoader />
				</div>
			</div>
		);
	}

	if (!aiData?.summary && !aiData?.chapters?.length) {
		return (
			<div className="flex flex-col justify-center items-center p-8 h-full text-center">
				<FontAwesomeIcon
					icon={faRectangleList}
					className="mb-4 text-gray-12 size-8"
				/>
				<div className="space-y-1">
					<h3 className="text-base font-medium text-gray-12">
						{aiGenerationStatus === "ERROR"
							? "AI generation failed"
							: aiGenerationStatus === "SKIPPED"
								? "AI generation skipped"
								: "No summary available"}
					</h3>
					<p className="text-sm text-gray-10">
						{aiGenerationStatus === "ERROR"
							? "There was an error generating the AI summary."
							: aiGenerationStatus === "SKIPPED"
								? "The video was too short or had no speech detected."
								: "AI summary has not been generated for this video yet."}
					</p>
					{canRetry && (
						<div className="pt-4">
							<Button
								variant="gray"
								size="sm"
								onClick={handleRetry}
								disabled={isRetrying}
							>
								<FontAwesomeIcon
									icon={faRotateRight}
									className={`mr-2 ${isRetrying ? "animate-spin" : ""}`}
								/>
								{isRetrying ? "Retrying..." : "Retry AI Generation"}
							</Button>
							{retryError && (
								<p className="mt-2 text-sm text-red-500">{retryError}</p>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			<div className="overflow-y-auto flex-1">
				<div className="p-4 space-y-6">
					{aiData?.summary && (
						<div>
							<h3 className="text-lg font-medium">Summary</h3>
							<div className="mb-2">
								<span className="text-xs font-semibold text-gray-8">
									Generated by Cap AI
								</span>
							</div>
							<div className="text-sm text-gray-12 prose prose-sm prose-gray max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0 prose-strong:text-gray-12">
								<ReactMarkdown>{aiData.summary}</ReactMarkdown>
							</div>
						</div>
					)}

					{aiData?.chapters && aiData.chapters.length > 0 && (
						<div className={aiData?.summary ? "mt-6" : ""}>
							<h3 className="mb-2 text-lg font-medium">Chapters</h3>
							<div className="divide-y">
								{aiData.chapters.map((chapter) => (
									<button
										type="button"
										key={chapter.start}
										className="flex items-center p-2 w-full text-left rounded transition-colors cursor-pointer hover:bg-gray-100"
										onClick={() => handleSeek(chapter.start)}
									>
										<span className="w-16 text-xs text-gray-500">
											{formatTime(chapter.start)}
										</span>
										<span className="ml-2 text-sm">{chapter.title}</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
