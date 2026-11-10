import { MosaicBackground } from "@/components/backgrounds/MosaicBackground"

export default function BackgroundLayout({ children }: { readonly children: React.ReactNode }) {
	return (
		<div className="relative h-full w-full">
			<MosaicBackground className="fixed inset-0" />
			{children}
		</div>
	)
}
