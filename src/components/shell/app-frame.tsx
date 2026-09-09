import { AppShell } from "@astryxdesign/core/AppShell";
import { IconButton } from "@astryxdesign/core/IconButton";
import { LinkProvider } from "@astryxdesign/core/Link";
import { SideNav, SideNavItem } from "@astryxdesign/core/SideNav";
import { HStack } from "@astryxdesign/core/Stack";
import { TopNav } from "@astryxdesign/core/TopNav";
import { Theme } from "@astryxdesign/core/theme";
import { useRouterState } from "@tanstack/react-router";
import { CircleQuestionMark, Search } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { SignedInUser } from "#/lib/auth.server";
import { useColorScheme } from "#/lib/theme";
import { thunderlistTheme } from "#/theme/thunderlist";
import { BottomNav } from "./bottom-nav";
import { BrandMark } from "./brand-mark";
import { HelpDialog } from "./help-dialog";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";
import { RouteProgress } from "./route-progress";
import { RouterLink } from "./router-link";
import { SaveIndicator } from "./save-indicator";
import { SearchDialog } from "./search-dialog";
import { SetupNotice } from "./setup-notice";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * The application frame: top bar, navigation and the content region.
 *
 * Navigation is side nav from `md` up and a bottom bar below it, so the phone
 * layout keeps every destination visible. AppShell's built-in mobile drawer is
 * switched off to avoid a second, redundant navigation surface.
 *
 * There is no `Theme` wrapper: the app uses Astryx's own palette, whose accent
 * is a strong blue with a neutral set designed around it. The `wash` variant
 * puts the page on a tinted ground so the white cards above it have an edge;
 * the bars themselves are made translucent in `styles.css`.
 */
export function AppFrame({
	user,
	children,
}: {
	/** Whoever is signed in. The frame is never rendered without one. */
	user: SignedInUser;
	children: ReactNode;
}) {
	const scheme = useColorScheme();
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);

	/*
	 * `?` opens the shortcuts, from anywhere.
	 *
	 * Not while typing: `?` is an ordinary character in a task, and a shortcut
	 * that eats one is worse than no shortcut.
	 */
	useEffect(() => {
		function handle(event: KeyboardEvent) {
			if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target instanceof HTMLInputElement ||
					target instanceof HTMLTextAreaElement)
			) {
				return;
			}

			event.preventDefault();
			setIsHelpOpen(true);
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, []);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		/*
		 * The theme wraps everything, so the seeds in `src/theme.ts` reach every
		 * component and the toggle's choice reaches the colour scheme. `mode` has
		 * to come through here: Theme writes `data-theme` on the root itself, so
		 * anything setting `color-scheme` alongside it would be overruled.
		 */
		<Theme theme={thunderlistTheme} mode={scheme}>
			<RouteProgress />
			<LinkProvider component={RouterLink}>
				<AppShell
					height="auto"
					variant="wash"
					contentPadding={0}
					mobileNav={false}
					topNav={
						<TopNav
							label="Thunderlist"
							heading={<BrandMark />}
							endContent={
								/* One size for every control in the bar. They read as a
								   set, so a stray default among them looks like a mistake. */
								<HStack gap={0.5} vAlign="center">
									<SaveIndicator />
									<IconButton
										label="Search"
										tooltip="Search"
										variant="ghost"
										size="sm"
										icon={<Search aria-hidden />}
										onClick={() => setIsSearchOpen(true)}
									/>
									<IconButton
										label="Shortcuts and help"
										tooltip="Shortcuts (?)"
										variant="ghost"
										size="sm"
										icon={<CircleQuestionMark aria-hidden />}
										onClick={() => setIsHelpOpen(true)}
									/>
									<ThemeToggle />
									<UserMenu user={user} />
								</HStack>
							}
						/>
					}
					sideNav={
						<SideNav>
							{NAV_ITEMS.map((item) => (
								<SideNavItem
									key={item.to}
									label={item.label}
									href={item.to}
									icon={item.icon}
									isSelected={isNavItemActive(pathname, item.to)}
								/>
							))}
						</SideNav>
					}
				>
					{/*
					 * Bottom padding clears the mobile nav bar. The key is the path,
					 * so the content is a new element on every screen and plays its
					 * arrival — and stays put when only the search params change.
					 */}
					<div
						key={pathname}
						className="thunderlist-screen thunderlist-container flex flex-col gap-4 pt-4 pb-28 md:pb-10"
					>
						<SetupNotice />
						{children}
					</div>
				</AppShell>

				<BottomNav />
				<SearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} />
				<HelpDialog isOpen={isHelpOpen} onOpenChange={setIsHelpOpen} />
			</LinkProvider>
		</Theme>
	);
}
