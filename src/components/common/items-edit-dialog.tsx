import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DateInput } from "@astryxdesign/core/DateInput";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { type ISOTimeString, TimeInput } from "@astryxdesign/core/TimeInput";
import { Token } from "@astryxdesign/core/Token";
import { useQuery } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { FieldRow } from "#/components/common/field-row";
import { FormDialog } from "#/components/common/form-dialog";
import {
	draftTagIds,
	EMPTY_TAGS_DRAFT,
	type TagsDraft,
	TagsField,
} from "#/components/tags/tags-field";
import { createTagResolver, resolveTags, useApplyChange } from "#/lib/changes";
import { formatDate } from "#/lib/format-date";
import { usePermissions } from "#/lib/use-team";
import { tagsQuery } from "#/queries/tags";
import type { ItemsPatch, ShareableKind } from "#/schemas/change";
import type { Checklist } from "#/schemas/checklist";
import { type DailyWindow, DEFAULT_DAILY_WINDOW } from "#/schemas/common";
import { type Tag, tagsFor } from "#/schemas/tag";
import type { Tracker } from "#/schemas/tracker";

/**
 * A checklist, tracker or tag as editing several at once reads it; see
 * `ItemsEditDialog`.
 */
export type EditableItem = {
	kind: ShareableKind;
	id: string;
	startDate: string | null;
	deadline: string | null;
	deadlineTime: string | null;
	/** Left out where it can have none: a tracker. */
	dailyWindow?: DailyWindow | null;
	/** Left out where it can carry none: a tag. */
	tagIds?: ReadonlyArray<string>;
	urgent: boolean;
	important: boolean;
};

export function editableChecklist(checklist: Checklist): EditableItem {
	return {
		kind: "checklist",
		id: checklist.checklistId,
		startDate: checklist.startDate,
		deadline: checklist.deadline,
		deadlineTime: checklist.deadlineTime ?? null,
		dailyWindow: checklist.dailyWindow ?? null,
		tagIds: checklist.tagIds ?? [],
		urgent: checklist.urgent ?? false,
		important: checklist.important ?? false,
	};
}

export function editableTracker(tracker: Tracker): EditableItem {
	return {
		kind: "tracker",
		id: tracker.trackerId,
		startDate: tracker.startDate,
		deadline: tracker.deadline,
		deadlineTime: tracker.deadlineTime ?? null,
		tagIds: tracker.tagIds ?? [],
		urgent: tracker.urgent ?? false,
		important: tracker.important ?? false,
	};
}

export function editableTag(tag: Tag): EditableItem {
	return {
		kind: "tag",
		id: tag.tagId,
		startDate: tag.startDate,
		deadline: tag.deadline,
		deadlineTime: tag.deadlineTime ?? null,
		dailyWindow: tag.dailyWindow ?? null,
		urgent: tag.urgent ?? false,
		important: tag.important ?? false,
	};
}

/** What each is called, one and several. */
const NOUNS: Record<ShareableKind, readonly [string, string]> = {
	checklist: ["checklist", "checklists"],
	tracker: ["tracker", "trackers"],
	tag: ["tag", "tags"],
};

/** The value every item has for one field, or `null` where they differ. */
function shared<T>(
	items: ReadonlyArray<EditableItem>,
	read: (item: EditableItem) => T,
): { value: T } | null {
	const first = JSON.stringify(read(items[0]));
	return items.every((item) => JSON.stringify(read(item)) === first)
		? { value: read(items[0]) }
		: null;
}

type Fields = {
	startDate: ISODateString | undefined;
	deadline: ISODateString | undefined;
	deadlineTime: string | undefined;
	dailyWindow: DailyWindow | null;
	urgent: boolean | "indeterminate";
	important: boolean | "indeterminate";
	adding: TagsDraft;
	removing: Array<string>;
};

/** Which parts of the form have been changed; only those are saved. */
type Part = "startDate" | "schedule" | "urgent" | "important" | "tags";

/** What the fields open on: what the items share, and where they differ, so. */
function fieldsOf(items: ReadonlyArray<EditableItem>): Fields {
	const urgent = shared(items, (item) => item.urgent);
	const important = shared(items, (item) => item.important);

	return {
		startDate: (shared(items, (item) => item.startDate)?.value ?? undefined) as
			| ISODateString
			| undefined,
		deadline: (shared(items, (item) => item.deadline)?.value ?? undefined) as
			| ISODateString
			| undefined,
		deadlineTime:
			shared(items, (item) => item.deadlineTime)?.value ?? undefined,
		dailyWindow:
			shared(items, (item) => item.dailyWindow ?? null)?.value ?? null,
		urgent: urgent?.value ?? "indeterminate",
		important: important?.value ?? "indeterminate",
		adding: EMPTY_TAGS_DRAFT,
		removing: [],
	};
}

