import { Avatar } from "@astryxdesign/core/Avatar";
import {
	DropdownMenu,
	DropdownMenuDivider,
	DropdownMenuItem,
} from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut, MessageSquare, Settings, Users } from "lucide-react";
import { useState } from "react";
import { RoleToken } from "#/components/teams/role-token";
import type { SignedInUser } from "#/lib/auth.server";
import { authClient } from "#/lib/auth-client";
import { useSpace } from "#/lib/use-team";
import { FeedbackDialog } from "./feedback-dialog";

/**
 * Who you are signed in as, and the way out.
 *
 * The picture is Google's own, so the corner of the bar answers "which account
 * is this" at a glance — which matters on a machine where more than one person
 * signs in. Initials stand in while it loads or if the account has no picture.
 *
 * Opened, the menu leads with the account itself — a large face, the name, the
 * address, and what you are where you are working — on a wash of the accent,
 * so it reads as the menu's heading rather than as something to press. Below
 * it, Settings and feedback, then signing out on its own, where it is not
 * pressed by accident. Moving between spaces, and everything about teams, is
 * in Settings.
 *
 * Signing out clears the cached queries as well as the session. They hold the
 * previous account's checklists, and the next person to sign in on this browser
 * must not be handed them from memory.
 */
export function UserMenu({ user }: { user: SignedInUser }) {
	const router = useRouter();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const space = useSpace();
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

	const team = space?.team ?? null;

	async function signOut() {
		setIsSigningOut(true);

		try {
			await authClient.signOut();
		} finally {
			queryClient.clear();
			// The installed app keeps a copy of Today to open on, and that copy is
			// this account's; see `public/sw.js`.
			if ("caches" in window) void caches.delete("thunderlist-pages-v1");
			// A router invalidation re-runs the root guard, which sees no session
			// and sends this browser to the login page.
			await router.invalidate();
		}
	}

	return (
		<>
			{/*
			 * Which team this is, in the bar, so work is never put in the wrong
			 * one by mistake. Not on a phone, whose bar has no room for it; the
			 * menu still says.
			 */}
			{team === null ? null : (
				<span className="hidden sm:inline-flex">
					<Token
						size="sm"
						label={team.name}
						icon={<Icon icon={Users} size="xsm" />}
					/>
				</span>
			)}

			<DropdownMenu
				placement="below"
				alignment="end"
				hasChevron={false}
				menuWidth={300}
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
			>
				<div className="thunderlist-account-card">
					<Avatar
						size="lg"
						name={user.name}
						src={user.image ?? undefined}
						tooltip={false}
					/>
					<VStack gap={0.5}>
						<VStack gap={0}>
							<Text weight="semibold" maxLines={1}>
								{user.name}
							</Text>
							<Text type="supporting" maxLines={1}>
								{user.email}
							</Text>
						</VStack>
						{/* What they are where they are working, so it is never guessed. */}
						<HStack gap={1.5} vAlign="center">
							{team === null ? (
								<Token size="sm" label="Personal" />
							) : (
								<>
									<RoleToken role={team.role} />
									<Text type="supporting" color="secondary" maxLines={1}>
										in {team.name}
									</Text>
								</>
							)}
						</HStack>
					</VStack>
				</div>

				<DropdownMenuItem
					icon={Settings}
					label="Settings"
					description="Your account, and where you work"
					onClick={() => void navigate({ to: "/settings" })}
				/>
				<DropdownMenuItem
					icon={MessageSquare}
					label="Send feedback…"
					onClick={() => setIsFeedbackOpen(true)}
				/>

				<DropdownMenuDivider />
				<DropdownMenuItem
					icon={LogOut}
					label={isSigningOut ? "Signing out…" : "Sign out"}
					variant="destructive"
					isDisabled={isSigningOut}
					onClick={() => void signOut()}
				/>
			</DropdownMenu>

			<FeedbackDialog
				isOpen={isFeedbackOpen}
				onOpenChange={setIsFeedbackOpen}
			/>
		</>
	);
}
