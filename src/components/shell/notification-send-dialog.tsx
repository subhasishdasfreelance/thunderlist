import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import * as v from "valibot";
import { FormDialog } from "#/components/common/form-dialog";
import { sentNote } from "#/components/teams/message-dialog";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";
import {
	type NotificationCode,
	notifyInputSchema,
} from "#/schemas/notification-code";

/**
 * Send a notification with a code, from the app: a title, and — each only if
 * wanted — a message, a picture and where tapping it goes. It goes through
 * the very endpoint a script would call, so it also shows the code works.
 *
 * It closes as soon as it is sent, and says who took it once the server has
 * answered.
 */
export function SendNotificationDialog({
	code,
	isOpen,
	onOpenChange,
}: {
	code: NotificationCode;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const toast = useToast();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [image, setImage] = useState("");
	const [url, setUrl] = useState("");

	// A fresh notification each time.
	useEffect(() => {
		if (!isOpen) return;
		setTitle("");
		setBody("");
		setImage("");
		setUrl("");
	}, [isOpen]);

	const input = {
		code: code.code,
		title,
		body,
		image: image.trim() === "" ? undefined : image,
		url: url.trim() === "" ? undefined : url,
	};
	const parsed = v.safeParse(notifyInputSchema, input);

	/** What is wrong with a field, once something has been typed in it. */
	function problem(field: "title" | "body" | "image" | "url") {
		const value = input[field];
		if (parsed.success || value === undefined || value.trim() === "") {
			return undefined;
		}
		const issue = parsed.issues.find((each) => v.getDotPath(each) === field);
		return issue === undefined
			? undefined
			: { type: "error" as const, message: issue.message };
	}

	function send() {
		if (!parsed.success) return;
		onOpenChange(false);

		fetch("/api/notify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(parsed.output),
		})
			.then(async (response) => {
				const answer = (await response.json()) as
					| { people: number; devices: number }
					| { error: string };
				if ("error" in answer) throw new Error(answer.error);
				toast({
					body: sentNote(answer.people, answer.devices),
					type: "info",
					uniqueID: "notification-code",
				});
			})
			.catch((error) =>
				toast({
					body: errorMessage(error),
					type: "error",
					uniqueID: "notification-code",
				}),
			);
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Send a notification"
			subtitle={`With ${code.label}.`}
			width={480}
			onSubmit={(event) => {
				event.preventDefault();
				send();
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
						label="Send"
						icon={<Send aria-hidden />}
						variant="primary"
						type="submit"
						form={formId}
						isDisabled={!parsed.success}
					/>
				</HStack>
			)}
		>
			<VStack gap={3}>
				<TextInput
					autoComplete="off"
					label="Title"
					isRequired
					value={title}
					onChange={setTitle}
					placeholder="Deploy finished"
					status={problem("title")}
				/>
				<TextArea
					autoComplete="off"
					label="Message"
					rows={3}
					value={body}
					onChange={setBody}
					placeholder="main is live in production."
					width="100%"
					status={problem("body")}
				/>
				<TextInput
					autoComplete="off"
					label="Image link"
					description="A picture shown large, where the device can."
					value={image}
					onChange={setImage}
					placeholder="https://example.com/a.png"
					status={problem("image")}
				/>
				<TextInput
					autoComplete="off"
					label="Opens"
					description="Where tapping it goes: a page of the app, or a web address. Today when left empty."
					value={url}
					onChange={setUrl}
					placeholder="/tags/today"
					status={problem("url")}
				/>
			</VStack>
		</FormDialog>
	);
}
