import type { Metadata } from "next"
import { ReactNode } from "react"

import { TooltipProvider } from "@/components/ui/tooltip"

import { WEBSITE_HOSTNAME, WEBSITE_URL } from "@/constants"

import "katex/dist/katex.min.css"
import "@/styles/theme.css"

export const metadata: Metadata = {
	title: {
		template: "%s - Exulan",
		default: "Exulan",
	},
	description: "The personal website of Exulan.",
	metadataBase: new URL(WEBSITE_URL),
	openGraph: {
		type: "website",
		siteName: WEBSITE_HOSTNAME,
		locale: "en_US",
	},
	icons: "/assets/favicon.svg",
}

const LINKED_DATA = {
	"@context": "https://schema.org",
	"@type": "Person",
	"name": "Exulan",
	"url": WEBSITE_URL,
	"description": "The personal website of Exulan.",
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<meta name="theme-color" content="#ffffff" />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(LINKED_DATA),
					}}
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
