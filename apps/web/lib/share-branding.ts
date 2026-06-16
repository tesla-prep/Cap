import type { ImageUpload } from "@cap/web-domain";

export type SharePageBranding =
	| {
			type: "custom";
			imageUrl: ImageUpload.ImageUrl;
			name: string;
	  }
	| {
			type: "cap";
	  };

export type SharePageBrandingInput = {
	orgSettings?: {
		shareableLinkUseOrganizationIcon?: boolean;
		hideShareableLinkCapLogo?: boolean;
	} | null;
	organizationName?: string | null;
	organizationIconUrl?: ImageUpload.ImageUrl | null;
	shareableLinkIconUrl?: ImageUpload.ImageUrl | null;
};

export function getSharePageBranding(
	data: SharePageBrandingInput,
): SharePageBranding | null {
	const brandedIcon = data.orgSettings?.shareableLinkUseOrganizationIcon
		? data.organizationIconUrl
		: data.shareableLinkIconUrl;

	if (brandedIcon) {
		return {
			type: "custom",
			imageUrl: brandedIcon,
			name: data.organizationName ?? "Organization",
		};
	}

	if (data.orgSettings?.hideShareableLinkCapLogo) {
		return null;
	}

	return { type: "cap" };
}
