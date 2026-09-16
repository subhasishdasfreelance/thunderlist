import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
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
import { FormDialog } from "#/components/common/form-dialog";
import { ScheduleFields } from "#/components/common/schedule-fields";
import {
	draftTagIds,
	EMPTY_TAGS_DRAFT,
	TagsField,
	tagsDraft,
} from "#/components/tags/tags-field";
import { AccessField, useOwnAlone } from "#/components/teams/access-field";
import type { ChecklistValues } from "#/lib/changes";
import type { AccessEntry } from "#/schemas/access";
import {
	type Checklist,
	checklistStages,
	DEFAULT_STAGES,
	type Stage,
	stageColor,
} from "#/schemas/checklist";
import { type DailyWindow, todayDateOnly } from "#/schemas/common";
import type { Tag } from "#/schemas/tag";
import { StagesField, stagesProblem } from "./stages-field";

/**
 * Stages with the colour each is drawn in written down. A stage without one
 * takes the colour for its place, so moving it would change it; written down,
 * a colour stays with its stage wherever it is moved to.
 */
function withColors(stages: ReadonlyArray<Stage>): Array<Stage> {
	return stages.map((stage, index) => ({
		...stage,
		color: stageColor(stages, index),
	}));
}

/**
 * Whether two sets of stages are the same stages, named and coloured alike, in
 * order.
 */
function sameStages(a: ReadonlyArray<Stage>, b: ReadonlyArray<Stage>): boolean {
	return (
		a.length === b.length &&
		a.every(
			(stage, at) =>
				stage.stageId === b[at].stageId &&
				stage.name.trim() === b[at].name &&
				stage.color === b[at].color,
		)
	);
}

/**
 * Create or edit a checklist.
 *
 * The same dialog serves both: `checklist` seeds the fields when editing and is
 * absent when creating, where the start date defaults to today.
 */
export function ChecklistFormDialog({
	isOpen,
	onOpenChange,
	checklist,
	tags,
	resolveTags,
	isSaving = false,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	checklist?: Checklist;
	/** Every tag that exists, for the tags field. */
	tags: ReadonlyArray<Tag>;
	/** Tag names to ids, making a tag for any name that does not exist yet. */
	resolveTags: (names: Array<string>) => Array<string>;
	/** The save is on its way; the button waits with it. */
	isSaving?: boolean;
	onSubmit: (values: ChecklistValues) => void;
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [startDate, setStartDate] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadline, setDeadline] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadlineTime, setDeadlineTime] = useState<string | undefined>(
		undefined,
	);
	const [dailyWindow, setDailyWindow] = useState<DailyWindow | null>(null);
	const [tagDraft, setTagDraft] = useState(EMPTY_TAGS_DRAFT);
	/*
	 * Who it is for. A new one starts with nobody but its author — so adding
	 * someone to a team hands them nothing until they are put on something —
	 * and `null`, the whole team, stays a choice rather than the default; see
	 * `AccessField`.
	 */
	const ownAlone = useOwnAlone();
	const [access, setAccess] = useState<Array<AccessEntry> | null>(null);
	const [stages, setStages] = useState<Array<Stage>>([...DEFAULT_STAGES]);

	// Reset to the current values every time the dialog opens.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the tags are read as the dialog opens and not followed after, or a list still loading would reset what is being typed on every render. A tag they cannot name yet is kept, not lost.
	useEffect(() => {
		if (!isOpen) return;
		setTitle(checklist?.title ?? "");
		setDescription(checklist?.description ?? "");
		setStartDate(
			(checklist?.startDate as ISODateString | undefined) ??
				(todayDateOnly() as ISODateString),
		);
		setDeadline((checklist?.deadline as ISODateString | null) ?? undefined);
		setDeadlineTime(checklist?.deadlineTime ?? undefined);
		setDailyWindow(checklist?.dailyWindow ?? null);
		setTagDraft(tagsDraft(checklist?.tagIds ?? [], tags));
		setAccess(
			checklist === null || checklist === undefined
				? ownAlone
				: ((checklist.access ?? null) as Array<AccessEntry> | null),
		);
		setStages(withColors(checklistStages(checklist ?? {})));
	}, [isOpen, checklist, ownAlone]);

	const trimmedTitle = title.trim();
	const isValid =
		trimmedTitle !== "" &&
		startDate !== undefined &&
		(dailyWindow === null || dailyWindow.to > dailyWindow.from) &&
		stagesProblem(stages) === null;

	function save() {
		if (!isValid || startDate === undefined) return;

		// Sent only when they changed: saving a title must not move a single task.
		const original = withColors(checklistStages(checklist ?? {}));
		const named = stages.map((stage) => ({
			...stage,
			name: stage.name.trim(),
		}));

		onSubmit({
			title: trimmedTitle,
			description: description.trim(),
			startDate,
			// Repeating daily takes the deadline's place; see `ScheduleFields`.
			deadline: dailyWindow === null ? (deadline ?? null) : null,
			deadlineTime:
				dailyWindow === null && deadline !== undefined
					? (deadlineTime ?? null)
					: null,
			dailyWindow,
			tagIds: draftTagIds(tagDraft, resolveTags),
			access,
			...(sameStages(named, original) ? {} : { stages: named }),
		});
	}

	/*
	 * The sections below are memoised, so a keystroke in one does not draw the
	 * rest again; see `ScheduleFields`. Enter in the tags field saves through
	 * this, which keeps its identity while always calling the latest `save`.
	 */
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
			title={checklist ? "Edit checklist" : "New checklist"}
			onSubmit={submit}
			actions={(formId) => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={checklist ? "Save changes" : "Create checklist"}
						icon={<Check aria-hidden />}
						variant="primary"
						type="submit"
						form={formId}
						isDisabled={!isValid}
						isLoading={isSaving}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<TextInput
					label="Title"
					isRequired
					value={title}
					onChange={setTitle}
					placeholder="Product Launch Q3"
				/>
				<TextArea
					label="Description"
					isOptional
					rows={4}
					value={description}
					onChange={setDescription}
					placeholder="What this checklist covers"
				/>
				<ScheduleFields
					startDate={startDate}
					deadline={deadline}
					deadlineTime={deadlineTime}
					dailyWindow={dailyWindow}
					onStartDateChange={setStartDate}
					onDeadlineChange={setDeadline}
					onDeadlineTimeChange={setDeadlineTime}
					onDailyWindowChange={setDailyWindow}
				/>
				<StagesField value={stages} onChange={setStages} />
				<TagsField
					label="Tags"
					description="Every task in this checklist carries these, done or not, and so will any added later."
					tags={tags}
					draft={tagDraft}
					onChange={setTagDraft}
					onSubmit={saveFromTags}
				/>
				{/* The Inbox and the Backlog are everyone's, in a team as anywhere. */}
				{checklist?.special != null ? null : (
					<AccessField noun="checklist" value={access} onChange={setAccess} />
				)}
			</VStack>
		</FormDialog>
	);
}
