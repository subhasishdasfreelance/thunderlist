import { Avatar } from "@astryxdesign/core/Avatar";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import type { SignedInUser } from "#/lib/auth.server";
import { authClient } from "#/lib/auth-client";

/**
 * Who you are signed in as, and the way out.
 *
 * The picture is Google's own, so the corner of the bar answers "which account
 * is this" at a glance — which matters on a machine where more than one person
 * signs in. Initials stand in while it loads or if the account has no picture.
 *
 * Signing out clears the cached queries as well as the session. They hold the
 * previous account's checklists, and the next person to sign in on this browser
 * must not be handed them from memory.
 */
export function UserMenu({ user }: { user: SignedInUser }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isSigningOut, setIsSigningOut] = useState(false);

	async function signOut() {
		setIsSigningOut(true);

		try {
			await authClient.signOut();
		} finally {
			queryClient.clear();
			// A router invalidation re-runs the root guard, which sees no session
			// and sends this browser to the login page.
			await router.invalidate();
		}
	}

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			hasChevron={false}
			button={{
				label: `Account: ${user.name}`,
				variant: "ghost",
				size: "md",
				isIconOnly: true,
				/*
				 * `xsm`, 20px, not the 26 of the icons beside it: a solid disc reads
				 * larger than a line drawing of the same size, so at 20 it sits level
				 * with the 22px help ring.
				 */
				icon: (
					<Avatar
						size="xsm"
						name={user.name}
						src={user.image ?? undefined}
						tooltip={false}
					/>
				),
			}}
			/*
			 * The account is a heading, not two disabled actions.
			 *
			 * Disabled is how a menu says "you cannot do this", and it is drawn that
			 * way — greyed almost into the background. Which account you are signed
			 * in as is not a thing you might have done, so as items the name and
			 * address were both mislabelled and nearly unreadable.
			 *
			 * Two sections instead: a title says what the section is about and is
			 * drawn to be read. Two of them keeps the name and the address on their
			 * own lines, which also keeps the menu the width of an address rather
			 * than the width of both at once.
			 */
			menuWidth={240}
			items={[
				{ type: "section" as const, title: user.name, items: [] },
				{
					type: "section" as const,
					title: user.email,
					items: [
						{
							label: isSigningOut ? "Signing out…" : "Sign out",
							icon: <LogOut aria-hidden />,
							variant: "destructive" as const,
							isDisabled: isSigningOut,
							onClick: () => {
								void signOut();
							},
						},
					],
				},
			]}
		/>
	);
}
