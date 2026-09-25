import * as v from "valibot";
import { idSchema, titleSchema } from "./common";

/**
 * A plan: a long Markdown document — a design, a roadmap, a spec — kept
 * beside the work it is about.
 *
 * Written in the app or brought in as a `.md` file, and read on its own page.
 * One per document; the list reads everything but the body, which is the long
 * part and only wanted once a plan is opened.
 */

/** Large, but not unbounded: well inside what one document may hold. */
const PLAN_BODY_LIMIT = 2_000_000;

const planBodySchema = v.pipe(
	v.string(),
	v.maxLength(
		PLAN_BODY_LIMIT,
		"A plan can be up to 2 million characters — split it in two",
	),
);

export type Plan = {
	planId: string;
	title: string;
	/** Markdown. */
	body: string;
	createdAt: string;
	updatedAt: string;
};

/** A plan as the list shows it: everything but the body, and its length. */
export type PlanSummary = Omit<Plan, "body"> & {
	/** How long the body is, in characters. */
	length: number;
};

export const planIdInputSchema = v.object({ planId: idSchema });

export const createPlanInputSchema = v.object({
	planId: idSchema,
	title: titleSchema,
	body: planBodySchema,
});

export const updatePlanInputSchema = v.object({
	planId: idSchema,
	patch: v.pipe(
		v.object({
			title: v.optional(titleSchema),
			body: v.optional(planBodySchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

/**
 * A title for a plan brought in as a file: its first `# Heading`, or else the
 * file's name without `.md`.
 */
export function planTitleFrom(fileName: string, body: string): string {
	const heading = /^#\s+(.+?)\s*#*\s*$/m.exec(body)?.[1]?.trim();
	if (heading) return heading;
	return (
		fileName.replace(/\.(md|markdown|txt)$/i, "").trim() || "Untitled plan"
	);
}
