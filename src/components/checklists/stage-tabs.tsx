import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { useEffect } from "react";
import { STAGE_SHORTCUTS } from "#/components/tasks/task-actions";
import { isTyping } from "#/lib/use-row-shortcuts";
import type { Stage } from "#/schemas/checklist";

/**
 * A checklist's stages, one tab each, with how many tasks are at each.
 *
 * The screen shows one stage at a time, opening on the first — what is still
 * to do — and moves along from here: "To do", "Review", "UAT", "Done". The
 * counts follow the screen's filter, so they always add up to the list below.
 *
 * `>` and `<` open the next stage and the one before, stopping at either end.
 * They are about the screen, not a task, so they work wherever the pointer
 * is — but not from inside a popup, which the tabs are behind.
 */
export function StageTabs({
	stages,
	value,
	counts,
	onChange,
}: {
	stages: ReadonlyArray<Stage>;
	value: string;
	/** Tasks at each stage, by stage id; missing is none. */
	counts: Readonly<Record<string, number>>;
	onChange: (stageId: string) => void;
}) {
	useEffect(() => {
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

			const at = stages.findIndex((stage) => stage.stageId === value);
			const next = stages[at + step];
			event.preventDefault();
			if (at !== -1 && next !== undefined) onChange(next.stageId);
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [stages, value, onChange]);

	return (
		<TabList value={value} onChange={onChange} hasDivider>
			{stages.map((stage) => (
				<Tab
					key={stage.stageId}
					value={stage.stageId}
					label={stage.name}
					endContent={
						<Text type="supporting" color="secondary">
							{counts[stage.stageId] ?? 0}
						</Text>
					}
				/>
			))}
		</TabList>
	);
}
