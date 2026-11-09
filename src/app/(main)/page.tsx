import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "About me",
	alternates: { canonical: "/" },
}

import HomeContent from "./_content"

export default function Page() {
	return <HomeContent />
}
