import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Check, Shapes } from "lucide-react";
import { StageDot } from "#/components/common/stage-dot";
import { useTaskTypes } from "#/lib/use-task-types";
import { NO_TYPE } from "#/schemas/task";

/**
 * Which kind of work to show: everything, one type of it, or the tasks with
 * no type at all.
 *
 * A menu, like the tag and person filters beside it, and the same kind of
 * choice: it narrows the whole screen — the list, the counts and the progress
 * — not only the rows. A space with no types has nothing to narrow to, and it
 * draws nothing.
 *
 * "No type" is offered because it is what most tasks are, and "which of these
 * has nobody said what it is" is a real question to ask of a list.
 */
export function TypeFilter({
	value,
	onChange,
}: {
	/** A type id, `NO_TYPE`, or `undefined` for every kind. */
	value: string | undefined;
	onChange: (typeId: string | undefined) => void;
}) {
	const types = useTaskTypes();
	if (types.length === 0) return null;

	const chosen = types.find((type) => type.typeId === value);
	const tick = (isOn: boolean) =>
		isOn ? <Icon icon={Check} size="sm" color="accent" /> : undefined;

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label:
					value === undefined
						? "All types"
						: chosen === undefined
							? "No type"
							: chosen.name,
				tooltip: "Show one kind of work",
				variant: value === undefined ? "ghost" : "secondary",
				size: "sm",
				icon: <Shapes aria-hidden />,
			}}
			items={[
				{
					label: "All types",
					endContent: tick(value === undefined),
					onClick: () => onChange(undefined),
				},
				{ type: "divider" as const },
				{
					type: "section" as const,
					title: "One kind",
					items: [
						...types.map((type) => ({
							id: type.typeId,
							label: type.name,
							// The dot the stages use, in the type's own colour: a type is a
							// colour and a name everywhere else too.
							icon: <StageDot color={type.color} />,
							endContent: tick(type.typeId === value),
							onClick: () => onChange(type.typeId),
						})),
						{
							id: NO_TYPE,
							label: "No type",
							icon: <StageDot color={null} />,
							endContent: tick(value === NO_TYPE),
							onClick: () => onChange(NO_TYPE),
						},
					],
				},
			]}
		/>
	);
}
