import type { Metadata } from "next"

import { DEFAULT_OG_IMAGE, EMBED_DESCRIPTION, EMBED_TITLE, SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME } from "@/constants"

export const metadata: Metadata = {
	// The site name alone, rather than the "%s - Exulan" template. This is the browser tab
	// and search result title, so it stays short.
	title: { absolute: SITE_NAME },
	description: SITE_DESCRIPTION,
	alternates: { canonical: "/" },
	// Link previews get their own, longer wording. A page-level openGraph or twitter block
	// replaces the site-wide one, so the shared fields are repeated here.
	openGraph: {
		type: "website",
		url: "/",
		title: EMBED_TITLE,
		description: EMBED_DESCRIPTION,
		siteName: SITE_NAME,
		locale: SITE_LOCALE,
		images: [DEFAULT_OG_IMAGE],
	},
	twitter: {
		card: "summary_large_image",
		title: EMBED_TITLE,
		description: EMBED_DESCRIPTION,
		images: [{ url: DEFAULT_OG_IMAGE.url, alt: DEFAULT_OG_IMAGE.alt }],
	},
}

import HomeContent from "./_content"

export default function Page() {
	return <HomeContent />
}
