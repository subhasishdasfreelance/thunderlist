import { Avatar } from "@astryxdesign/core/Avatar";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";

/**
 * Avatar menu in the top bar.
 *
 * Holds the manual refresh, which matters because the same database can be
 * changed from another device or tab: it refetches everything on the client.
 */
export function UserMenu() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: session } = authClient.useSession();
	const [isRefreshing, setIsRefreshing] = useState(false);

	const name = session?.user?.name ?? null;

	async function refresh() {
		setIsRefreshing(true);
		try {
			await queryClient.invalidateQueries();
		} finally {
			setIsRefreshing(false);
		}
	}

	const items = [
		{
			label: isRefreshing ? "Refreshing…" : "Refresh",
			onClick: () => {
				void refresh();
			},
			isDisabled: isRefreshing,
		},
		{
			label: "Keyboard shortcuts",
			onClick: () => {
				void navigate({ to: "/shortcuts" });
			},
		},
		...(session?.user
			? [
					{ type: "divider" as const },
					{
						label: "Sign out",
						variant: "destructive" as const,
						onClick: () => {
							void authClient.signOut();
						},
					},
				]
			: []),
	];

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			hasChevron={false}
			button={{
				label: name ? `Account: ${name}` : "Account",
				variant: "ghost",
				isIconOnly: true,
				icon: <Avatar size="sm" name={name ?? undefined} tooltip={false} />,
			}}
			items={items}
		/>
	);
}
