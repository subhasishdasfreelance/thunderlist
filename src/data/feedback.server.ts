/**
 * Feedback, sent from anyone's account menu to the person who makes
 * Thunderlist. Server only.
 *
 * It arrives as a task in their own checklist, `thunderlist-feedback`, in their
 * own space — so it is theirs alone to see — assigned to them. One message is
 * one task: its first line the title, who sent it the caption, and the whole
 * message in the notes.
 */

import { AppError } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import { collections } from "#/lib/mongo/client.server";
import { todayDateOnly } from "#/schemas/common";
import { createChecklist, createTask, updateTask } from "./checklist.server";

const RECIPIENT = "subhasishdasfreelance@gmail.com";

/** Enough of the first line to say what it is about; the notes have the rest. */
const MAX_TITLE = 120;

export async function sendFeedback(
	from: { name: string; email: string },
	message: string,
): Promise<void> {
	const current = await collections();
	const account = await current.users.findOne(
		{ email: RECIPIENT },
		{ projection: { _id: 1 } },
	);
	if (!account) {
		throw new AppError(
			"not_configured",
			"Feedback can't be received just now. Please try again later.",
		);
	}

	// Better Auth's id for the account, which is what owns everything in it.
	const ownerId = account._id.toHexString();

	/*
	 * One checklist, found by an id of its own rather than by its title, so two
	 * messages arriving at once still land in the same one and renaming it does
	 * not start another. Creating it again once it exists changes nothing.
	 */
	const checklistId = `chk_feedback_${ownerId}`;
	await createChecklist(ownerId, {
		checklistId,
		title: "thunderlist-feedback",
		description: "Sent from Send feedback, in the account menu.",
		startDate: todayDateOnly(),
		deadline: null,
		deadlineTime: null,
		dailyWindow: null,
		tagIds: [],
		visibleTo: null,
	});

	const firstLine = message.split("\n")[0].trim();
	const taskId = createId(ID_PREFIX.task);

	await createTask(ownerId, {
		checklistId,
		taskId,
		title:
			firstLine.length > MAX_TITLE
				? `${firstLine.slice(0, MAX_TITLE - 1)}…`
				: firstLine,
		addedAt: new Date().toISOString(),
		tagIds: [],
		urgent: false,
		important: false,
	});
	await updateTask(ownerId, taskId, {
		caption: `From ${from.name} · ${from.email}`,
		notes: message,
		assignees: [RECIPIENT],
	});
}
