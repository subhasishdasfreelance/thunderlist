import { Icon } from "@astryxdesign/core/Icon";
import { Popover } from "@astryxdesign/core/Popover";
import { Text } from "@astryxdesign/core/Text";
import { Link, useRouterState } from "@tanstack/react-router";
import { Ellipsis, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { SPECIAL_TAG_ICONS } from "#/components/tags/special-tag-icons";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";

const ON_BAR = NAV_ITEMS.filter((item) => !item.isInMore);
const IN_MORE = NAV_ITEMS.filter((item) => item.isInMore);

const TODAY_PATH = "/tags/today";

/** One place on the bar: its mark over its short name, lit while it is the page. */
function BarLink({
	to,
	params,
	label,
	shortLabel,
	icon,
	isActive,
}: {
	to: string;
	params?: Record<string, string>;
	label: string;
	shortLabel: string;
	icon: LucideIcon;
	isActive: boolean;
}) {
	return (
		<li className="flex-1">
			<Link
				to={to}
				params={params}
				aria-current={isActive ? "page" : undefined}
				aria-label={label}
				className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 no-underline"
			>
				<Icon icon={icon} size="md" color={isActive ? "accent" : "secondary"} />
				<Text
					type="supporting"
					color={isActive ? "accent" : "secondary"}
					weight={isActive ? "semibold" : "normal"}
				>
					{shortLabel}
				</Text>
			</Link>
		</li>
	);
}

/**
 * Mobile primary navigation.
 *
 * AppShell's own mobile drawer is disabled in favour of this bar: a persistent
 * bottom row keeps the places visited most one thumb-tap away, which is what
 * the app is meant to feel like on a phone. Today leads it — it is where the
 * app opens and where anyone comes back to, and on a phone there is no "1" key
 * to press. The rest — Across lists, Trackers, Plans — open upwards from
 * "More", lit while one of them is the page. Hidden above 768px, where the
 * side nav shows every place; at exactly 768 the side nav is hidden too, so
 * this is what shows there.
 *
 * It shares the top bar's glass treatment, including its fallbacks: see
 * `.thunderlist-glass` in `styles.css`.
 */
export function BottomNav() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const isMoreActive = IN_MORE.some((item) =>
		isNavItemActive(pathname, item.to),
	);
	const isToday = pathname === TODAY_PATH;

	return (
		<nav
			aria-label="Primary"
			className="thunderlist-bottom-nav thunderlist-glass fixed inset-x-0 bottom-0 z-50 border-t border-border pb-[env(safe-area-inset-bottom)] min-[769px]:hidden"
		>
			<ul className="m-0 flex list-none justify-around p-0">
				<BarLink
					to="/tags/$tagId"
					params={{ tagId: "today" }}
					label="Today"
					shortLabel="Today"
					icon={SPECIAL_TAG_ICONS.today}
					isActive={isToday}
				/>
				{ON_BAR.map((item) => (
					<BarLink
						key={item.to}
						to={item.to}
						label={item.label}
						shortLabel={item.shortLabel}
						icon={item.icon}
						// Today is a tag, but it has its own place here.
						isActive={!isToday && isNavItemActive(pathname, item.to)}
					/>
				))}

				<li className="flex-1">
					<Popover
						isOpen={isMoreOpen}
						onOpenChange={setIsMoreOpen}
						placement="above"
						alignment="end"
						label="More places"
						content={
							<ul className="thunderlist-more-list m-0 flex min-w-44 list-none flex-col p-1">
								{IN_MORE.map((item) => {
									const isActive = isNavItemActive(pathname, item.to);

									return (
										<li key={item.to}>
											<Link
												to={item.to}
												aria-current={isActive ? "page" : undefined}
												className="thunderlist-more-link"
												data-active={isActive}
												onClick={() => setIsMoreOpen(false)}
											>
												<Icon
													icon={item.icon}
													size="sm"
													color={isActive ? "accent" : "secondary"}
												/>
												<Text
													color={isActive ? "accent" : "primary"}
													weight={isActive ? "semibold" : "normal"}
												>
													{item.label}
												</Text>
											</Link>
										</li>
									);
								})}
							</ul>
						}
					>
						{(trigger) => (
							<button
								{...trigger}
								type="button"
								aria-label="More places"
								className="flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1"
							>
								<Icon
									icon={Ellipsis}
									size="md"
									color={isMoreActive ? "accent" : "secondary"}
								/>
								<Text
									type="supporting"
									color={isMoreActive ? "accent" : "secondary"}
									weight={isMoreActive ? "semibold" : "normal"}
								>
									More
								</Text>
							</button>
						)}
					</Popover>
				</li>
			</ul>
		</nav>
	);
}
