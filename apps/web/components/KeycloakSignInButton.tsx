"use client";

import { Button } from "@cap/ui";
import { signIn } from "next-auth/react";

export function KeycloakSignInButton({
	callbackUrl,
	disabled,
}: {
	callbackUrl?: string | null;
	disabled?: boolean;
}) {
	return (
		<Button
			variant="dark"
			type="button"
			className="w-full"
			disabled={disabled}
			onClick={() =>
				signIn("keycloak", callbackUrl ? { callbackUrl } : undefined)
			}
		>
			Continue with CIRQLE SSO
		</Button>
	);
}
