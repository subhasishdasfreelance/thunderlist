import * as v from "valibot";
import { idSchema } from "./common";
import { TAG_COLORS } from "./tag";

const typeNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Every type needs a name"),
	v.maxLength(24, "Type names must be 24 characters or fewer"),
);

const taskTypeSchema = v.object({
	typeId: idSchema,
	name: typeNameSchema,
	color: v.picklist(TAG_COLORS),
});

/**
 * What kind of work a task is: a bug, a feature, a chore.
 *
 * Each space keeps its own list, managed on the Settings screen, and a task
 * names at most one by id — so renaming or recolouring a type is one write, and
 * a task keeps its type whatever it is called.
 */
export type TaskType = v.InferOutput<typeof taskTypeSchema>;

/**
 * The list a space starts with. Their ids are fixed rather than minted, so
 * every space's untouched list is the same and nothing has to be written until
 * someone changes it.
 */
export const DEFAULT_TASK_TYPES: ReadonlyArray<TaskType> = [
	{ typeId: "bug", name: "Bug", color: "red" },
	{ typeId: "feature", name: "Feature", color: "blue" },
	{ typeId: "story", name: "Story", color: "purple" },
	{ typeId: "chore", name: "Chore", color: "gray" },
];

/** A space's whole list, written at once from Settings. May be empty. */
export const taskTypesInputSchema = v.object({
	types: v.pipe(
		v.array(taskTypeSchema),
		v.maxLength(30, "At most 30 types"),
		v.check(
			(types) =>
				new Set(types.map((type) => type.name.toLowerCase())).size ===
				types.length,
			"Two types can't share a name",
		),
		v.check(
			(types) =>
				new Set(types.map((type) => type.typeId)).size === types.length,
			"Two types can't share an id",
		),
	),
});
