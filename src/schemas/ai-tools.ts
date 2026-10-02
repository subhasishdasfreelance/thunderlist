import * as v from "valibot";
import { ACCESS_LEVELS } from "./access";
import { SECTIONS } from "./backdrop";
import { DESIGNS, PALETTES } from "./backdrop-designs";
import {
	dateOnlySchema,
	emailSchema,
	ITEM_KINDS,
	timeOfDaySchema,
} from "./common";
import { COUNTDOWN_FORMATS } from "./countdown";
import { GROUP_ITEM_KINDS, MAX_GROUP_NAME } from "./group";
import { TAG_COLORS } from "./tag";
import { GRANTED_ROLES, TEAM_ROLES } from "./team";

/**
 * Every tool an AI agent can use on Thunderlist, in one place.
 *
 * The same catalog is served two ways: by the MCP endpoint (`/api/mcp`), for
 * an assistant outside the browser holding an AI access token, and through
 * WebMCP in the open tab, for an agent in the browser using the session it
 * is signed in with; see `runAiTool`. A tool is the same tool both ways.
 *
 * Inputs are shaped for an agent rather than for a screen: things are named
 * the way a person names them — an id, a number like `T-42`, or the name
 * itself — rather than by an id only the app knows, and dates are plain days.
 * Each input is still checked again, as the `Change` it becomes, by the same
 * schemas every screen's edits go through.
 */

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

function described<TSchema extends v.GenericSchema>(
	schema: TSchema,
	description: string,
) {
	return v.pipe(schema, v.description(description));
}

/** Something named by its id, its number or its exact name. */
function ref(what: string, number: string) {
	return described(
		v.pipe(v.string(), v.trim(), v.minLength(1, `Name the ${what}`)),
		`The ${what}: its id, its number (${number}), or its exact name.`,
	);
}

function refs(what: string, number: string) {
	return described(
		v.pipe(
			v.array(ref(what, number)),
			v.minLength(1, `Name at least one ${what}`),
			v.maxLength(500, "Too many at once"),
		),
		`The ${what}s, each by id, number (${number}) or exact name.`,
	);
}

const date = (description: string) => described(dateOnlySchema, description);
const time = (description: string) => described(timeOfDaySchema, description);

const color = described(
	v.picklist(TAG_COLORS),
	"A colour. Picked at random when left out.",
);

const tagNames = described(
	v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.minLength(1))),
		v.maxLength(20),
	),
	"Tag names, without the #. A name that is not a tag yet becomes one.",
);

const emails = described(
	v.pipe(v.array(emailSchema), v.maxLength(50)),
	"People in the team, by email address.",
);

const dailyWindow = described(
	v.nullable(v.object({ from: timeOfDaySchema, to: timeOfDaySchema })),
	"Paced to the same hours every day instead of a deadline, e.g. { from: '06:00', to: '22:00' }; null for none.",
);

const access = described(
	v.nullable(
		v.pipe(
			v.array(
				v.object({ email: emailSchema, level: v.picklist(ACCESS_LEVELS) }),
			),
			v.maxLength(200),
		),
	),
	"In a team, who may do what with it: read, edit or full. null for the whole team, each at whatever their role allows.",
);

const schedule = {
	startDate: v.optional(date("The day the work starts, YYYY-MM-DD.")),
	deadline: v.optional(
		v.nullable(date("The day it is due, YYYY-MM-DD; null for none.")),
	),
	deadlineTime: v.optional(
		v.nullable(time("HH:MM on the deadline day; null for its start.")),
	),
};

const taskFields = {
	caption: v.optional(
		described(v.string(), "A line of detail under the title."),
	),
	notes: v.optional(described(v.string(), "Longer notes, in Markdown.")),
	deadline: v.optional(
		v.nullable(date("The day the task is due, YYYY-MM-DD; null for none.")),
	),
	type: v.optional(
		v.nullable(
			described(
				v.string(),
				"The kind of work, by task type name or id; null for none. See get_workspace.",
			),
		),
	),
	urgent: v.optional(v.boolean()),
	important: v.optional(v.boolean()),
};

const newTaskSchema = v.object({
	title: described(
		v.pipe(v.string(), v.trim(), v.minLength(1, "Title is required")),
		"The task, as it would be typed: '#name' tags it, ' -u', ' -i' or ' -ui' at the end flags it urgent and/or important, and a line that is only '&Name' stands for that tracker or checklist.",
	),
	assignees: v.optional(emails),
	...taskFields,
});

