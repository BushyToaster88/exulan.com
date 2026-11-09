"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { Footer } from "@/components/Footer"
import { Navbar } from "@/components/Navbar"
import { MosaicBackground } from "@/components/backgrounds/MosaicBackground"

export default function MainLayout({ children }: { readonly children: React.ReactNode }) {
	const pathname = usePathname()
	const scrollRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		globalThis.history.scrollRestoration = "manual"
	}, [])

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
	}, [pathname])

	return (
		<div className="h-screen w-full">
			<div
				ref={scrollRef}
				className="relative w-full h-screen text-theme-fg-0 overflow-y-auto overflow-x-clip flex flex-col"
			>
				<Navbar />
				<main className="flex-1">{children}</main>
				<Footer />
				<MosaicBackground className="fixed inset-0 -z-10" />
			</div>
		</div>
	)
}
