import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { type ColorScheme, setColorScheme, useColorScheme } from "#/lib/theme";

const OPTIONS: Array<{
	scheme: ColorScheme;
	label: string;
	icon: typeof Sun;
}> = [
	{ scheme: "light", label: "Light", icon: Sun },
	{ scheme: "dark", label: "Dark", icon: Moon },
	{ scheme: "system", label: "Match system", icon: Monitor },
];

/**
 * Light, dark, or follow the machine.
 *
 * Three choices rather than a two-way switch, because "follow the machine" is
 * a real preference and not the same as picking whichever one it happens to be
 * right now: a laptop that goes dark at sunset should take the app with it.
 *
 * The icon shows what is in force, so the control reads as state rather than
 * as an action.
 */
export function ThemeToggle() {
	const scheme = useColorScheme();
	const active =
		OPTIONS.find((option) => option.scheme === scheme) ?? OPTIONS[2];
	const ActiveIcon = active.icon;

	return (
		<DropdownMenu
			hasChevron={false}
			placement="below"
			alignment="end"
			button={{
				label: `Theme: ${active.label}`,
				tooltip: "Theme",
				variant: "ghost",
				size: "sm",
				isIconOnly: true,
				// Keyed so the icon re-mounts and cross-fades when the scheme changes.
				icon: (
					<span key={scheme} className="thunderlist-swap">
						<ActiveIcon aria-hidden />
					</span>
				),
			}}
			items={OPTIONS.map((option) => ({
				label: option.label,
				icon: <option.icon aria-hidden />,
				// The tick says which one is in force; the menu is a choice, not
				// three separate actions.
				endContent:
					option.scheme === scheme ? (
						<Icon icon={Check} size="sm" color="accent" />
					) : undefined,
				onClick: () => setColorScheme(option.scheme),
			}))}
		/>
	);
}
