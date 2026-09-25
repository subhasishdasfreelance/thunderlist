/**
 * Plans: long Markdown documents kept with the work. Server only.
 *
 * Every operation is idempotent, as everywhere: making a plan that already
 * exists returns it, deleting one already gone is a no-op.
 */

import { AppError } from "#/lib/errors";
import { collections, DOMAIN_FIELDS } from "#/lib/mongo/client.server";
import type { Plan, PlanSummary } from "#/schemas/plan";

/** Every plan, newest first, without its body; see `PlanSummary`. */
export async function listPlans(userId: string): Promise<Array<PlanSummary>> {
	const current = await collections();

	return current.plans
		.aggregate<PlanSummary>([
			{ $match: { userId } },
			{ $sort: { updatedAt: -1 } },
			{
				$project: {
					_id: 0,
					planId: 1,
					title: 1,
					createdAt: 1,
					updatedAt: 1,
					length: { $strLenCP: "$body" },
				},
			},
		])
		.toArray();
}

export async function getPlan(userId: string, planId: string): Promise<Plan> {
	const current = await collections();
	const plan = await current.plans.findOne(
		{ planId, userId },
		{ projection: DOMAIN_FIELDS },
	);

	if (!plan) throw new AppError("not_found", "That plan no longer exists.");
	return plan;
}

export async function createPlan(
	userId: string,
	input: { planId: string; title: string; body: string },
): Promise<Plan> {
	const current = await collections();

	const existing = await current.plans.findOne(
		{ planId: input.planId, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (existing) return existing;

	const now = new Date().toISOString();
	// Field by field, so the change's `kind` is not stored alongside.
	const plan: Plan = {
		planId: input.planId,
		title: input.title,
		body: input.body,
		createdAt: now,
		updatedAt: now,
	};

	await current.plans.insertOne({ ...plan, userId });
	return plan;
}

export async function updatePlan(
	userId: string,
	planId: string,
	patch: { title?: string; body?: string },
): Promise<void> {
	const current = await collections();

	const result = await current.plans.updateOne(
		{ planId, userId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
	);

	if (result.matchedCount === 0) {
		throw new AppError("not_found", "That plan no longer exists.");
	}
}

export async function deletePlan(
	userId: string,
	planId: string,
): Promise<void> {
	const current = await collections();
	await current.plans.deleteOne({ planId, userId });
}
