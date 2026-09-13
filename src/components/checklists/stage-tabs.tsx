import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import type { Stage } from "#/schemas/checklist";

/**
 * A checklist's stages, one tab each, with how many tasks are at each.
 *
 * The screen shows one stage at a time, opening on the first — what is still
 * to do — and moves along from here: "To do", "Review", "UAT", "Done". The
 * counts follow the screen's filter, so they always add up to the list below.
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
