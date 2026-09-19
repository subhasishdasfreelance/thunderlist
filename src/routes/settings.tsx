import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useToast } from "@astryxdesign/core/Toast";
import { Token } from "@astryxdesign/core/Token";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Plus, Shapes, User, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ErrorNotice } from "#/components/common/states";
import { TaskTypesDialog } from "#/components/tasks/task-types-dialog";
import { NewTeamDialog } from "#/components/teams/new-team-dialog";
import { RoleToken } from "#/components/teams/role-token";
import { TeamDialog } from "#/components/teams/team-dialog";
import { selectSpaceFn } from "#/functions/team.functions";
import { errorMessage } from "#/lib/errors";
import { useSpaceChanged } from "#/lib/use-space-changed";
import { useTaskTypes } from "#/lib/use-task-types";
import { usePermissions, useSpace } from "#/lib/use-team";
import { primeQuery } from "#/queries/prime";
import { taskTypesQuery, teamsQuery } from "#/queries/space";

export const Route = createFileRoute("/settings")({
	loader: ({ context }) => {
		// The types are a short read and the section draws from them directly.
		void context.queryClient.prefetchQuery(taskTypesQuery());
		return primeQuery(context.queryClient, teamsQuery());
	},
	component: SettingsPage,
});

/** One part of the screen: a heading, what it is for, and the thing itself. */
function Section({
	title,
	description,
	action,
	children,
}: {
	title: string;
	description: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section>
			<VStack gap={3}>
				<HStack gap={2} hAlign="between" vAlign="end" wrap="wrap">
					<VStack gap={0.5}>
						<Heading level={2}>{title}</Heading>
						<Text type="supporting">{description}</Text>
					</VStack>
					{action}
				</HStack>
				{children}
			</VStack>
		</section>
	);
}

/**
 * What is about you: your account, and the spaces you work in — your own, and
 * each team you are in.
 *
 * The teams are a short list — each one's name, what you are in it and how
 * many people it has — however many there are. Everything else about a team,
 * its people and their roles, opens in a popup from its row, so this screen
 * stays one glance long. This is also where you move between spaces.
 *
 * Task types are here too, because they are not about one checklist the way
 * stages are: a space has one list of them and every task in it is sorted by
 * that list. So they belong with the space, which is what this screen is
 * about. They are shown as the chips they are drawn as, and changed in a
 * popup, the way a team's people are.
 */
