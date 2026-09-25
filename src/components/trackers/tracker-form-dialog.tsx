import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Check, X } from "lucide-react";
import {
	type FormEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { FieldRow } from "#/components/common/field-row";
import { FormDialog } from "#/components/common/form-dialog";
import {
	ReminderField,
	useReminderDraft,
} from "#/components/common/reminder-field";
import { ScheduleFields } from "#/components/common/schedule-fields";
import {
	draftTagIds,
	EMPTY_TAGS_DRAFT,
	TagsField,
	tagsDraft,
} from "#/components/tags/tags-field";
import { AccessField, useOwnAlone } from "#/components/teams/access-field";
import { PeopleField } from "#/components/teams/people-field";
import { type TrackerValues, useApplyChange } from "#/lib/changes";
import { useTeam } from "#/lib/use-team";
import type { AccessEntry } from "#/schemas/access";
import { todayDateOnly } from "#/schemas/common";
import type { Tag } from "#/schemas/tag";
import { TRACKER_TYPE_DEFAULT_UNITS, type Tracker } from "#/schemas/tracker";

/**
 * Create or edit a tracker.
 *
 * There is no type to pick: the unit already says what is being counted, so a
 * new tracker is saved as "custom". One that already has a type keeps it — an
 * existing book still shows its author field and cannot pass its last page.
 */
export function TrackerFormDialog({
	isOpen,
	onOpenChange,
	tracker,
	tags,
	resolveTags,
	isSaving = false,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	tracker?: Tracker;
	/** Every tag that exists, for the tags field. */
	tags: ReadonlyArray<Tag>;
	/** Tag names to ids, making a tag for any name that does not exist yet. */
	resolveTags: (names: Array<string>) => Array<string>;
	/** The save is on its way; the button waits with it. */
	isSaving?: boolean;
	onSubmit: (values: TrackerValues) => void;
}) {
	const [title, setTitle] = useState("");
	const [caption, setCaption] = useState("");
	const [unit, setUnit] = useState("pages");
	const [startValue, setStartValue] = useState<number | null>(null);
	const [targetValue, setTargetValue] = useState<number | null>(null);
	const [startDate, setStartDate] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadline, setDeadline] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadlineTime, setDeadlineTime] = useState<string | undefined>(
		undefined,
	);
	const [description, setDescription] = useState("");
	const [coverUrl, setCoverUrl] = useState("");
	const [author, setAuthor] = useState("");
	const [tagDraft, setTagDraft] = useState(EMPTY_TAGS_DRAFT);
	const [assignees, setAssignees] = useState<Array<string>>([]);
	/*
	 * Who it is for. A new one starts with nobody but its author — so adding
	 * someone to a team hands them nothing until they are put on something —
	 * and `null`, the whole team, stays a choice rather than the default; see
	 * `AccessField`.
	 */
	const ownAlone = useOwnAlone();
	const [access, setAccess] = useState<Array<AccessEntry> | null>(null);
	const team = useTeam();

	// biome-ignore lint/correctness/useExhaustiveDependencies: the tags are read as the dialog opens and not followed after, or a list still loading would reset what is being typed on every render. A tag they cannot name yet is kept, not lost.
	useEffect(() => {
		if (!isOpen) return;
		setTitle(tracker?.title ?? "");
		setCaption(tracker?.caption ?? "");
		setUnit(tracker?.unit ?? TRACKER_TYPE_DEFAULT_UNITS.book);
		setStartValue(tracker?.startValue ?? 0);
		setTargetValue(tracker?.targetValue ?? null);
		setStartDate(
			(tracker?.startDate as ISODateString | undefined) ??
				(todayDateOnly() as ISODateString),
		);
		setDeadline((tracker?.deadline as ISODateString | null) ?? undefined);
		setDeadlineTime(tracker?.deadlineTime ?? undefined);
		setDescription(tracker?.description ?? "");
		setCoverUrl(tracker?.coverUrl ?? "");
		setAuthor(tracker?.author ?? "");
		setTagDraft(tagsDraft(tracker?.tagIds ?? [], tags));
		setAssignees(tracker?.assignees ?? []);
		setAccess(
			tracker === null || tracker === undefined
				? ownAlone
				: ((tracker.access ?? null) as Array<AccessEntry> | null),
		);
	}, [isOpen, tracker, ownAlone]);

	const trimmedTitle = title.trim();
	const from = startValue ?? 0;

	/*
	 * What is still missing, or `null` once nothing is.
	 *
	 * Said in words beside the button rather than by switching the button off.
	 * `NumberInput` keeps what is being typed to itself until the field is
	 * left, so while the caret is in the target this still reads the old one —
	 * and a button disabled on that can never be pressed: a disabled button
	 * takes no pointer events, so the field never loses focus, so the target
	 * never arrives. Pressing it is what commits the target.
	 *
	 * The target has to be past the starting point, or there is no distance to
	 * cover: "page 40 to page 40" is not a plan, and every pace figure derived
	 * from it would be a division by zero.
	 */
	const problem =
		trimmedTitle === ""
			? "Give it a title."
			: unit.trim() === ""
				? "Say what it counts."
				: targetValue === null
					? "Set a target."
					: targetValue <= from
						? "The target has to be past where it starts."
						: startDate === undefined
							? "Set a start date."
							: null;
	const isValid = problem === null;

	// Your own daily reminder about it, saved with the rest; see `ReminderField`.
	const reminder = useReminderDraft(
		isOpen,
		"tracker",
		tracker?.trackerId ?? null,
	);
	const { apply: applyReminder } = useApplyChange();

	function save() {
		if (!isValid || targetValue === null || startDate === undefined) return;

		reminder.save(applyReminder);
		onSubmit({
			title: trimmedTitle,
			caption: caption.trim(),
			type: tracker?.type ?? "custom",
			unit: unit.trim(),
			targetValue,
			startValue: from,
			startDate,
			deadline: deadline ?? null,
			deadlineTime: deadline === undefined ? null : (deadlineTime ?? null),
			description: description.trim(),
			coverUrl: coverUrl.trim() === "" ? null : coverUrl.trim(),
			author: author.trim(),
			tagIds: draftTagIds(tagDraft, resolveTags),
			assignees,
			access,
		});
	}

	// TagsField is memoised, and `save` is a new function on every render, so
	// Enter there reaches the latest `save` through a callback that stays put.
	const saveRef = useRef(save);
	useLayoutEffect(() => {
		saveRef.current = save;
	});
	const saveFromTags = useCallback(() => saveRef.current(), []);

	function submit(event: FormEvent) {
		event.preventDefault();
		save();
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={tracker ? "Edit tracker" : "New tracker"}
			onSubmit={submit}
			actions={(formId) => (
				<HStack gap={2} hAlign="end" vAlign="center">
					{problem === null ? null : <Text type="supporting">{problem}</Text>}
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={tracker ? "Save changes" : "Create tracker"}
						icon={<Check aria-hidden />}
						variant="primary"
						type="submit"
						form={formId}
						isLoading={isSaving}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<TextInput
					autoComplete="off"
					label="Title"
					isRequired
					value={title}
					onChange={setTitle}
					placeholder="Dune"
				/>

				<TextInput
					autoComplete="off"
					label="Caption"
					isOptional
					description="A line under the title, saying what it is."
					value={caption}
					onChange={setCaption}
					placeholder="For the book club"
				/>

				<FieldRow>
					<TextInput
						autoComplete="off"
						label="Unit"
						isRequired
						value={unit}
						onChange={setUnit}
						placeholder="pages"
					/>
					<NumberInput
						autoComplete="off"
						label="Target"
						isRequired
						min={1}
						value={targetValue}
						onChange={setTargetValue}
						placeholder="412"
					/>
				</FieldRow>

				<NumberInput
					autoComplete="off"
					label="Starting from"
					isOptional
					description="Where you already are. Leave at 0 to start from scratch."
					min={0}
					value={startValue}
					onChange={setStartValue}
					placeholder="0"
				/>

				{tracker?.type === "book" ? (
					<TextInput
						autoComplete="off"
						label="Author"
						isOptional
						value={author}
						onChange={setAuthor}
						placeholder="Frank Herbert"
					/>
				) : null}

				<TextInput
					autoComplete="off"
					label="Cover image URL"
					isOptional
					value={coverUrl}
					onChange={setCoverUrl}
					placeholder="https://…"
				/>

				<ScheduleFields
					startDate={startDate}
					deadline={deadline}
					deadlineTime={deadlineTime}
					onStartDateChange={setStartDate}
					onDeadlineChange={setDeadline}
					onDeadlineTimeChange={setDeadlineTime}
				/>

				<TagsField
					label="Tags"
					description="Under each of these tags, this tracker counts as one thing to finish."
					tags={tags}
					draft={tagDraft}
					onChange={setTagDraft}
					onSubmit={saveFromTags}
				/>

				{team === null ? null : (
					<PeopleField
						label="Assigned to"
						description="Who in the team this tracker is for."
						members={team.members}
						value={assignees}
						onChange={setAssignees}
					/>
				)}

				{/* Only once it exists: a reminder is about something. */}
				{tracker === undefined ? null : (
					<ReminderField value={reminder.time} onChange={reminder.setTime} />
				)}

				<AccessField noun="tracker" value={access} onChange={setAccess} />

				<TextArea
					autoComplete="off"
					label="Description"
					isOptional
					rows={4}
					value={description}
					onChange={setDescription}
				/>
			</VStack>
		</FormDialog>
	);
}
