import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Background",
	alternates: { canonical: "/background" },
	// A bare demo of the animation with no content. Left crawlable (so search engines can
	// see this tag) but kept out of the index.
	robots: { index: false, follow: true },
}

export default function Page() {
	return <></>
}
