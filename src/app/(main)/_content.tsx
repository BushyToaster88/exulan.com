"use client"

import Decimal from "decimal.js"
import { useEffect, useLayoutEffect, useState } from "react"

const MS_PER_GREGORIAN_YEAR = new Decimal(365.2425).mul(24 * 60 * 60 * 1000)

// 1999-09-15 11:59, taken as UTC+10 (Melbourne, before daylight saving starts).
const BIRTHDAY = new Decimal(Date.UTC(1999, 8, 15, 11, 59)).minus(10 * 60 * 60 * 1000)

function calculateAge() {
	return new Decimal(Date.now()).sub(BIRTHDAY).div(MS_PER_GREGORIAN_YEAR)
}

export default function HomeContent() {
	const [age, setAge] = useState<Decimal | null>(null)

	useLayoutEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setAge(calculateAge())
	}, [])

	useEffect(() => {
		let running = true
		function tick() {
			if (!running) {
				return
			}

			setAge(calculateAge())
			requestAnimationFrame(tick)
		}

		requestAnimationFrame(tick)
		return () => {
			running = false
		}
	}, [])

	return (
		<div className="min-h-screen">
			<div className="relative overflow-hidden">
				<img
					src="/assets/banner.gif"
					className="block w-full h-auto max-h-[400px] object-cover object-left-top"
					width={1360}
					height={480}
					alt="A terminal prompt, root@archpower, with a blinking cursor"
				/>
				<div className="absolute bottom-0 left-0 right-0 border-b" />
			</div>

			<div className="container mx-auto px-4 py-10 text-shadow-lg/30">
				<h1 className="text-left text-5xl mb-6">Gday, welcome to my website!</h1>

				<div className="max-w-prose space-y-4">
					<p>There isn&apos;t much here other than random stuff that I believe should be documented on the internet.</p>
					<p>
						I&apos;m <u className="decoration-solid decoration-theme-fg-2">{age?.toFixed(7) ?? "..."}</u> years old, a proud Aussie, and I love my country.
					</p>
					<p>I love owning my own equipment, running and managing servers, hosting Tor relays, and seeding torrents.</p>
					<p>
						This website and the tiling animation were forked from{" "}
						<a href="https://rafa-br34.dev/" className="underline" target="_blank" rel="noopener">rafa-br34.dev</a>{" "}
						(awesome person btw).
					</p>
					<p>
						Reach out on Discord if you want, I&apos;m chronically online and will respond there: <code>Exulan</code>
					</p>
				</div>
			</div>
		</div>
	)
}
