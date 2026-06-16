"use server";

import { db } from "@cap/database";
import { getCurrentUser } from "@cap/database/auth/session";
import { organizations } from "@cap/database/schema";
import {
	type AiGenerationLanguage,
	isAiGenerationLanguage,
} from "@cap/web-domain";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { normalizePlaybackSpeed } from "@/lib/playback-speed";
import { requireOrganizationSettingsManager } from "./authorization";

type OrganizationSettingsInput = {
	disableSummary?: boolean;
	disableCaptions?: boolean;
	disableChapters?: boolean;
	disableReactions?: boolean;
	disableTranscript?: boolean;
	disableComments?: boolean;
	hideShareableLinkCapLogo?: boolean;
	shareableLinkUseOrganizationIcon?: boolean;
	aiGenerationLanguage?: AiGenerationLanguage;
	defaultPlaybackSpeed?: number;
};

export async function updateOrganizationSettings(
	settings: OrganizationSettingsInput,
) {
	const user = await getCurrentUser();

	if (!user) {
		throw new Error("Unauthorized");
	}

	if (!settings) {
		throw new Error("Settings are required");
	}

	if (
		settings.aiGenerationLanguage !== undefined &&
		!isAiGenerationLanguage(settings.aiGenerationLanguage)
	) {
		throw new Error("Unsupported AI generation language");
	}

	if (!user.activeOrganizationId) {
		throw new Error("Organization not found");
	}

	const [organization] = await db()
		.select()
		.from(organizations)
		.where(eq(organizations.id, user.activeOrganizationId));

	if (!organization) {
		throw new Error("Organization not found");
	}

	await requireOrganizationSettingsManager(user.id, user.activeOrganizationId);

	const sanitizedSettings =
		settings.defaultPlaybackSpeed !== undefined
			? {
					...settings,
					defaultPlaybackSpeed: normalizePlaybackSpeed(
						settings.defaultPlaybackSpeed,
					),
				}
			: settings;

	await db()
		.update(organizations)
		.set({ settings: sanitizedSettings })
		.where(eq(organizations.id, user.activeOrganizationId));

	revalidatePath("/dashboard/caps");
	revalidatePath("/dashboard/settings/organization");
	revalidatePath("/dashboard/settings/organization/preferences");

	return { success: true };
}
