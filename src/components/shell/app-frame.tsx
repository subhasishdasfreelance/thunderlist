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
import { useTaskCopy } from "#/lib/use-task-copy";
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
 * the bars themselves are made translucent in `styles.css` — the top one only
 * once the page has scrolled.
 */
export function AppFrame({
	user,
	children,
}: {
	/**
	 * Whoever is signed in, or `null` on the login page.
	 *
	 * Signed out the frame keeps its bar — the mark, and the theme toggle, which
	 * is a property of the screen rather than of an account and so is the one
	 * control that still means something. Everything that needs data goes: the
	 * navigation, search, the account menu and the shortcuts, none of which have
	 * anything to act on yet.
	 */
	user: SignedInUser | null;
	children: ReactNode;
}) {
	const scheme = useColorScheme();
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	useTaskCopy();

	/*
	 * Two keys that work from anywhere.
	 *
	 * `?` opens the shortcuts, but not while typing: it is an ordinary character
	 * in a task, and a shortcut that eats one is worse than no shortcut.
	 *
	 * Ctrl+K opens search, and does work while typing — it is a chord, so it
	 * cannot be typed by accident, and wanting to search from inside a half
	 * written task is the normal case rather than the exception. Cmd+K too, for
	 * a Mac.
	 */
	useEffect(() => {
		function isTyping(target: EventTarget | null): boolean {
			return (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target instanceof HTMLInputElement ||
					target instanceof HTMLTextAreaElement)
			);
		}

		function handle(event: KeyboardEvent) {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setIsSearchOpen(true);
				return;
			}

			if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			if (isTyping(event.target)) return;

			event.preventDefault();
			setIsHelpOpen(true);
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, []);

	/*
	 * Whether the page has moved off the top.
	 *
	 * The top bar is clear at the top of the page and turns to glass once there
	 * is content passing under it; see "Glass navigation" in `styles.css`. Read
	 * once on mount too, because a reload can land part-way down the page.
	 */
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		function update() {
			setIsScrolled(window.scrollY > 0);
		}

		update();
		window.addEventListener("scroll", update, { passive: true });
		return () => window.removeEventListener("scroll", update);
	}, []);
	/*
	 * Two different "where are we".
	 *
	 * `location` is where the router is heading and updates the moment a link is
	 * clicked, which is what makes the nav item light up immediately. It is the
	 * wrong thing to animate on: while a page is still loading the old content is
	 * still on screen, so re-keying on it plays the arrival animation over the
	 * page being left. `resolvedLocation` is what is actually rendered, and that
	 * is what a screen's arrival should follow.
	 */
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const renderedPathname = useRouterState({
		select: (state) =>
			state.resolvedLocation?.pathname ?? state.location.pathname,
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
					data-scrolled={isScrolled}
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
									{user === null ? null : (
										<>
											<SaveIndicator />
											<IconButton
												label="Search"
												tooltip="Search (Ctrl+K)"
												variant="ghost"
												size="md"
												icon={
													<Search aria-hidden size={26} absoluteStrokeWidth />
												}
												onClick={() => setIsSearchOpen(true)}
											/>
											{/* A closed ring reads larger than the open magnifier
											   beside it, so it is drawn at 22 rather than 26; the
											   stroke stays 2px so it does not look thinner. */}
											<IconButton
												label="Shortcuts and help"
												tooltip="Shortcuts (?)"
												variant="ghost"
												size="md"
												icon={
													<CircleQuestionMark
														aria-hidden
														size={22}
														absoluteStrokeWidth
													/>
												}
												onClick={() => setIsHelpOpen(true)}
											/>
										</>
									)}
									<ThemeToggle />
									{user === null ? null : <UserMenu user={user} />}
								</HStack>
							}
						/>
					}
					sideNav={
						user === null ? undefined : (
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
						)
					}
				>
					{/*
					 * Bottom padding clears the mobile nav bar. The key is the path
					 * that is on screen, so the content is a new element on every
					 * screen and plays its arrival once it has actually arrived — and
					 * stays put when only the search params change.
					 */}
					<div
						key={renderedPathname}
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
