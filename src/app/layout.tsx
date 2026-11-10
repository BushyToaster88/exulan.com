import type { Metadata, Viewport } from "next"
import { ReactNode } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_LANGUAGE, SITE_LOCALE, SITE_NAME, THEME_COLOR, WEBSITE_AUTHOR, WEBSITE_URL } from "@/constants"
import { absoluteUrl, serializeJsonLd } from "@/lib/seo"

import "katex/dist/katex.min.css"
import "@/styles/theme.css"

export const viewport: Viewport = {
	themeColor: THEME_COLOR,
	colorScheme: "dark",
}

export const metadata: Metadata = {
	title: {
		template: `%s - ${SITE_NAME}`,
		default: SITE_NAME,
	},
	description: SITE_DESCRIPTION,
	applicationName: SITE_NAME,
	authors: [WEBSITE_AUTHOR],
	creator: WEBSITE_AUTHOR.name,
	metadataBase: new URL(WEBSITE_URL),
	// Every page is indexable unless it says otherwise. The extra Google directives
	// allow full-size image previews and unrestricted text snippets in results.
	robots: {
		index: true,
		follow: true,
		googleBot: {
			"index": true,
			"follow": true,
			"max-image-preview": "large",
			"max-snippet": -1,
			"max-video-preview": -1,
		},
	},
	// Pages that define their own openGraph or twitter block replace these wholesale,
	// so those blocks repeat the image themselves.
	openGraph: {
		type: "website",
		siteName: SITE_NAME,
		locale: SITE_LOCALE,
		images: [DEFAULT_OG_IMAGE],
	},
	twitter: {
		card: "summary_large_image",
		images: [{ url: DEFAULT_OG_IMAGE.url, alt: DEFAULT_OG_IMAGE.alt }],
	},
	icons: "/assets/favicon.svg",
}

const LINKED_DATA = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "WebSite",
			"@id": `${WEBSITE_URL}/#website`,
			"url": WEBSITE_URL,
			"name": SITE_NAME,
			"description": SITE_DESCRIPTION,
			"inLanguage": SITE_LANGUAGE,
			"publisher": { "@id": `${WEBSITE_URL}/#person` },
		},
		{
			"@type": "Person",
			"@id": `${WEBSITE_URL}/#person`,
			"name": WEBSITE_AUTHOR.name,
			"url": WEBSITE_URL,
			"description": SITE_DESCRIPTION,
			"image": absoluteUrl(DEFAULT_OG_IMAGE.url),
		},
	],
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
	return (
		<html lang="en-AU" className="dark">
			<head>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: serializeJsonLd(LINKED_DATA) }}
				/>
			</head>
			<body id="root">
				<TooltipProvider>
					{children}
				</TooltipProvider>
			</body>
		</html>
	)
}
