import { BundledLanguageInfo, bundledLanguagesInfo } from "shiki"

const LANGUAGE_FROM_ID = new Map<string, BundledLanguageInfo>()

for (const lang of bundledLanguagesInfo) {
	LANGUAGE_FROM_ID.set(lang.id.toLowerCase(), lang)
	lang.aliases?.forEach(alias => LANGUAGE_FROM_ID.set(alias.toLowerCase(), lang))
}

export function extractLanguageClass(className: unknown): string | null {
	if (typeof className !== "string") {
		return null
	}
	const match = /\blanguage-([A-Za-z0-9_+#.-]+)/.exec(className)
	return match?.[1] ?? null
}

export function languageDisplayName(language: string): string {
	return LANGUAGE_FROM_ID.get(language.toLowerCase()).name ?? language
}
