import { createServerFn } from "@tanstack/react-start";
import { sendFeedback } from "#/data/feedback.server";
import { requireUser } from "#/lib/auth.server";
import { feedbackInputSchema } from "#/schemas/feedback";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

/** Send feedback to the person who makes Thunderlist; see `sendFeedback`. */
export const sendFeedbackFn = createServerFn({ method: "POST" })
	.validator(validator(feedbackInputSchema))
	.handler(({ data }) =>
		guard("sendFeedback", async () =>
			sendFeedback(await requireUser(), data.message),
		),
	);
