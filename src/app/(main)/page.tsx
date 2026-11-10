import type { Metadata } from "next"

import { SITE_DESCRIPTION, SITE_NAME } from "@/constants"

export const metadata: Metadata = {
	// The site name alone, rather than the "%s - Exulan" template.
	title: { absolute: SITE_NAME },
	description: SITE_DESCRIPTION,
	alternates: { canonical: "/" },
}

import HomeContent from "./_content"

export default function Page() {
	return <HomeContent />
}
