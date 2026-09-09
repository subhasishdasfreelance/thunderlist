import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { Link, useRouterState } from "@tanstack/react-router";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";

/**
 * Mobile primary navigation.
 *
 * AppShell's own mobile drawer is disabled in favour of this bar: a persistent
 * bottom row keeps every destination one thumb-tap away, which is what the app
 * is meant to feel like on a phone. Hidden from `md` up, where the side nav
 * takes over.
 *
 * It shares the top bar's glass treatment, including its fallbacks: see
 * `.thunderlist-glass` in `styles.css`.
 */
export function BottomNav() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<nav
			aria-label="Primary"
			className="thunderlist-glass fixed inset-x-0 bottom-0 z-50 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			<ul className="m-0 flex list-none justify-around p-0">
				{NAV_ITEMS.map((item) => {
					const isActive = isNavItemActive(pathname, item.to);

					return (
						<li key={item.to} className="flex-1">
							<Link
								to={item.to}
								aria-current={isActive ? "page" : undefined}
								aria-label={item.label}
								className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 no-underline"
							>
								<Icon
									icon={item.icon}
									size="md"
									color={isActive ? "accent" : "secondary"}
								/>
								<Text
									type="supporting"
									color={isActive ? "accent" : "secondary"}
									weight={isActive ? "semibold" : "normal"}
								>
									{item.shortLabel}
								</Text>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
