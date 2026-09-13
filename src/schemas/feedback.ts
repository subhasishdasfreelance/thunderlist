import * as v from "valibot";

export const feedbackInputSchema = v.object({
	message: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "Write something first"),
		v.maxLength(5000, "Feedback must be 5000 characters or fewer"),
	),
});
