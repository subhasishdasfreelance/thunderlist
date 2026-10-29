import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Check, Hash, TagX } from "lucide-react";
import type { Tag } from "#/schemas/tag";
import { NO_TAG } from "#/schemas/task";

/**
 * Which tag's tasks to show: all of them, one tag's, or the ones with no tag.
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
	/** A tag id, `NO_TAG`, or `undefined` for every tag. */
	value: string | undefined;
	onChange: (tagId: string | undefined) => void;
}) {
	if (tags.length === 0) return null;

	const chosen = tags.find((tag) => tag.tagId === value);
	const tick = (isOn: boolean) =>
		isOn ? <Icon icon={Check} size="sm" color="accent" /> : undefined;
	const option = (tag: Tag) => ({
		id: tag.tagId,
		label: `#${tag.name}`,
		endContent: tick(tag.tagId === value),
		onClick: () => onChange(tag.tagId),
	});

	// Today is a plan rather than a subject, so it comes first, set apart from
	// the rest by a divider.
	const special = tags.filter((tag) => tag.special !== null);
	const others = tags.filter((tag) => tag.special === null);
	const divider = { type: "divider" as const };

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label:
					value === NO_TAG
						? "Untagged"
						: chosen === undefined
							? "All tags"
							: `#${chosen.name}`,
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
				divider,
				...special.map(option),
				...(special.length > 0 && others.length > 0 ? [divider] : []),
				...others.map(option),
				divider,
				{
					label: "Untagged",
					icon: TagX,
					endContent: tick(value === NO_TAG),
					onClick: () => onChange(NO_TAG),
				},
			]}
		/>
	);
}
