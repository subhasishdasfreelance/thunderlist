import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useToast } from "@astryxdesign/core/Toast";
import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { sendFeedbackFn } from "#/functions/feedback.functions";
import { errorMessage } from "#/lib/errors";

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
	const [isSending, setIsSending] = useState(false);

	useEffect(() => {
		if (isOpen) setMessage("");
	}, [isOpen]);

	const trimmed = message.trim();

	async function send() {
		if (trimmed === "" || isSending) return;
		setIsSending(true);

		try {
			await sendFeedbackFn({ data: { message: trimmed } });
			onOpenChange(false);
			toast({
				body: "Thanks — your feedback has been sent.",
				type: "info",
				uniqueID: "feedback",
			});
		} catch (error) {
			toast({ body: errorMessage(error), type: "error", uniqueID: "feedback" });
		} finally {
			setIsSending(false);
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
						isLoading={isSending}
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
