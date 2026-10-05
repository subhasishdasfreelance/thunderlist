import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { KeyRound, Send, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { TextInput } from "#/components/common/text-fields";
import { PeopleField } from "#/components/teams/people-field";
import { createNotificationCode } from "#/lib/ids";
import { canPush, currentSubscription } from "#/lib/push";
import { useSpace } from "#/lib/use-team";
import type {
	CodeKind,
	CodeRecipients,
	CreateNotificationCodeInput,
	NotificationCode,
} from "#/schemas/notification-code";
import { SendNotificationDialog } from "./notification-send-dialog";

/**
 * Make a notification code: a name for it, and who it notifies — this device,
 * the people picked on all their devices, or the whole team. In your own
 * space the only person is you, and there is no team.
 *
 * It closes as soon as it is made; the code opens straight after, to copy.
 */
export function NewCodeDialog({
	isOpen,
	onOpenChange,
	onCreate,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	onCreate: (input: CreateNotificationCodeInput) => void;
}) {
	const space = useSpace();
	const team = space?.team ?? null;
	const me = space?.email ?? "";
	const [label, setLabel] = useState("");
	const [kind, setKind] = useState<CodeKind>("people");
	const [emails, setEmails] = useState<Array<string>>([]);
	// This device's subscription: `undefined` while it is being read.
	const [endpoint, setEndpoint] = useState<string | null | undefined>();

	// A fresh code each time: to the team, where there is one, or to you.
	useEffect(() => {
		if (!isOpen) return;
		setLabel("");
		setKind(team === null ? "people" : "team");
		setEmails([]);
		setEndpoint(undefined);
		void currentSubscription().then((subscription) =>
			setEndpoint(subscription?.endpoint ?? null),
		);
	}, [isOpen, team]);

	const to: CodeRecipients | null =
		kind === "device"
			? endpoint == null
				? null
				: { kind: "device", endpoint }
			: kind === "team"
				? { kind: "team" }
				: team === null
					? { kind: "people", emails: [me] }
					: emails.length === 0
						? null
						: { kind: "people", emails };
	const canCreate = to !== null && label.trim() !== "";

	function create() {
		if (!canCreate || to === null) return;
		onCreate({ code: createNotificationCode(), label: label.trim(), to });
		onOpenChange(false);
	}

	const deviceNote =
		endpoint === undefined
			? "Checking this device…"
			: endpoint !== null
				? "This browser, and nothing else — the machine you are at now."
				: canPush()
					? "Turn notifications on for this device above first."
					: "This browser can't show notifications.";

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="New notification code"
			subtitle="Anything that holds it can notify whoever it is for."
			width={480}
			onSubmit={(event) => {
				event.preventDefault();
				create();
			}}
			actions={(formId) => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Make code"
						icon={<KeyRound aria-hidden />}
						variant="primary"
						type="submit"
						form={formId}
						isDisabled={!canCreate}
					/>
				</HStack>
			)}
		>
			<VStack gap={3}>
				<TextInput
					autoComplete="off"
					label="Name"
					description="What it is for, so you know it again."
					isRequired
					value={label}
					onChange={setLabel}
					placeholder="Deploy alerts"
				/>
				<RadioList
					label="Notifies"
					value={kind}
					onChange={(next) => setKind(next as CodeKind)}
				>
					<RadioListItem
						value="device"
						label="Only this device"
						description={deviceNote}
						isDisabled={endpoint == null}
					/>
					<RadioListItem
						value="people"
						label={team === null ? "You, everywhere" : "Specific people"}
						description={
							team === null
								? "Every device you have turned notifications on for."
								: "The people you pick, on every device they have turned notifications on for."
						}
					/>
					{team === null ? null : (
						<RadioListItem
							value="team"
							label={`Everyone in ${team.name}`}
							description="Whoever is in the team when it is used, on all their devices."
						/>
					)}
				</RadioList>
				{kind === "people" && team !== null ? (
					<PeopleField
						label="People"
						members={team.members}
						value={emails}
						onChange={setEmails}
					/>
				) : null}
			</VStack>
		</FormDialog>
	);
}

/** How to send with a code, from anywhere that can make a web request. */
function fetchExample(code: string): string {
	const origin =
		typeof window === "undefined" ? "https://your-app" : window.location.origin;
	return `await fetch("${origin}/api/notify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    code: "${code}",
    title: "Deploy finished",            // required
    body: "main is live in production.", // optional
    image: "https://example.com/a.png",  // optional, shown large
    url: "/tags/today",                  // optional, opened on tap
  }),
});
// 200 { people, devices } — how many took it
// 400 / 403 / 404 { error } — why not`;
}

/**
 * One code, opened from its row: who it notifies, the code to copy, and how to
 * send with it — from a script, or from here; see `SendNotificationDialog`.
 * Deleting it asks first, since whatever still sends with it stops working.
 */
export function CodeDialog({
	code,
	recipient,
	onClose,
	onDelete,
}: {
	code: NotificationCode | null;
	/** Who it notifies, to go mid-sentence: "everyone in Acme". */
	recipient: string;
	onClose: () => void;
	onDelete: (code: string) => void;
}) {
	const [isSending, setIsSending] = useState(false);
	const [isConfirming, setIsConfirming] = useState(false);

	return (
		<>
			<FormDialog
				isOpen={code !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) onClose();
				}}
				title={code?.label ?? ""}
				subtitle={`Notifies ${recipient}.`}
				width={600}
				actions={() =>
					code === null ? null : (
						<HStack gap={2} hAlign="between" wrap="wrap" width="100%">
							<Button
								label="Delete"
								icon={<Trash2 aria-hidden />}
								variant="ghost"
								onClick={() => setIsConfirming(true)}
							/>
							<Button
								label="Send notification"
								icon={<Send aria-hidden />}
								variant="secondary"
								onClick={() => setIsSending(true)}
							/>
						</HStack>
					)
				}
			>
				{code === null ? null : (
					<VStack gap={4}>
						<VStack gap={1.5}>
							<Text weight="semibold">Code</Text>
							<Text type="supporting">
								Keep it like a password: anyone who has it can notify{" "}
								{recipient}.
							</Text>
							<CodeBlock
								code={code.code}
								hasCopyButton
								size="sm"
								width="100%"
							/>
						</VStack>
						<VStack gap={1.5}>
							<Text weight="semibold">Send with it</Text>
							<Text type="supporting">
								One request, from a script, a server or another site. Only the
								code and a title are needed.
							</Text>
							<CodeBlock
								code={fetchExample(code.code)}
								language="javascript"
								hasCopyButton
								size="sm"
								width="100%"
							/>
						</VStack>
					</VStack>
				)}
			</FormDialog>

			{code === null ? null : (
				<SendNotificationDialog
					code={code}
					isOpen={isSending}
					onOpenChange={setIsSending}
				/>
			)}

			<AlertDialog
				isOpen={isConfirming}
				onOpenChange={setIsConfirming}
				title={`Delete ${code?.label ?? "this code"}?`}
				description="Anything still sending with it will stop reaching anyone. It can't be brought back — only replaced with a new code."
				actionLabel="Delete"
				onAction={() => {
					setIsConfirming(false);
					if (code !== null) onDelete(code.code);
				}}
			/>
		</>
	);
}
