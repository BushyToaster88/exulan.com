"use client"

import clsx from "clsx"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/navigation-menu"
import { GRAYSCALE_BACKDROP } from "@/lib/styles"
import { cn } from "@/lib/utils"

const pages = [
	{ label: "Home", href: "/" },
	{ label: "Blog", href: "/blog" },
]

export function Navbar() {
	const pathname = usePathname()

	return (
		<NavigationMenu className={clsx(GRAYSCALE_BACKDROP, "h-min border-b max-w-none w-screen justify-center flex-grow-0")}>
			<NavigationMenuList>
				{pages.map(({ label, href }) => {
					const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)

					return (
						<NavigationMenuItem key={href}>
							<NavigationMenuLink
								className={cn(
									"relative h-12 rounded-none focus:bg-[unset] animate-all",
									"after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-transparent after:transition-colors",
									"hover:after:bg-theme-fg-1",
								)}
								render={props => (
									<Link
										href={href}
										className={cn(
											props.className,
											"text-theme-fg-1 hover:text-theme-fg-0 hover:bg-[unset]",
											isActive && "text-theme-fg-0 after:!bg-theme-fg-0",
										)}
									>
										{label}
									</Link>
								)}
							/>
						</NavigationMenuItem>
					)
				})}
			</NavigationMenuList>
		</NavigationMenu>
	)
}
