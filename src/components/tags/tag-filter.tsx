import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Check, Hash } from "lucide-react";
import type { Tag } from "#/schemas/tag";

/**
 * Which tag's tasks to show: all of them, or one tag's.
 *
 * A menu, like the person filter beside it, and the same kind of choice: it
 * narrows the whole screen — the list, the counts and the progress — not only
 * the rows. With no tags there is nothing to narrow to, and it draws nothing.
 */
export function TagFilter({
	tags,
	value,
	onChange,
}: {
	tags: ReadonlyArray<Tag>;
	/** A tag id, or `undefined` for every tag. */
	value: string | undefined;
	onChange: (tagId: string | undefined) => void;
}) {
	if (tags.length === 0) return null;

	const chosen = tags.find((tag) => tag.tagId === value);
	const tick = (isOn: boolean) =>
		isOn ? <Check aria-hidden size={16} /> : undefined;

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label: chosen === undefined ? "All tags" : `#${chosen.name}`,
				tooltip: "Show one tag's",
				variant: value === undefined ? "ghost" : "secondary",
				size: "sm",
				icon: <Hash aria-hidden />,
			}}
			items={[
				{
					label: "All tags",
					endContent: tick(value === undefined),
					onClick: () => onChange(undefined),
				},
				{ type: "divider" as const },
				...tags.map((tag) => ({
					id: tag.tagId,
					label: `#${tag.name}`,
					endContent: tick(tag.tagId === value),
					onClick: () => onChange(tag.tagId),
				})),
			]}
		/>
	);
}
