import { Avatar } from "@astryxdesign/core/Avatar";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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
				size: "sm",
				isIconOnly: true,
				icon: (
					<Avatar
						size="sm"
						name={user.name}
						src={user.image ?? undefined}
						tooltip={false}
					/>
				),
			}}
			items={[
				{ label: user.name, isDisabled: true },
				{ label: user.email, isDisabled: true },
				{ type: "divider" as const },
				{
					label: isSigningOut ? "Signing out…" : "Sign out",
					variant: "destructive" as const,
					isDisabled: isSigningOut,
					onClick: () => {
						void signOut();
					},
				},
			]}
		/>
	);
}
