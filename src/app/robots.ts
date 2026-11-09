import type { MetadataRoute } from "next"

import { WEBSITE_URL } from "@/constants"

// robots.ts compiles to a special route handler; under `output: "export"`
// Next.js requires an explicit static-generation marker (same as sitemap.ts).
export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
		},
		sitemap: `${WEBSITE_URL}/sitemap.xml`,
	}
}
