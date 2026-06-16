export interface FeatureFlagUser {
	email: string;
}

export async function isAiGenerationEnabled(
	user: FeatureFlagUser,
): Promise<boolean> {
	return Boolean(user.email);
}
