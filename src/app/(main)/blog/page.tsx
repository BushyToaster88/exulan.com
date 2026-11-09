import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Blog",
	alternates: { canonical: "/blog" },
}

import BlogListContent from "./_content"

export default function BlogList() {
	return <BlogListContent />
}
