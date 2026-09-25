import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { sendTeamMessageFn } from "#/functions/reminder.functions";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";
import { useTeam } from "#/lib/use-team";
import {
	type MessageRecipients,
	memberName,
	ROLE_LABELS,
	TEAM_ROLES,
	type TeamRole,
} from "#/schemas/team";

type Audience = MessageRecipients["kind"];

/** What the answer says: who took it, or that nobody could. */
function sentNote(people: number, devices: number): string {
	if (devices === 0) {
		return "Sent, but nobody it went to has notifications on yet.";
	}
	return `Sent to ${people} ${people === 1 ? "person" : "people"}, on ${devices} ${
		devices === 1 ? "device" : "devices"
	}.`;
}

/**
 * A message to people in the team being worked in, shown by their installed
 * app as a notification: everyone, everyone with one role, or one person.
 * Someone whose device is off gets it once it is back on.
 *
 * Only for the team's project managers; the server checks that too. The
 * dialog closes as soon as it is sent, and says who took it once the server
 * has answered.
 */
export function MessageDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const team = useTeam();
	const toast = useToast();
	const [audience, setAudience] = useState<Audience>("team");
	const [role, setRole] = useState<TeamRole>("collaborator");
	const [email, setEmail] = useState("");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");

	const members = team?.members ?? [];

	// A fresh message each time, to everyone.
	useEffect(() => {
		if (!isOpen) return;
		setAudience("team");
		setRole("collaborator");
		setEmail("");
		setTitle("");
		setBody("");
	}, [isOpen]);

	const to: MessageRecipients | null =
		audience === "team"
			? { kind: "team" }
			: audience === "role"
				? { kind: "role", role }
				: email === ""
					? null
					: { kind: "person", email };
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
						{ value: "person", label: "One person" },
					]}
					value={audience}
					onChange={(next) => setAudience(next as Audience)}
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
