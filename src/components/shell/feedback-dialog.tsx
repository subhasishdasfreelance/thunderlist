import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Send, X } from "lucide-react";
import { useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { sendFeedbackFn } from "#/functions/feedback.functions";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";

/**
 * Tell the person who makes Thunderlist what you think.
 *
 * It arrives as a task on their own list, saying who sent it; see
 * `sendFeedback`.
 */
export function FeedbackDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const toast = useToast();
	const [message, setMessage] = useState("");

	const trimmed = message.trim();

	/*
	 * Closed and thanked at once; the sending follows behind. The message is
	 * only cleared once it has arrived, so one that fails to is still here to
	 * send again.
	 */
	async function send() {
		if (trimmed === "") return;
		onOpenChange(false);
		toast({
			body: "Thanks — your feedback has been sent.",
			type: "info",
			uniqueID: "feedback",
		});

		try {
			await sendFeedbackFn({ data: { message: trimmed } });
			setMessage("");
		} catch (error) {
			toast({
				body: `${errorMessage(error)} Your feedback is still there to send again.`,
				type: "error",
				uniqueID: "feedback",
			});
		}
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Send feedback"
			subtitle="What works, what doesn't, and what you would like to see."
			width={460}
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
						isDisabled={trimmed === ""}
						onClick={() => void send()}
					/>
				</HStack>
			)}
		>
			<TextArea
				autoComplete="off"
				label="Your feedback"
				rows={6}
				value={message}
				onChange={setMessage}
				placeholder="The first line becomes its title."
			/>
		</FormDialog>
	);
}
