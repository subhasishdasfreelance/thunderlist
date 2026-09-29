import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ChevronRight,
	Crown,
	LogOut,
	Trash2,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import {
	addMemberFn,
	deleteTeamFn,
	removeMemberFn,
	setMemberRoleFn,
} from "#/functions/team.functions";
import { errorMessage } from "#/lib/errors";
import { playSound } from "#/lib/sounds";
import { useToast } from "#/lib/toasts";
import { useSpaceChanged } from "#/lib/use-space-changed";
import { queryKeys } from "#/queries/keys";
import {
	GRANTED_ROLES,
	type GrantedRole,
	memberName,
	ROLE_LABELS,
	ROLE_SUMMARIES,
	type SpaceView,
	type TeamDetail,
	type TeamMember,
	type TeamRole,
} from "#/schemas/team";
import { RoleToken } from "./role-token";
import { RolesGuide } from "./roles-guide";

/** Something that asks first, because it is hard to take back. */
type Confirming =
	| { kind: "leave" }
	| { kind: "delete" }
	| { kind: "remove"; member: TeamMember }
	| { kind: "hand-over"; member: TeamMember };

/**
 * One team, opened from its row on the Settings screen: who is in it and what
 * each of them is, and — for its admin — adding people, changing their roles,
 * taking them out, handing the team over and deleting it.
 *
 * A popup rather than the page, so the page stays a short list of teams however
 * many someone is in, and a team's people are there when asked for.
 *
 * People are added by the address their Google account signs in with, and can
 * be added before they have ever opened Thunderlist: the team is waiting for
 * them the first time they do.
 */
