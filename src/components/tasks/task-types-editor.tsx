import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ErrorNotice } from "#/components/common/states";
import { COLOR_OPTIONS } from "#/components/tags/tag-form-dialog";
import { useApplyChange } from "#/lib/changes";
import { createId, ID_PREFIX } from "#/lib/ids";
import { usePermissions } from "#/lib/use-team";
import { taskTypesQuery } from "#/queries/space";
import type { TagColor } from "#/schemas/tag";
import type { TaskType } from "#/schemas/task-type";

/** What is wrong with a list of types, or `null` when it can be saved. */
function typesProblem(types: ReadonlyArray<TaskType>): string | null {
	if (types.some((type) => type.name.trim() === "")) {
		return "Every type needs a name.";
	}

	const names = types.map((type) => type.name.trim().toLowerCase());
	return new Set(names).size === names.length
		? null
		: "Two types can't share a name.";
}

/**
 * The kinds of work the space being worked in sorts its tasks into: a bug, a
 * feature, a chore.
 *
 * Edited as a list and saved at once, so a half-renamed type never reaches a
 * task. Renaming or recolouring one changes it on every task that has it;
 * taking one away takes it off them. Only the admin and project managers can
 * change the list; everyone else sees what is on it.
 */
export function TaskTypesEditor() {
	const result = useQuery(taskTypesQuery());
	const { canManageContent } = usePermissions();
	const { applyAsync } = useApplyChange();
	// The list being edited; `null` until something is changed.
	const [draft, setDraft] = useState<Array<TaskType> | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	if (result.isError) {
		return (
			<ErrorNotice error={result.error} onRetry={() => void result.refetch()} />
		);
	}
	if (result.data === undefined) {
		return <SectionSpinner label="Loading task types…" />;
	}

	const saved = result.data;
	const types = draft ?? saved;
	const isChanged =
		draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
	const problem = typesProblem(types);

	const edit = (index: number, change: Partial<TaskType>) =>
		setDraft(
			types.map((type, at) => (at === index ? { ...type, ...change } : type)),
		);

	async function save() {
		if (!isChanged || problem !== null) return;
		setIsSaving(true);

		try {
			await applyAsync({
				kind: "taskTypes.set",
				types: types.map((type) => ({ ...type, name: type.name.trim() })),
			});
			setDraft(null);
		} catch {
			// Already reported by `useApplyChange`; the edits stay to try again.
		} finally {
			setIsSaving(false);
		}
	}

	if (!canManageContent) {
		return (
			<VStack gap={2}>
				<HStack gap={1.5} wrap="wrap">
					{saved.map((type) => (
						<Token
							key={type.typeId}
							size="sm"
							color={type.color}
							label={type.name}
						/>
					))}
				</HStack>
				<Text type="supporting">
					{saved.length === 0
						? "This space has no task types."
						: "Only the admin and project managers can change these."}
				</Text>
			</VStack>
		);
	}

	return (
		<VStack gap={3}>
			{types.length === 0 ? (
				<Text type="supporting">
					No types. Add one, and tasks can be marked with it.
				</Text>
			) : null}

			{types.map((type, index) => (
				<HStack key={type.typeId} gap={2} vAlign="center">
					<span className="w-24 shrink-0">
						<Token
							size="sm"
							color={type.color}
							label={type.name.trim() === "" ? "Untitled" : type.name}
						/>
					</span>
					<TextInput
						label={`Type ${index + 1}`}
						isLabelHidden
						value={type.name}
						onChange={(name) => edit(index, { name })}
						placeholder="Bug"
						width="100%"
					/>
					<Selector
						label={`Colour of type ${index + 1}`}
						isLabelHidden
						options={COLOR_OPTIONS}
						value={type.color}
						onChange={(color) => edit(index, { color: color as TagColor })}
					/>
					<IconButton
						label={`Remove ${type.name || "this type"}`}
						icon={<X aria-hidden />}
						variant="ghost"
						size="sm"
						onClick={() => setDraft(types.filter((_, at) => at !== index))}
					/>
				</HStack>
			))}

			<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
				<Button
					label="Add a type"
					icon={<Plus aria-hidden />}
					variant="ghost"
					size="sm"
					isDisabled={types.length >= 30}
					onClick={() =>
						setDraft([
							...types,
							{
								typeId: createId(ID_PREFIX.taskType),
								name: "",
								color: "gray",
							},
						])
					}
				/>
				<HStack gap={2} vAlign="center">
					{problem === null || !isChanged ? null : (
						<Text type="supporting">{problem}</Text>
					)}
					<Button
						label="Discard"
						variant="ghost"
						size="sm"
						isDisabled={!isChanged || isSaving}
						onClick={() => setDraft(null)}
					/>
					<Button
						label="Save types"
						variant="primary"
						size="sm"
						isDisabled={!isChanged || problem !== null}
						isLoading={isSaving}
						onClick={() => void save()}
					/>
				</HStack>
			</HStack>
		</VStack>
	);
}
