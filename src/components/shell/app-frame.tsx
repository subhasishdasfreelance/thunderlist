import { AppShell } from "@astryxdesign/core/AppShell";
import { IconButton } from "@astryxdesign/core/IconButton";
import { LinkProvider } from "@astryxdesign/core/Link";
import { SideNav, SideNavItem } from "@astryxdesign/core/SideNav";
import { TopNav } from "@astryxdesign/core/TopNav";
import { useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { PendingButton } from "#/components/pending/pending-button";
import { BottomNav } from "./bottom-nav";
import { BrandMark } from "./brand-mark";
import { isNavItemActive, NAV_ITEMS } from "./nav-items";
import { RouterLink } from "./router-link";
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
export function AppFrame({ children }: { children: ReactNode }) {
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
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
							<span className="flex items-center gap-1">
								<PendingButton />
								<IconButton
									label="Search"
									tooltip="Search"
									variant="ghost"
									icon={<Search aria-hidden />}
									onClick={() => setIsSearchOpen(true)}
								/>
								<ThemeToggle />
								<UserMenu />
							</span>
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
				{/* Bottom padding clears the mobile nav bar. */}
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 pb-28 md:px-6 md:pb-10">
					<SetupNotice />
					{children}
				</div>
			</AppShell>

			<BottomNav />
			<SearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} />
		</LinkProvider>
	);
}
