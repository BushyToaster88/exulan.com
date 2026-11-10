import type { MetadataRoute } from "next"

import { WEBSITE_URL } from "@/constants"

// robots.ts compiles to a special route handler; under `output: "export"`
// Next.js requires an explicit static-generation marker (same as sitemap.ts).
export const dynamic = "force-static"

// Everything is open to crawlers, including /_next/ (Google needs the page's CSS and
// JavaScript to render it). Nothing is disallowed on purpose: /background keeps itself
// out of the index with a noindex tag, and a crawler blocked by robots.txt could never
// see that tag. The sitemap line is how crawlers discover the post URLs.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{ userAgent: "*", allow: "/" },
		],
		sitemap: `${WEBSITE_URL}/sitemap.xml`,
	}
}
