import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { List, ListItem } from "@astryxdesign/core/List";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useToast } from "@astryxdesign/core/Toast";
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
import { useSpaceChanged } from "#/lib/use-space-changed";
import { queryKeys } from "#/queries/keys";
import {
	GRANTED_ROLES,
	type GrantedRole,
	memberName,
	ROLE_LABELS,
	ROLE_SUMMARIES,
	type TeamDetail,
	type TeamMember,
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
	 * One change to a team, then the teams read again — or, for one that takes
	 * this person out of the team they are working in, the move back to their
	 * own space.
	 */
	async function run(change: () => Promise<unknown>, isLeaving = false) {
		setIsBusy(true);

		try {
			await change();
			if (isLeaving) onClose();
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
			toast({ body: errorMessage(error), type: "error", uniqueID: "team" });
			return false;
		} finally {
			setIsBusy(false);
		}
	}

	async function add() {
		const address = email.trim();
		if (address === "" || isBusy) return;

		const isAdded = await run(() =>
			addMemberFn({ data: { teamId, email: address, role } }),
		);
		if (isAdded) setEmail("");
	}

	const tick = (isOn: boolean) =>
		isOn ? <Check aria-hidden size={16} /> : undefined;

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
					...GRANTED_ROLES.map((each) => ({
						id: each,
						label: ROLE_LABELS[each],
						description: ROLE_SUMMARIES[each],
						endContent: tick(member.role === each),
						onClick: () =>
							void run(() =>
								setMemberRoleFn({
									data: { teamId, email: member.email, role: each },
								}),
							),
					})),
					{ type: "divider" as const },
					...(member.role === "admin"
						? []
						: [
								{
									label: "Make admin…",
									description: "Hands the team over to them.",
									icon: <Crown aria-hidden />,
									onClick: () => setConfirming({ kind: "hand-over", member }),
								},
							]),
					{
						label: "Remove from team",
						icon: <UserMinus aria-hidden />,
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
						<div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
							<TextInput
								label="Add someone"
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
					void run(() => removeMemberFn({ data: { teamId, email: me } }), true);
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
					void run(() => deleteTeamFn({ data: { teamId } }), true);
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
					void run(() =>
						removeMemberFn({ data: { teamId, email: member.email } }),
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
					void run(() =>
						setMemberRoleFn({
							data: { teamId, email: member.email, role: "admin" },
						}),
					);
				}}
			/>
		</>
	);
}
