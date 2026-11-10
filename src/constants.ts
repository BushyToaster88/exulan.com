export const WEBSITE_HOSTNAME = "www.exulan.com"
export const WEBSITE_URL = `https://${WEBSITE_HOSTNAME}`

export const WEBSITE_AUTHOR = {
	name: "Exulan",
	url: WEBSITE_URL,
}

export const SITE_NAME = "Exulan"
export const SITE_DESCRIPTION = "The personal website of Exulan, an Aussie who loves owning their own equipment, running servers and hosting Tor relays."
/**
 * Title and description for the home page's link previews (Discord, Twitter and similar).
 * The title is kept exactly as written.
 */
export const EMBED_TITLE = "Im an aussie who loves owning my own equipment, messing around with servers and abusing my ISP by running tor relays."
export const EMBED_DESCRIPTION = SITE_DESCRIPTION
export const BLOG_DESCRIPTION = "Random stuff that should be documented on the internet."

/** Language and region of the content (BCP 47 for HTML and JSON-LD, then the Open Graph form). */
export const SITE_LANGUAGE = "en-AU"
export const SITE_LOCALE = "en_AU"

/** Matches the dark page background, so mobile browser chrome blends in. */
export const THEME_COLOR = "#080916"

/** Preview image for pages that do not have their own (link cards, search result thumbnails). */
export const DEFAULT_OG_IMAGE = {
	url: "/assets/og-image.png",
	width: 1200,
	height: 630,
	alt: "Exulan: random stuff that should be documented on the internet",
}
