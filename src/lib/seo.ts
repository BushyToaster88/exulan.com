import { WEBSITE_URL } from "@/constants"

/** Turns a site-relative path into an absolute URL on the canonical host. */
export function absoluteUrl(path: string): string {
	return /^https?:\/\//.test(path) ? path : `${WEBSITE_URL}${path}`
}

/**
 * Serialises structured data for a `<script type="application/ld+json">` tag.
 * Escapes `<` so nothing in the data can ever close the script element early.
 */
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/</g, "\\u003c")
}