function SettingsPage() {
	const { user } = Route.useRouteContext();
	const space = useSpace();
	const toast = useToast();
	const spaceChanged = useSpaceChanged();
	const teamsResult = useQuery(teamsQuery());
	const types = useTaskTypes();
	const { canManageContent } = usePermissions();
	const [isCreating, setIsCreating] = useState(false);
	const [isManagingTypes, setIsManagingTypes] = useState(false);
	const [openTeamId, setOpenTeamId] = useState<string | null>(null);
	// The space being moved into, while the move is on its way.
	const [movingTo, setMovingTo] = useState<string | null | undefined>(
		undefined,
	);

	const teams = teamsResult.data ?? [];
	const here = space?.team?.teamId ?? null;
	const openTeam = teams.find((team) => team.teamId === openTeamId) ?? null;

	/** Work in a team, or — with `null` — in your own space; see `useSpaceChanged`. */
	async function workIn(teamId: string | null) {
		if (teamId === here || movingTo !== undefined) return;
		setMovingTo(teamId);

		try {
			await selectSpaceFn({ data: { teamId } });
			await spaceChanged();
		} catch (error) {
			toast({ body: errorMessage(error), type: "error", uniqueID: "space" });
		} finally {
			setMovingTo(undefined);
		}
	}

	/** Where a row's space stands: worked in now, or a button to move there. */
	function workHere(teamId: string | null, name: string) {
		return teamId === here ? (
			<Token size="sm" color="blue" label="Working here" />
		) : (
			<Button
				label="Work here"
				aria-label={`Work in ${name}`}
				variant="secondary"
				size="sm"
				isLoading={movingTo === teamId}
				isDisabled={movingTo !== undefined && movingTo !== teamId}
				onClick={() => void workIn(teamId)}
			/>
		);
	}

	return (
		<VStack gap={6}>
			<VStack gap={0.5}>
				<Heading level={1}>Settings</Heading>
				<Text color="secondary">Your account, and where you work.</Text>
			</VStack>

			{user === null ? null : (
				<Section
					title="Account"
					description="Signed in with Google. Your name and picture come from there."
				>
					<Card padding={4}>
						<HStack gap={3} vAlign="center">
							<Avatar
								size={64}
								name={user.name}
								src={user.image ?? undefined}
								tooltip={false}
							/>
							<VStack gap={0.5}>
								<Text type="large" weight="semibold">
									{user.name}
								</Text>
								<Text color="secondary">{user.email}</Text>
							</VStack>
						</HStack>
					</Card>
				</Section>
			)}

			<Section
				title="Where you work"
				description="Your own space, and each team you are in — a space of its own, shared with its people. Open a team to see who is in it."
				action={
					<Button
						label="New team"
						icon={<Plus aria-hidden />}
						variant="secondary"
						onClick={() => setIsCreating(true)}
					/>
				}
			>
				{teamsResult.isError ? (
					<ErrorNotice
						error={teamsResult.error}
						onRetry={() => void teamsResult.refetch()}
					/>
				) : teamsResult.data === undefined ? (
					<SectionSpinner label="Loading teams…" />
				) : (
					<Card padding={0}>
						<List hasDividers>
							<ListItem
								startContent={<Icon icon={User} color="secondary" />}
								label="Personal"
								description="Just you"
								endContent={workHere(null, "your own space")}
							/>
							{teams.map((team) => (
								<ListItem
									key={team.teamId}
									startContent={<Icon icon={Users} color="secondary" />}
									label={team.name}
									description={`${team.members.length} ${
										team.members.length === 1 ? "person" : "people"
									}`}
									endContent={
										<HStack gap={1.5} vAlign="center">
											<RoleToken role={team.role} />
											{workHere(team.teamId, team.name)}
											<IconButton
												label={`Open ${team.name}`}
												tooltip="People and roles"
												icon={<ChevronRight aria-hidden />}
												variant="ghost"
												size="sm"
												onClick={() => setOpenTeamId(team.teamId)}
											/>
										</HStack>
									}
								/>
							))}
						</List>
					</Card>
				)}
			</Section>

			<Section
				title="Task types"
				description={`The kinds of work tasks in ${
					space?.team?.name ?? "your own space"
				} are sorted into — a bug, a feature, a chore. One list, shared by everyone here.`}
				action={
					!canManageContent ? undefined : (
						<Button
							label="Manage types"
							icon={<Shapes aria-hidden />}
							variant="secondary"
							onClick={() => setIsManagingTypes(true)}
						/>
					)
				}
			>
				<Card padding={4}>
					{types.length === 0 ? (
						<Text type="supporting">
							{canManageContent
								? "No types yet. Add one, and tasks can be marked with it."
								: "This space has no task types."}
						</Text>
					) : (
						<HStack gap={1.5} wrap="wrap">
							{types.map((type) => (
								<Token
									key={type.typeId}
									size="sm"
									color={type.color}
									label={type.name}
								/>
							))}
						</HStack>
					)}
				</Card>
			</Section>

			<TaskTypesDialog
				isOpen={isManagingTypes}
				onOpenChange={setIsManagingTypes}
			/>

			<TeamDialog
				team={openTeam}
				isCurrent={openTeam !== null && openTeam.teamId === here}
				me={space?.email ?? ""}
				onClose={() => setOpenTeamId(null)}
			/>
			<NewTeamDialog isOpen={isCreating} onOpenChange={setIsCreating} />
		</VStack>
	);
}