export function TeamDialog({
	team,
	isCurrent,
	me,
	onClose,
}: {
	/** The team open, or `null` for none — which closes it. */
	team: TeamDetail | null;
	/** Whether this browser is working in it now. */
	isCurrent: boolean;
	/** Who is looking, lower-cased. */
	me: string;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const spaceChanged = useSpaceChanged();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<GrantedRole>("collaborator");
	const [isBusy, setIsBusy] = useState(false);
	const [isGuideOpen, setIsGuideOpen] = useState(false);
	const [confirming, setConfirming] = useState<Confirming | null>(null);

	if (team === null) return null;

	const { teamId } = team;
	const isAdmin = team.role === "admin";

	/**
	 * One change to a team: drawn at once, like every change in the app, then
	 * sent, then the teams read again — or, for one that takes this person out
	 * of the team they are working in, the move back to their own space.
	 *
	 * `draw` is the team as it will be, or `null` for gone. Refused, the teams
	 * are put back exactly as they were.
	 */
	async function run(
		change: () => Promise<unknown>,
		draw: (team: TeamDetail) => TeamDetail | null,
		isLeaving = false,
	) {
		setIsBusy(true);
		await Promise.all([
			queryClient.cancelQueries({ queryKey: queryKeys.teams }),
			queryClient.cancelQueries({ queryKey: queryKeys.space }),
		]);
		const teamsBefore = queryClient.getQueryData<Array<TeamDetail>>(
			queryKeys.teams,
		);
		const spaceBefore = queryClient.getQueryData<SpaceView>(queryKeys.space);

		queryClient.setQueryData<Array<TeamDetail>>(queryKeys.teams, (teams) =>
			teams?.flatMap((each) => {
				if (each.teamId !== teamId) return [each];
				const drawn = draw(each);
				return drawn === null ? [] : [drawn];
			}),
		);
		queryClient.setQueryData<SpaceView>(queryKeys.space, (space) => {
			if (space === undefined) return space;
			const drawn =
				space.team?.teamId === teamId ? draw(space.team) : space.team;
			return {
				...space,
				team: drawn,
				teams: space.teams.flatMap((each) =>
					each.teamId !== teamId
						? [each]
						: drawn === null
							? []
							: [{ ...each, role: drawn.role }],
				),
			};
		});
		if (isLeaving) onClose();

		try {
			await change();
			if (isLeaving && isCurrent) {
				await spaceChanged();
			} else {
				await Promise.all([
					queryClient.invalidateQueries({ queryKey: queryKeys.teams }),
					queryClient.invalidateQueries({ queryKey: queryKeys.space }),
				]);
			}
			return true;
		} catch (error) {
			queryClient.setQueryData(queryKeys.teams, teamsBefore);
			queryClient.setQueryData(queryKeys.space, spaceBefore);
			toast({ body: errorMessage(error), type: "error", uniqueID: "team" });
			return false;
		} finally {
			setIsBusy(false);
		}
	}

	/** The team with one person's role changed. */
	const withRole =
		(email: string, role: TeamRole) =>
		(each: TeamDetail): TeamDetail => ({
			...each,
			members: each.members.map((member) =>
				member.email === email ? { ...member, role } : member,
			),
		});

	/** The team without one person — or gone, for the person looking. */
	const without =
		(email: string) =>
		(each: TeamDetail): TeamDetail | null =>
			email === me
				? null
				: {
						...each,
						members: each.members.filter((member) => member.email !== email),
					};

	async function add() {
		const address = email.trim();
		if (address === "" || isBusy) return;

		playSound("join");
		setEmail("");
		const isAdded = await run(
			() => addMemberFn({ data: { teamId, email: address, role } }),
			(each) => ({
				...each,
				members: each.members.some(
					(member) => member.email === address.toLowerCase(),
				)
					? each.members
					: [
							...each.members,
							{ email: address.toLowerCase(), name: null, image: null, role },
						],
			}),
		);
		// Refused, the address is back in the box to be put right.
		if (!isAdded) setEmail(address);
	}

	const tick = (isOn: boolean) =>
		isOn ? <Icon icon={Check} size="sm" color="accent" /> : undefined;

	/** What someone is, and — for the admin — the menu that changes it. */
	function roleControl(member: TeamMember) {
		if (!isAdmin || member.email === me)
			return <RoleToken role={member.role} />;

		return (
			<DropdownMenu
				placement="below"
				alignment="end"
				menuWidth={280}
				button={{
					label: ROLE_LABELS[member.role],
					variant: "ghost",
					size: "sm",
					isDisabled: isBusy,
				}}
				items={[
					{
						type: "section" as const,
						title: "Role",
						items: GRANTED_ROLES.map((each) => ({
							id: each,
							label: ROLE_LABELS[each],
							description: ROLE_SUMMARIES[each],
							endContent: tick(member.role === each),
							onClick: () => {
								playSound("role");
								void run(
									() =>
										setMemberRoleFn({
											data: { teamId, email: member.email, role: each },
										}),
									withRole(member.email, each),
								);
							},
						})),
					},
					{ type: "divider" as const },
					...(member.role === "admin"
						? []
						: [
								{
									label: "Make admin…",
									description: "Hands the team over to them.",
									icon: Crown,
									onClick: () => setConfirming({ kind: "hand-over", member }),
								},
							]),
					{
						label: "Remove from team",
						icon: UserMinus,
						variant: "destructive" as const,
						onClick: () => setConfirming({ kind: "remove", member }),
					},
				]}
			/>
		);
	}

	const peopleCount = `${team.members.length} ${
		team.members.length === 1 ? "person" : "people"
	}`;

	return (
		<>
			<FormDialog
				isOpen
				onOpenChange={(isOpen) => {
					if (!isOpen) onClose();
				}}
				title={team.name}
				subtitle={`${peopleCount} · You are ${
					isAdmin ? "the admin" : `a ${ROLE_LABELS[team.role].toLowerCase()}`
				}`}
				width={520}
				actions={() => (
					<HStack gap={2} hAlign="end">
						{/*
						 * The admin cannot leave — there would be nobody to run the team —
						 * so they hand it over from someone's role menu, or delete it.
						 */}
						{isAdmin ? (
							<Button
								label="Delete team"
								icon={<Trash2 aria-hidden />}
								variant="destructive"
								isDisabled={isBusy}
								onClick={() => setConfirming({ kind: "delete" })}
							/>
						) : (
							<Button
								label="Leave team"
								icon={<LogOut aria-hidden />}
								variant="secondary"
								isDisabled={isBusy}
								onClick={() => setConfirming({ kind: "leave" })}
							/>
						)}
						<Button label="Close" variant="ghost" onClick={onClose} />
					</HStack>
				)}
			>
				<VStack gap={4}>
					<List hasDividers>
						{team.members.map((member) => (
							<ListItem
								key={member.email}
								startContent={
									<Avatar
										size="md"
										name={memberName(member)}
										src={member.image ?? undefined}
										tooltip={false}
									/>
								}
								label={
									member.email === me
										? `${memberName(member)} (you)`
										: memberName(member)
								}
								description={
									member.name === null ? "Not signed in yet" : member.email
								}
								endContent={roleControl(member)}
							/>
						))}
					</List>

					{isAdmin ? (
						<VStack gap={1}>
							{/*
							 * Adding someone hands them nothing: a role is the most they
							 * could ever do, and what they actually see is whatever they
							 * have been put on. Said here, because "I added them and they
							 * see nothing" is otherwise a bug report.
							 */}
							<Text type="supporting">
								Someone added sees nothing until they are put on a checklist, a
								tracker or a tag — press the faces at the top of one to put them
								on it. Viewers see everything.
							</Text>
							<div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
								<TextInput
									label="Add someone"
									// The one field in the app where the browser knowing an
									// address is the point, so it is told which kind it is
									// rather than told to keep quiet; see
									// `src/types/astryx-autofill.d.ts`.
									autoComplete="email"
									description="The address their Google account signs in with."
									placeholder="name@example.com"
									value={email}
									onChange={setEmail}
									onEnter={() => void add()}
									width="100%"
								/>
								<Selector
									label="As"
									options={GRANTED_ROLES.map((each) => ({
										value: each,
										label: ROLE_LABELS[each],
									}))}
									value={role}
									onChange={(next) => setRole(next as GrantedRole)}
								/>
								<Button
									label="Add"
									icon={<UserPlus aria-hidden />}
									variant="primary"
									isDisabled={email.trim() === "" || isBusy}
									onClick={() => void add()}
								/>
							</div>
						</VStack>
					) : null}

					{/* Folded: it is for the occasional question, not every visit. */}
					<VStack gap={2}>
						<HStack hAlign="start">
							<button
								type="button"
								className="thunderlist-disclosure"
								aria-expanded={isGuideOpen}
								onClick={() => setIsGuideOpen(!isGuideOpen)}
							>
								<ChevronRight
									aria-hidden
									size={16}
									className="thunderlist-disclosure-chevron"
								/>
								<Text type="label" weight="semibold" color="secondary">
									What each role can do
								</Text>
							</button>
						</HStack>
						{isGuideOpen ? <RolesGuide /> : null}
					</VStack>
				</VStack>
			</FormDialog>

			<AlertDialog
				isOpen={confirming?.kind === "leave"}
				onOpenChange={(isOpen) => {
					if (!isOpen) setConfirming(null);
				}}
				title={`Leave ${team.name}?`}
				description="You will stop seeing its checklists, tags and trackers. The admin can add you back."
				actionLabel="Leave"
				onAction={() => {
					setConfirming(null);
					playSound("delete");
					void run(
						() => removeMemberFn({ data: { teamId, email: me } }),
						without(me),
						true,
					);
				}}
			/>

			<AlertDialog
				isOpen={confirming?.kind === "delete"}
				onOpenChange={(isOpen) => {
					if (!isOpen) setConfirming(null);
				}}
				title={`Delete ${team.name}?`}
				description="Every checklist, task, tag, tracker and task type in it will be deleted, for everyone in the team."
				actionLabel="Delete"
				onAction={() => {
					setConfirming(null);
					playSound("delete");
					void run(
						() => deleteTeamFn({ data: { teamId } }),
						() => null,
						true,
					);
				}}
			/>

			<AlertDialog
				isOpen={confirming?.kind === "remove"}
				onOpenChange={(isOpen) => {
					if (!isOpen) setConfirming(null);
				}}
				title={
					confirming?.kind === "remove"
						? `Remove ${memberName(confirming.member)} from ${team.name}?`
						: ""
				}
				description="They will stop seeing the team's work. Anything assigned to them stays assigned until someone changes it."
				actionLabel="Remove"
				onAction={() => {
					if (confirming?.kind !== "remove") return;
					const { member } = confirming;
					setConfirming(null);
					playSound("delete");
					void run(
						() => removeMemberFn({ data: { teamId, email: member.email } }),
						without(member.email),
					);
				}}
			/>

			<AlertDialog
				isOpen={confirming?.kind === "hand-over"}
				onOpenChange={(isOpen) => {
					if (!isOpen) setConfirming(null);
				}}
				title={
					confirming?.kind === "hand-over"
						? `Make ${memberName(confirming.member)} the admin?`
						: ""
				}
				description="A team has one admin. They will add and remove people, change roles and be able to delete the team — and you will become a project manager."
				actionLabel="Make admin"
				onAction={() => {
					if (confirming?.kind !== "hand-over") return;
					const { member } = confirming;
					setConfirming(null);
					playSound("role");
					// The admin hands over: they are admin now, and this person a
					// project manager; see `setMemberRole`.
					void run(
						() =>
							setMemberRoleFn({
								data: { teamId, email: member.email, role: "admin" },
							}),
						(each) => ({
							...withRole(me, "manager")(withRole(member.email, "admin")(each)),
							role: "manager",
						}),
					);
				}}
			/>
		</>
	);
}