const itemRef = v.object({
	kind: v.picklist(ITEM_KINDS),
	ref: described(
		v.pipe(v.string(), v.trim(), v.minLength(1)),
		"Its id, number or exact name.",
	),
});

const groupItemRef = v.object({
	kind: v.picklist(GROUP_ITEM_KINDS),
	ref: described(
		v.pipe(v.string(), v.trim(), v.minLength(1)),
		"Its id, number or exact name.",
	),
});

const noInput = v.object({});

/* -------------------------------------------------------------------------- */
/* The catalog                                                                */
/* -------------------------------------------------------------------------- */

type ToolSpec = {
	title: string;
	description: string;
	input: v.ObjectSchema<v.ObjectEntries, undefined>;
	/** Reads only; changes nothing. */
	readOnly?: boolean;
	/** Deletes or removes something; an agent may want to ask first. */
	destructive?: boolean;
};

export const AI_TOOLS = {
	/* Reading ---------------------------------------------------------------- */

	get_workspace: {
		title: "Workspace",
		description:
			"Start here. Who you are, the space you are working in (your own or a team, and your role there), the teams you could switch to, today's date, the Today tag, the Inbox and Backlog checklists, and the task types.",
		input: noInput,
		readOnly: true,
	},
	search: {
		title: "Search",
		description:
			"Search everything by words or by number (T-42, C-3, TR-7, TG-2, P-4, CD-2, G-1, E-15): checklists, tasks (titles, captions and notes), trackers, readings, tags, plans, countdowns and groups.",
		input: v.object({
			query: v.pipe(
				v.string(),
				v.trim(),
				v.minLength(1, "Search for something"),
			),
		}),
		readOnly: true,
	},
	list_tasks: {
		title: "List tasks",
		description:
			"Tasks across every checklist, narrowed by any of the filters. Open tasks unless status says otherwise. Each comes with its number, checklist, stage, tags, type, flags, deadline and assignees.",
		input: v.object({
			checklist: v.optional(ref("checklist", "C-3")),
			tag: v.optional(ref("tag", "TG-2, or 'today'")),
			assignee: v.optional(emailSchema),
			type: v.optional(
				described(v.string(), "A task type's name or id, or 'none'."),
			),
			stage: v.optional(described(v.string(), "A stage name, e.g. 'Doing'.")),
			status: v.optional(v.picklist(["open", "done", "all"])),
			urgent: v.optional(v.boolean()),
			important: v.optional(v.boolean()),
			dueBy: v.optional(
				date("Only tasks with a deadline on or before this day."),
			),
			text: v.optional(
				described(v.string(), "Only tasks with these words in them."),
			),
			limit: v.optional(
				v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)),
			),
		}),
		readOnly: true,
	},
	get_task: {
		title: "Task",
		description:
			"One task in full: notes, subtasks, what it waits on, its stage and everything else.",
		input: v.object({ task: ref("task", "T-42") }),
		readOnly: true,
	},
	list_checklists: {
		title: "Checklists",
		description:
			"Every checklist with its stages, schedule, tags and progress.",
		input: noInput,
		readOnly: true,
	},
	get_checklist: {
		title: "Checklist",
		description:
			"One checklist: its stages with how many tasks are at each, its schedule and progress, and its tasks.",
		input: v.object({ checklist: ref("checklist", "C-3") }),
		readOnly: true,
	},
	list_tags: {
		title: "Tags",
		description: "Every tag with its schedule and progress, Today included.",
		input: noInput,
		readOnly: true,
	},
	list_trackers: {
		title: "Trackers",
		description:
			"Every tracker: its target, where it stands, its unit and its schedule.",
		input: noInput,
		readOnly: true,
	},
	get_tracker: {
		title: "Tracker",
		description: "One tracker with every reading recorded on it.",
		input: v.object({ tracker: ref("tracker", "TR-7") }),
		readOnly: true,
	},
	list_groups: {
		title: "Groups",
		description: "Every group, with the checklists, trackers and tags in each.",
		input: noInput,
		readOnly: true,
	},
	list_plans: {
		title: "Plans",
		description: "Every plan (a Markdown document), without its text.",
		input: noInput,
		readOnly: true,
	},
	get_plan: {
		title: "Plan",
		description: "One plan with its whole Markdown text.",
		input: v.object({ plan: ref("plan", "P-4") }),
		readOnly: true,
	},
	list_countdowns: {
		title: "Countdowns",
		description: "Every countdown and the day it counts to.",
		input: noInput,
		readOnly: true,
	},
	list_teams: {
		title: "Teams",
		description: "Every team you are in, with its people and their roles.",
		input: noInput,
		readOnly: true,
	},
	list_notification_codes: {
		title: "Notification codes",
		description:
			"Your notification codes in this space: secrets a script sends to POST /api/notify to notify people.",
		input: noInput,
		readOnly: true,
	},

	/* Tasks ------------------------------------------------------------------ */

	add_tasks: {
		title: "Add tasks",
		description:
			"Add one or more tasks to a checklist, or to the Inbox when none is named. Set today to put them on Today as well.",
		input: v.object({
			tasks: v.pipe(
				v.array(newTaskSchema),
				v.minLength(1, "Add at least one task"),
				v.maxLength(500, "Too many tasks at once"),
			),
			checklist: v.optional(ref("checklist", "C-3, or 'inbox' or 'backlog'")),
			tags: v.optional(tagNames),
			today: v.optional(
				described(v.boolean(), "Put every one of them on Today too."),
			),
		}),
	},
	update_tasks: {
		title: "Update tasks",
		description:
			"Change one or more tasks the same way: tick them done or reopen them, move them to a stage, flag them, set a deadline, type, caption or notes, tag or untag them, put them on or off Today, assign people, set subtasks or what they wait on. A title can only be given to one task at a time.",
		input: v.object({
			tasks: refs("task", "T-42"),
			title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
			done: v.optional(
				described(v.boolean(), "true ticks it done; false reopens it."),
			),
			stage: v.optional(
				described(
					v.string(),
					"Move it to this stage of its checklist, by name. The last stage is done.",
				),
			),
			...taskFields,
			addTags: v.optional(tagNames),
			removeTags: v.optional(tagNames),
			today: v.optional(
				described(v.boolean(), "true puts it on Today; false takes it off."),
			),
			assignees: v.optional(
				described(
					v.pipe(v.array(emailSchema), v.maxLength(50)),
					"Exactly these people, replacing whoever was assigned.",
				),
			),
			addAssignees: v.optional(emails),
			removeAssignees: v.optional(emails),
			subtasks: v.optional(
				described(
					v.pipe(
						v.array(
							v.object({
								title: v.pipe(v.string(), v.trim(), v.minLength(1)),
								done: v.optional(v.boolean()),
							}),
						),
						v.maxLength(200),
					),
					"Every subtask, in order, replacing the ones there.",
				),
			),
			dependsOn: v.optional(
				described(
					v.pipe(v.array(itemRef), v.maxLength(50)),
					"Everything it waits on, replacing what it waited on: tasks, checklists, trackers or tags. It cannot be done until they are.",
				),
			),
		}),
	},
	move_tasks: {
		title: "Move tasks",
		description:
			"Move tasks to another checklist. Moving to the Backlog parks them, which also takes them off Today.",
		input: v.object({
			tasks: refs("task", "T-42"),
			to: ref("checklist", "C-3, or 'inbox' or 'backlog'"),
		}),
	},
	delete_tasks: {
		title: "Delete tasks",
		description: "Delete tasks for good.",
		input: v.object({ tasks: refs("task", "T-42") }),
		destructive: true,
	},

	/* Checklists ------------------------------------------------------------- */

	create_checklist: {
		title: "Create checklist",
		description:
			"Make a checklist, optionally with its own stages and its first tasks.",
		input: v.object({
			title: v.pipe(v.string(), v.trim(), v.minLength(1, "Title is required")),
			description: v.optional(v.string()),
			...schedule,
			dailyWindow: v.optional(dailyWindow),
			tags: v.optional(described(tagNames, "Tags every task in it carries.")),
			stages: v.optional(
				described(
					v.pipe(v.array(v.string()), v.minLength(2), v.maxLength(12)),
					"Stage names in order; the last means done. 'To do' and 'Done' when left out.",
				),
			),
			access: v.optional(access),
			tasks: v.optional(
				described(
					v.pipe(v.array(v.string()), v.maxLength(500)),
					"Task titles to start it with, written as add_tasks takes them.",
				),
			),
		}),
	},
	update_checklist: {
		title: "Update checklist",
		description:
			"Change a checklist: title, description, schedule, tags, stages (tasks keep a stage whose name stays) or who can see it.",
		input: v.object({
			checklist: ref("checklist", "C-3"),
			title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
			description: v.optional(v.string()),
			...schedule,
			dailyWindow: v.optional(dailyWindow),
			tags: v.optional(
				described(tagNames, "Every tag it carries, replacing its tags."),
			),
			stages: v.optional(
				described(
					v.pipe(v.array(v.string()), v.minLength(2), v.maxLength(12)),
					"Every stage name in order, replacing its stages; the last means done.",
				),
			),
			access: v.optional(access),
		}),
	},
	delete_checklists: {
		title: "Delete checklists",
		description:
			"Delete checklists and every task in them. The Inbox and Backlog cannot be deleted.",
		input: v.object({ checklists: refs("checklist", "C-3") }),
		destructive: true,
	},

	/* Tags ------------------------------------------------------------------- */

	update_tag: {
		title: "Update tag",
		description:
			"Rename, recolour or reschedule a tag, or change who can see it. Today can be renamed too.",
		input: v.object({
			tag: ref("tag", "TG-2, or 'today'"),
			name: v.optional(
				v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
			),
			color: v.optional(v.picklist(TAG_COLORS)),
			description: v.optional(v.string()),
			startDate: v.optional(
				v.nullable(
					date("The day it starts, YYYY-MM-DD; null for when it was made."),
				),
			),
			deadline: schedule.deadline,
			deadlineTime: schedule.deadlineTime,
			dailyWindow: v.optional(dailyWindow),
			access: v.optional(access),
		}),
	},
	delete_tags: {
		title: "Delete tags",
		description:
			"Delete tags. Their tasks stay, untagged. Today cannot be deleted.",
		input: v.object({ tags: refs("tag", "TG-2") }),
		destructive: true,
	},

	/* Trackers --------------------------------------------------------------- */

	create_tracker: {
		title: "Create tracker",
		description:
			"Make a tracker for a measurable goal: a book's pages, a course's lessons, a distance, anything counted towards a target.",
		input: v.object({
			title: v.pipe(v.string(), v.trim(), v.minLength(1, "Title is required")),
			type: v.picklist(["book", "course", "project", "fitness", "custom"]),
			targetValue: described(v.number(), "The number to reach."),
			unit: v.optional(
				described(
					v.string(),
					"What is counted: pages, km. A default per type.",
				),
			),
			startValue: v.optional(
				described(v.number(), "Where the count already stands. 0 by default."),
			),
			...schedule,
			caption: v.optional(v.string()),
			description: v.optional(v.string()),
			author: v.optional(v.string()),
			coverUrl: v.optional(v.nullable(v.string())),
			tags: v.optional(tagNames),
			assignees: v.optional(emails),
			access: v.optional(access),
		}),
	},
	update_tracker: {
		title: "Update tracker",
		description: "Change a tracker's details, target, schedule or people.",
		input: v.object({
			tracker: ref("tracker", "TR-7"),
			title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
			type: v.optional(
				v.picklist(["book", "course", "project", "fitness", "custom"]),
			),
			targetValue: v.optional(v.number()),
			unit: v.optional(v.string()),
			startValue: v.optional(v.number()),
			...schedule,
			caption: v.optional(v.string()),
			description: v.optional(v.string()),
			author: v.optional(v.string()),
			coverUrl: v.optional(v.nullable(v.string())),
			tags: v.optional(
				described(tagNames, "Every tag it carries, replacing its tags."),
			),
			assignees: v.optional(emails),
			access: v.optional(access),
		}),
	},
	delete_trackers: {
		title: "Delete trackers",
		description: "Delete trackers and every reading on them.",
		input: v.object({ trackers: refs("tracker", "TR-7") }),
		destructive: true,
	},
	record_progress: {
		title: "Record progress",
		description:
			"Record where a tracker stands now — the reading, not the increment: after reading to page 78, the value is 78.",
		input: v.object({
			tracker: ref("tracker", "TR-7"),
			value: v.number(),
			date: v.optional(date("The day of the reading; today when left out.")),
			note: v.optional(v.string()),
		}),
	},
	update_reading: {
		title: "Update reading",
		description: "Correct one reading on a tracker.",
		input: v.object({
			tracker: ref("tracker", "TR-7"),
			entry: described(v.string(), "The reading's id or number (E-15)."),
			value: v.optional(v.number()),
			date: v.optional(date("YYYY-MM-DD.")),
			note: v.optional(v.string()),
		}),
	},
	delete_readings: {
		title: "Delete readings",
		description: "Delete readings from a tracker.",
		input: v.object({
			tracker: ref("tracker", "TR-7"),
			entries: described(
				v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(500)),
				"Each reading's id or number (E-15).",
			),
		}),
		destructive: true,
	},

	/* Groups, plans, countdowns ---------------------------------------------- */

	create_group: {
		title: "Create group",
		description:
			"Make a group holding any mix of checklists, trackers and tags.",
		input: v.object({
			name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_GROUP_NAME)),
			color: v.optional(color),
			items: v.optional(v.pipe(v.array(groupItemRef), v.maxLength(500))),
			...schedule,
		}),
	},
	import_group: {
		title: "Import group from outline",
		description:
			"Make a group from a Markdown outline: each '# Heading' starts a checklist, a deeper '## heading' under it is its description, and every other line is one of its tasks, written as add_tasks takes them (a leading '-', '*' or '1.' is dropped).",
		input: v.object({
			name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_GROUP_NAME)),
			color: v.optional(color),
			outline: v.pipe(v.string(), v.minLength(1)),
		}),
	},
	update_group: {
		title: "Update group",
		description:
			"Rename, recolour or reschedule a group, or change what is in it.",
		input: v.object({
			group: ref("group", "G-1"),
			name: v.optional(
				v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_GROUP_NAME)),
			),
			color: v.optional(v.picklist(TAG_COLORS)),
			items: v.optional(
				described(
					v.pipe(v.array(groupItemRef), v.maxLength(500)),
					"Everything in it, replacing what it held.",
				),
			),
			addItems: v.optional(v.pipe(v.array(groupItemRef), v.maxLength(500))),
			removeItems: v.optional(v.pipe(v.array(groupItemRef), v.maxLength(500))),
			...schedule,
		}),
	},
	delete_group: {
		title: "Delete group",
		description: "Delete a group. What was in it stays.",
		input: v.object({ group: ref("group", "G-1") }),
		destructive: true,
	},
	create_plan: {
		title: "Create plan",
		description: "Write a plan: a Markdown document kept beside the work.",
		input: v.object({
			title: v.pipe(v.string(), v.trim(), v.minLength(1, "Title is required")),
			body: v.string(),
		}),
	},
	update_plan: {
		title: "Update plan",
		description:
			"Retitle a plan, replace its text, or add text to the end of it.",
		input: v.object({
			plan: ref("plan", "P-4"),
			title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
			body: v.optional(described(v.string(), "The whole new text.")),
			append: v.optional(
				described(v.string(), "Text to add at the end, as a new paragraph."),
			),
		}),
	},
	delete_plans: {
		title: "Delete plans",
		description: "Delete plans.",
		input: v.object({ plans: refs("plan", "P-4") }),
		destructive: true,
	},
	create_countdown: {
		title: "Create countdown",
		description: "Count down to a day.",
		input: v.object({
			title: v.pipe(v.string(), v.trim(), v.minLength(1, "Title is required")),
			date: date("The day to count down to, YYYY-MM-DD."),
			color: v.optional(color),
			format: v.optional(v.picklist(COUNTDOWN_FORMATS)),
		}),
	},
	update_countdown: {
		title: "Update countdown",
		description: "Change a countdown's title, day, colour or format.",
		input: v.object({
			countdown: ref("countdown", "CD-2"),
			title: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1))),
			date: v.optional(date("YYYY-MM-DD.")),
			color: v.optional(v.picklist(TAG_COLORS)),
			format: v.optional(v.picklist(COUNTDOWN_FORMATS)),
		}),
	},
	delete_countdowns: {
		title: "Delete countdowns",
		description: "Delete countdowns.",
		input: v.object({ countdowns: refs("countdown", "CD-2") }),
		destructive: true,
	},

	/* The space -------------------------------------------------------------- */

	set_task_types: {
		title: "Set task types",
		description:
			"Replace the space's list of task types. A type keeps its tasks while its name stays; one left out is taken off its tasks' rows.",
		input: v.object({
			types: v.pipe(
				v.array(
					v.object({
						name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(24)),
						color: v.optional(v.picklist(TAG_COLORS)),
					}),
				),
				v.maxLength(30),
			),
		}),
	},
	set_order: {
		title: "Set order",
		description:
			"Order checklists, trackers, tags or plans by hand, as their screen shows them. Anything not named follows, in its usual order.",
		input: v.object({
			list: v.picklist(["checklists", "trackers", "tags", "plans"]),
			order: described(
				v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(500)),
				"Each by id, number or exact name, first first.",
			),
		}),
	},
	share: {
		title: "Share",
		description:
			"In a team, give checklists, trackers or tags one access list: who may read, edit or have full control of them.",
		input: v.object({
			kind: v.picklist(["checklist", "tracker", "tag"]),
			items: described(
				v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(500)),
				"Each by id, number or exact name.",
			),
			access,
		}),
	},
	set_backdrop: {
		title: "Set backdrop",
		description:
			"Choose the background illustration and palette of a section of the app, for you alone. null puts back the default.",
		input: v.object({
			section: v.picklist(SECTIONS),
			design: v.nullable(v.picklist(DESIGNS.map((each) => each.designId))),
			palette: v.nullable(v.picklist(PALETTES.map((each) => each.paletteId))),
		}),
	},

	/* Teams ------------------------------------------------------------------ */

	switch_space: {
		title: "Switch space",
		description:
			"Work in a team from now on, or in your own space. Everything else acts on the space being worked in.",
		input: v.object({
			team: v.nullable(
				described(
					v.string(),
					"The team's id or exact name; null for your own space.",
				),
			),
		}),
	},
	create_team: {
		title: "Create team",
		description: "Make a team, with you as its admin, and start working in it.",
		input: v.object({
			name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
		}),
	},
	add_team_member: {
		title: "Add team member",
		description:
			"Add someone to a team by the email address they sign in with. Admins only.",
		input: v.object({
			team: v.optional(
				described(
					v.string(),
					"The team's id or name; the current one when left out.",
				),
			),
			email: emailSchema,
			role: v.optional(v.picklist(GRANTED_ROLES)),
		}),
	},
	set_member_role: {
		title: "Set member role",
		description:
			"Change someone's role in a team. Making someone admin hands the team over to them. Admins only.",
		input: v.object({
			team: v.optional(
				described(
					v.string(),
					"The team's id or name; the current one when left out.",
				),
			),
			email: emailSchema,
			role: v.picklist(TEAM_ROLES),
		}),
	},
	remove_team_member: {
		title: "Remove team member",
		description: "Take someone out of a team, or leave it by naming yourself.",
		input: v.object({
			team: v.optional(
				described(
					v.string(),
					"The team's id or name; the current one when left out.",
				),
			),
			email: emailSchema,
		}),
		destructive: true,
	},
	delete_team: {
		title: "Delete team",
		description:
			"Delete a team and everything in it, for everyone. Admins only.",
		input: v.object({
			team: described(v.string(), "The team's id or exact name."),
		}),
		destructive: true,
	},
	send_team_message: {
		title: "Send team message",
		description:
			"Notify people in the team being worked in: everyone, one role, everyone who can see a checklist, tag or tracker, or one person. Project managers and the admin only.",
		input: v.object({
			to: v.variant("kind", [
				v.object({ kind: v.literal("team") }),
				v.object({ kind: v.literal("role"), role: v.picklist(TEAM_ROLES) }),
				v.object({ kind: v.literal("checklist"), ref: v.string() }),
				v.object({ kind: v.literal("tag"), ref: v.string() }),
				v.object({ kind: v.literal("tracker"), ref: v.string() }),
				v.object({ kind: v.literal("person"), email: emailSchema }),
			]),
			title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
			body: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
		}),
	},
	create_notification_code: {
		title: "Create notification code",
		description:
			"Make a notification code for people (on all their devices) or for the whole team. Returns the secret code.",
		input: v.object({
			label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
			to: v.variant("kind", [
				v.object({
					kind: v.literal("people"),
					emails: v.pipe(v.array(emailSchema), v.minLength(1)),
				}),
				v.object({ kind: v.literal("team") }),
			]),
		}),
	},
	delete_notification_code: {
		title: "Delete notification code",
		description: "Delete a notification code, so it stops working.",
		input: v.object({ code: v.string() }),
		destructive: true,
	},
	send_feedback: {
		title: "Send feedback",
		description: "Send feedback about Thunderlist to the person who makes it.",
		input: v.object({
			message: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(5000)),
		}),
	},
} satisfies Record<string, ToolSpec>;

export type AiToolName = keyof typeof AI_TOOLS;

export type AiToolInput<TName extends AiToolName> = v.InferOutput<
	(typeof AI_TOOLS)[TName]["input"]
>;

export function isAiToolName(name: string): name is AiToolName {
	return Object.hasOwn(AI_TOOLS, name);
}

/** A tool as both MCP and WebMCP list it: its input as JSON Schema. */
export type AiToolListing = {
	name: AiToolName;
	title: string;
	description: string;
	inputSchema: Record<string, unknown>;
	annotations: { readOnlyHint: boolean; destructiveHint: boolean };
};
