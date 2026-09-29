import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Check, SquareKanban } from "lucide-react";
import { useEffect } from "react";
import { StageDot } from "#/components/common/stage-dot";
import { STAGE_SHORTCUTS } from "#/components/tasks/task-actions";
import { isTyping } from "#/lib/use-row-shortcuts";
import { NOT_STARTED_STAGE_KEY, type TagColor } from "#/schemas/tag";

/**
 * Which of a tag's open tasks to show: all of them, the ones not yet started,
 * or the ones at one stage.
 *
 * The stages are the ones on the tag's bar — named alike across checklists,
 * one stage — and the same menu as the type filter beside it. Unlike that one
 * it narrows only the list: a finished task is at no stage, so the figures
 * would say nothing if they followed.
 *
 * `>` and `<` step to the next choice and the one before, in the menu's order
 * — every stage, then along the work from "To do" — stopping at either end,
 * as a checklist's stage tabs do; see `StageTabs`.
 *
 * A tag with nothing under way has nothing to narrow to, and it draws nothing
 * — unless a stage is still picked, so it can be put back.
 */
export function StageFilter({
	stages,
	value,
	onChange,
}: {
	/** The stages the tag's open tasks are under way at, furthest along first. */
	stages: ReadonlyArray<{ key: string; name: string; color: TagColor }>;
	/** A stage's key, `NOT_STARTED_STAGE_KEY`, or `undefined` for every stage. */
	value: string | undefined;
	onChange: (stageKey: string | undefined) => void;
}) {
	const isShown = stages.length > 0 || value !== undefined;

	useEffect(() => {
		if (!isShown) return;

		function handle(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTyping(event.target)) return;
			if (
				event.target instanceof Element &&
				event.target.closest('dialog, [role="dialog"], [role="alertdialog"]')
			) {
				return;
			}

			const step =
				event.key === STAGE_SHORTCUTS.next
					? 1
					: event.key === STAGE_SHORTCUTS.previous
						? -1
						: 0;
			if (step === 0) return;

			// The menu's order: every stage, then along the work.
			const choices = [
				undefined,
				NOT_STARTED_STAGE_KEY,
				...stages.map((stage) => stage.key).reverse(),
			];
			const at = choices.indexOf(value);
			const next = at + step;
			event.preventDefault();
			if (at !== -1 && next >= 0 && next < choices.length) {
				onChange(choices[next]);
			}
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [isShown, stages, value, onChange]);

	if (!isShown) return null;

	const chosen = stages.find((stage) => stage.key === value);
	const tick = (isOn: boolean) =>
		isOn ? <Icon icon={Check} size="sm" color="accent" /> : undefined;

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label:
					value === undefined
						? "All stages"
						: value === NOT_STARTED_STAGE_KEY
							? "To do"
							: (chosen?.name ?? value),
				tooltip: "Show one stage",
				variant: value === undefined ? "ghost" : "secondary",
				size: "sm",
				icon: <SquareKanban aria-hidden />,
			}}
			items={[
				{
					label: "All stages",
					endContent: tick(value === undefined),
					onClick: () => onChange(undefined),
				},
				{ type: "divider" as const },
				{
					type: "section" as const,
					title: "One stage",
					items: [
						{
							// The bar's name for the work not started, whatever each
							// checklist calls its first stage.
							id: "not-started",
							label: "To do",
							icon: <StageDot color={null} />,
							endContent: tick(value === NOT_STARTED_STAGE_KEY),
							onClick: () => onChange(NOT_STARTED_STAGE_KEY),
						},
						// Along the work, as a checklist's tabs run.
						...[...stages].reverse().map((stage) => ({
							id: stage.key,
							label: stage.name,
							icon: <StageDot color={stage.color} />,
							endContent: tick(stage.key === value),
							onClick: () => onChange(stage.key),
						})),
					],
				},
			]}
		/>
	);
}
