import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Bot, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { TextInput } from "#/components/common/text-fields";
import { createAiTokenSecret, createId, ID_PREFIX } from "#/lib/ids";
import type { AiToken, CreateAiTokenInput } from "#/schemas/ai-token";

/**
 * Make an AI access token: a name for it, and nothing else. It works in the
 * space being worked in now, until the assistant switches.
 *
 * It closes as soon as it is made; the token opens straight after, the one
 * time its secret can be copied.
 */
export function NewAiTokenDialog({
	isOpen,
	onOpenChange,
	onCreate,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	onCreate: (input: CreateAiTokenInput) => void;
}) {
	const [label, setLabel] = useState("");

	useEffect(() => {
		if (isOpen) setLabel("");
	}, [isOpen]);

	const canCreate = label.trim() !== "";

	function create() {
		if (!canCreate) return;
		onCreate({
			tokenId: createId(ID_PREFIX.aiToken),
			secret: createAiTokenSecret(),
			label: label.trim(),
		});
		onOpenChange(false);
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="New AI access token"
			subtitle="An assistant holding it can do anything you can here."
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
						label="Make token"
						icon={<Bot aria-hidden />}
						variant="primary"
						type="submit"
						form={formId}
						isDisabled={!canCreate}
					/>
				</HStack>
			)}
		>
			<TextInput
				autoComplete="off"
				label="Name"
				description="Which assistant it is for, so you know it again."
				isRequired
				value={label}
				onChange={setLabel}
				placeholder="Claude Code on my laptop"
			/>
		</FormDialog>
	);
}

/** Where the MCP server is, on whatever origin the app is served from. */
function mcpUrl(): string {
	const origin =
		typeof window === "undefined" ? "https://your-app" : window.location.origin;
	return `${origin}/api/mcp`;
}

/** Adding the server to Claude Code, in one command. */
function claudeCodeCommand(secret: string): string {
	return `claude mcp add --transport http thunderlist ${mcpUrl()} \\
  --header "Authorization: Bearer ${secret}"`;
}

/** The same for any client configured with JSON: Cursor, VS Code, `.mcp.json`. */
function jsonConfig(secret: string): string {
	return JSON.stringify(
		{
			mcpServers: {
				thunderlist: {
					type: "http",
					url: mcpUrl(),
					headers: { Authorization: `Bearer ${secret}` },
				},
			},
		},
		null,
		2,
	);
}

/**
 * One token, opened from its row — or straight after it is made, the only
 * time `secret` is known: where it works, and how to give it to an assistant.
 * Deleting it asks first, since the assistant using it stops working.
 */
export function AiTokenDialog({
	token,
	secret,
	onClose,
	onDelete,
}: {
	token: AiToken | null;
	/** The secret, while the token has just been made; `null` after. */
	secret: string | null;
	onClose: () => void;
	onDelete: (tokenId: string) => void;
}) {
	const [isConfirming, setIsConfirming] = useState(false);
	const shown = secret ?? "YOUR_TOKEN";
	const where = token?.space?.name ?? "your own space";

	return (
		<>
			<FormDialog
				isOpen={token !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) onClose();
				}}
				title={token?.label ?? ""}
				subtitle={`Works in ${where}, until the assistant switches space.`}
				width={600}
				actions={() =>
					token === null ? null : (
						<HStack gap={2} hAlign="start" width="100%">
							<Button
								label="Delete"
								icon={<Trash2 aria-hidden />}
								variant="ghost"
								onClick={() => setIsConfirming(true)}
							/>
						</HStack>
					)
				}
			>
				{token === null ? null : (
					<VStack gap={4}>
						<VStack gap={1.5}>
							<Text weight="semibold">Token</Text>
							{secret === null ? (
								<Text type="supporting">
									Ends in …{token.hint}. It was shown once, when it was made; if
									it is lost, delete it and make another.
								</Text>
							) : (
								<>
									<Text type="supporting">
										Copy it now: it won't be shown again. Keep it like a
										password — whoever has it can do anything you can.
									</Text>
									<CodeBlock
										code={secret}
										hasCopyButton
										size="sm"
										width="100%"
									/>
								</>
							)}
						</VStack>
						<VStack gap={1.5}>
							<Text weight="semibold">Claude Code</Text>
							<CodeBlock
								code={claudeCodeCommand(shown)}
								language="bash"
								hasCopyButton
								size="sm"
								width="100%"
							/>
						</VStack>
						<VStack gap={1.5}>
							<Text weight="semibold">Other MCP clients</Text>
							<Text type="supporting">
								Cursor, VS Code, or a project's .mcp.json.
							</Text>
							<CodeBlock
								code={jsonConfig(shown)}
								language="json"
								hasCopyButton
								size="sm"
								width="100%"
							/>
						</VStack>
					</VStack>
				)}
			</FormDialog>

			<AlertDialog
				isOpen={isConfirming}
				onOpenChange={setIsConfirming}
				title={`Delete ${token?.label ?? "this token"}?`}
				description="The assistant using it will stop working at once. It can't be brought back — only replaced with a new token."
				actionLabel="Delete"
				onAction={() => {
					setIsConfirming(false);
					if (token !== null) onDelete(token.tokenId);
				}}
			/>
		</>
	);
}
