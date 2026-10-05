import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { useQuery } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { TextArea, TextInput } from "#/components/common/text-fields";
import { sendTeamMessageFn } from "#/functions/reminder.functions";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";
import { useTeam } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import {
	type MessageRecipients,
	memberName,
	ROLE_LABELS,
	TEAM_ROLES,
	type TeamRole,
} from "#/schemas/team";

type Audience = MessageRecipients["kind"];

/** Something whose people a message can be sent to, and is opened from. */
export type MessagedItem = Extract<
	MessageRecipients,
	{ kind: "checklist" | "tag" | "tracker" }
>;

/** Its id, whichever of the three it is. */
function idOf(item: MessagedItem): string {
	return item.kind === "checklist"
		? item.checklistId
		: item.kind === "tag"
			? item.tagId
			: item.trackerId;
}

/** What the answer says: who took it, or that nobody could. */
export function sentNote(people: number, devices: number): string {
	if (devices === 0) {
		return "Sent, but nobody it went to has notifications on yet.";
	}
	return `Sent to ${people} ${people === 1 ? "person" : "people"}, on ${devices} ${
		devices === 1 ? "device" : "devices"
	}.`;
}

/**
 * A message to people in the team being worked in, shown by their installed
 * app as a notification: everyone, everyone with one role, everyone who can
 * see one checklist, tag or tracker, or one person. Opened from one of those,
 * it starts addressed to its people.
 * Someone whose device is off gets it once it is back on.
 *
 * Only for the team's project managers; the server checks that too. The
 * dialog closes as soon as it is sent, and says who took it once the server
 * has answered.
 */
export function MessageDialog({
	isOpen,
	onOpenChange,
	from,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** What it is opened from, whose people it starts addressed to. */
	from?: MessagedItem;
}) {
	const team = useTeam();
	const toast = useToast();
	const [audience, setAudience] = useState<Audience>("team");
	const [role, setRole] = useState<TeamRole>("collaborator");
	const [email, setEmail] = useState("");
	// The checklist, tag or tracker picked for each of those audiences.
	const [itemId, setItemId] = useState("");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");

	const members = team?.members ?? [];
	const checklists = useQuery({
		...checklistsQuery(),
		enabled: isOpen && audience === "checklist",
	}).data;
	const tags = useQuery({
		...tagsQuery(),
		enabled: isOpen && audience === "tag",
	}).data;
	const trackers = useQuery({
		...trackersQuery(),
		enabled: isOpen && audience === "tracker",
	}).data;

	// A fresh message each time, to everyone — or to what it is opened from.
	const fromKind = from?.kind;
	const fromId = from === undefined ? undefined : idOf(from);
	useEffect(() => {
		if (!isOpen) return;
		setAudience(fromKind ?? "team");
		setRole("collaborator");
		setEmail("");
		setItemId(fromId ?? "");
		setTitle("");
		setBody("");
	}, [isOpen, fromKind, fromId]);

	const to: MessageRecipients | null =
		audience === "team"
			? { kind: "team" }
			: audience === "role"
				? { kind: "role", role }
				: audience === "person"
					? email === ""
						? null
						: { kind: "person", email }
					: itemId === ""
						? null
						: audience === "checklist"
							? { kind: "checklist", checklistId: itemId }
							: audience === "tag"
								? { kind: "tag", tagId: itemId }
								: { kind: "tracker", trackerId: itemId };
	const canSend = to !== null && title.trim() !== "" && body.trim() !== "";

	function send() {
		if (!canSend || to === null) return;
		onOpenChange(false);

		sendTeamMessageFn({ data: { to, title, body } })
			.then(({ people, devices }) =>
				toast({
					body: sentNote(people, devices),
					type: "info",
					uniqueID: "team-message",
				}),
			)
			.catch((error) =>
				toast({
					body: errorMessage(error),
					type: "error",
					uniqueID: "team-message",
				}),
			);
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Message the team"
			subtitle="A notification in the installed app, for everyone who has them on."
			width={480}
			actions={() => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Send"
						icon={<Send aria-hidden />}
						variant="primary"
						isDisabled={!canSend}
						onClick={send}
					/>
				</HStack>
			)}
		>
			<VStack gap={3}>
				<Selector
					label="To"
					options={[
						{ value: "team", label: `Everyone in ${team?.name ?? "the team"}` },
						{ value: "role", label: "Everyone with a role" },
						{ value: "checklist", label: "Everyone on a checklist" },
						{ value: "tag", label: "Everyone on a tag" },
						{ value: "tracker", label: "Everyone on a tracker" },
						{ value: "person", label: "One person" },
					]}
					value={audience}
					onChange={(next) => {
						setAudience(next as Audience);
						// A checklist's id names no tag, so the pick starts again.
						setItemId("");
					}}
				/>
				{audience === "role" ? (
					<Selector
						label="Role"
						options={TEAM_ROLES.map((each) => ({
							value: each,
							label: ROLE_LABELS[each],
						}))}
						value={role}
						onChange={(next) => setRole(next as TeamRole)}
					/>
				) : null}
				{audience === "checklist" ? (
					<Selector
						label="Checklist"
						placeholder="Pick a checklist"
						options={(checklists ?? []).map((checklist) => ({
							value: checklist.checklistId,
							label: checklist.title,
						}))}
						value={itemId}
						onChange={setItemId}
					/>
				) : null}
				{audience === "tag" ? (
					<Selector
						label="Tag"
						placeholder="Pick a tag"
						options={(tags ?? []).map((tag) => ({
							value: tag.tagId,
							label: `#${tag.name}`,
						}))}
						value={itemId}
						onChange={setItemId}
					/>
				) : null}
				{audience === "tracker" ? (
					<Selector
						label="Tracker"
						placeholder="Pick a tracker"
						options={(trackers ?? []).map((tracker) => ({
							value: tracker.trackerId,
							label: tracker.title,
						}))}
						value={itemId}
						onChange={setItemId}
					/>
				) : null}
				{audience === "person" ? (
					<Selector
						label="Person"
						placeholder="Pick someone"
						options={members.map((member) => ({
							value: member.email,
							label: memberName(member),
						}))}
						value={email}
						onChange={setEmail}
					/>
				) : null}
				<TextInput
					autoComplete="off"
					label="Title"
					isRequired
					value={title}
					onChange={setTitle}
					placeholder="Standup moved"
				/>
				<TextArea
					autoComplete="off"
					label="Message"
					isRequired
					rows={4}
					value={body}
					onChange={setBody}
					placeholder="We meet at 11 today instead of 10."
					width="100%"
				/>
			</VStack>
		</FormDialog>
	);
}