/**
 * Edit every checklist, tracker and tag picked out at once — Edit in the bar
 * over a pick, on their screens or a group's.
 *
 * Only what they can share is here: when they start, when they are due or the
 * hours they repeat in, how much they matter, and tags put on or taken off.
 * A field only some of them have is not offered: a tracker has no daily
 * window, and a tag carries no tags.
 *
 * Each field opens on what they have in common. Where they differ it says so,
 * and is left that way unless it is changed: only what is touched is saved,
 * onto all of them, as one change; see `updateItems`.
 */
export function ItemsEditDialog({
	isOpen,
	onOpenChange,
	items,
	tags,
	resolveTags,
	onSave,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The items being edited, or `null` while none are. */
	items: ReadonlyArray<EditableItem> | null;
	/** Every tag that exists, for the tags fields. */
	tags: ReadonlyArray<Tag>;
	/** Tag names to ids, making a tag for any name that does not exist yet. */
	resolveTags: (names: Array<string>) => Array<string>;
	onSave: (patch: ItemsPatch) => void;
}) {
	const [fields, setFields] = useState<Fields | null>(null);
	const [touched, setTouched] = useState<ReadonlySet<Part>>(new Set());

	// Afresh every time it opens, and not followed while it is open.
	// biome-ignore lint/correctness/useExhaustiveDependencies: read as it opens; a refetch must not reset what is being typed.
	useEffect(() => {
		if (!isOpen || items === null || items.length === 0) return;
		setFields(fieldsOf(items));
		setTouched(new Set());
	}, [isOpen]);

	const list = items ?? [];
	const canRepeat = list.every((item) => item.dailyWindow !== undefined);
	const canTag = list.every((item) => item.tagIds !== undefined);
	const differs = {
		startDate:
			list.length > 0 && shared(list, (item) => item.startDate) === null,
		schedule:
			list.length > 0 &&
			shared(list, (item) => [
				item.deadline,
				item.deadlineTime,
				item.dailyWindow ?? null,
			]) === null,
	};
	const carried = tagsFor(
		[...new Set(list.flatMap((item) => item.tagIds ?? []))],
		tags,
	).filter((tag) => !fields?.removing.includes(tag.tagId));

	const change = useCallback((part: Part, next: Partial<Fields>) => {
		setFields((current) => (current === null ? null : { ...current, ...next }));
		setTouched((current) => new Set(current).add(part));
	}, []);

	const isWindowBackwards =
		fields?.dailyWindow != null &&
		fields.dailyWindow.to <= fields.dailyWindow.from;

	function save() {
		if (fields === null || touched.size === 0 || isWindowBackwards) return;

		const patch: ItemsPatch = {};
		if (touched.has("startDate") && fields.startDate !== undefined) {
			patch.startDate = fields.startDate;
		}
		// Repeating daily takes the deadline's place; see `ScheduleFields`.
		if (touched.has("schedule")) {
			if (fields.dailyWindow !== null) {
				patch.dailyWindow = fields.dailyWindow;
				patch.deadline = null;
				patch.deadlineTime = null;
			} else {
				patch.deadline = fields.deadline ?? null;
				patch.deadlineTime =
					fields.deadline === undefined ? null : (fields.deadlineTime ?? null);
				patch.dailyWindow = null;
			}
		}
		if (touched.has("urgent") && fields.urgent !== "indeterminate") {
			patch.urgent = fields.urgent;
		}
		if (touched.has("important") && fields.important !== "indeterminate") {
			patch.important = fields.important;
		}
		if (touched.has("tags")) {
			const adding = draftTagIds(fields.adding, resolveTags);
			const removing = fields.removing.filter(
				(tagId) => !adding.includes(tagId),
			);
			if (adding.length > 0) patch.addTagIds = adding;
			if (removing.length > 0) patch.removeTagIds = removing;
		}
		if (Object.keys(patch).length === 0) {
			onOpenChange(false);
			return;
		}
		onSave(patch);
	}

	/*
	 * Enter in the tags field saves through this, which keeps its identity
	 * while always calling the latest `save`; see `TagsField`.
	 */
	const saveRef = useRef(save);
	useLayoutEffect(() => {
		saveRef.current = save;
	});
	const saveFromTags = useCallback(() => saveRef.current(), []);
	const changeAdding = useCallback(
		(adding: TagsDraft) => change("tags", { adding }),
		[change],
	);

	const kinds = new Set(list.map((item) => item.kind));
	const noun =
		kinds.size === 1 ? NOUNS[list[0].kind] : (["item", "items"] as const);
	const eachOwn = "Each has its own. What is set here goes on them all.";

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={`Edit ${list.length} ${list.length === 1 ? noun[0] : noun[1]}`}
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
						label="Save"
						icon={<Check aria-hidden />}
						variant="primary"
						isDisabled={touched.size === 0 || isWindowBackwards}
						onClick={save}
					/>
				</HStack>
			)}
		>
			{fields === null ? null : (
				<VStack gap={4}>
					<HStack gap={4}>
						<CheckboxInput
							label="Urgent"
							value={fields.urgent}
							onChange={(urgent) => change("urgent", { urgent })}
						/>
						<CheckboxInput
							label="Important"
							value={fields.important}
							onChange={(important) => change("important", { important })}
						/>
					</HStack>

					<FieldRow>
						<DateInput
							label="Start date"
							isOptional
							description={
								differs.startDate
									? eachOwn
									: "Every pace figure is measured from here."
							}
							format={formatDate}
							value={fields.startDate}
							onChange={(startDate) => change("startDate", { startDate })}
						/>
						{fields.dailyWindow !== null ? null : (
							<DateInput
								label="Deadline"
								isOptional
								hasClear
								description={
									differs.schedule
										? eachOwn
										: "Used to work out whether they are ahead or behind."
								}
								format={formatDate}
								value={fields.deadline}
								// Clearing the day clears the hour with it.
								onChange={(deadline) =>
									change("schedule", {
										deadline,
										...(deadline === undefined
											? { deadlineTime: undefined }
											: {}),
									})
								}
							/>
						)}
					</FieldRow>

					{fields.dailyWindow !== null ||
					fields.deadline === undefined ? null : (
						<TimeInput
							label="Due at"
							isOptional
							hasClear
							description="Leave empty and they are due at the start of that day."
							value={fields.deadlineTime as ISOTimeString | undefined}
							onChange={(time) =>
								change("schedule", { deadlineTime: time?.slice(0, 5) })
							}
						/>
					)}

					{!canRepeat ? null : (
						<VStack gap={2}>
							<Switch
								label="Repeats daily"
								description="Paced against the same hours every day, instead of a deadline."
								value={fields.dailyWindow !== null}
								onChange={(isOn) =>
									change("schedule", {
										dailyWindow: isOn ? DEFAULT_DAILY_WINDOW : null,
									})
								}
							/>
							{fields.dailyWindow === null ? null : (
								<FieldRow>
									<TimeInput
										label="From"
										isRequired
										value={fields.dailyWindow.from as ISOTimeString}
										onChange={(from) => {
											if (from && fields.dailyWindow !== null) {
												change("schedule", {
													dailyWindow: { ...fields.dailyWindow, from },
												});
											}
										}}
									/>
									<TimeInput
										label="To"
										isRequired
										value={fields.dailyWindow.to as ISOTimeString}
										onChange={(to) => {
											if (to && fields.dailyWindow !== null) {
												change("schedule", {
													dailyWindow: { ...fields.dailyWindow, to },
												});
											}
										}}
										status={
											isWindowBackwards
												? {
														type: "error",
														message: "It has to end after it starts.",
													}
												: undefined
										}
									/>
								</FieldRow>
							)}
						</VStack>
					)}

					{!canTag ? null : (
						<>
							<TagsField
								label="Add tags"
								description="Put on all of them, alongside the tags each already has."
								tags={tags}
								draft={fields.adding}
								onChange={changeAdding}
								onSubmit={saveFromTags}
							/>
							{carried.length === 0 && fields.removing.length === 0 ? null : (
								<VStack gap={1}>
									<Text type="label">Tags on them</Text>
									<HStack gap={1} wrap="wrap">
										{carried.map((tag) => (
											<Token
												key={tag.tagId}
												size="sm"
												color={tag.color}
												label={tag.name}
												onRemove={() =>
													change("tags", {
														removing: [...fields.removing, tag.tagId],
													})
												}
											/>
										))}
									</HStack>
									<Text type="supporting">
										{fields.removing.length === 0
											? "× takes a tag off every one of them."
											: `${fields.removing.length} to take off. Cancel to keep them.`}
									</Text>
								</VStack>
							)}
						</>
					)}
				</VStack>
			)}
		</FormDialog>
	);
}

/**
 * Edit, in the bar over a pick, and what it opens; see `ItemsEditDialog`.
 * Saved as one change for all of them, and the pick is done with.
 */
export function EditItemsButton({
	items,
	onDone,
}: {
	items: ReadonlyArray<EditableItem>;
	onDone: () => void;
}) {
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	const tags = useQuery(tagsQuery()).data ?? [];
	const [isEditing, setIsEditing] = useState(false);

	return (
		<>
			<Button
				label="Edit"
				variant="secondary"
				size="sm"
				icon={<Pencil aria-hidden />}
				onClick={() => setIsEditing(true)}
			/>
			<ItemsEditDialog
				isOpen={isEditing}
				onOpenChange={setIsEditing}
				items={isEditing ? items : null}
				tags={tags}
				resolveTags={(names) =>
					resolveTags(createTagResolver(apply, tags, canManageContent), names)
				}
				onSave={(patch) => {
					apply({
						kind: "items.update",
						items: items.map(({ kind, id }) => ({ kind, id })),
						patch,
					});
					setIsEditing(false);
					onDone();
				}}
			/>
		</>
	);
}
