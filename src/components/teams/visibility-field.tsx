import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { VStack } from "@astryxdesign/core/Stack";
import { useSpace } from "#/lib/use-team";
import { PeopleField } from "./people-field";

/**
 * Who in the team can see a checklist, a tag or a tracker: everyone, or the
 * people ticked. Once it exists, the same choice sits at the top of its page;
 * see `VisibilityButton`.
 *
 * Whoever keeps it to a few people is always one of them, and the team's
 * admin sees everything, so nobody can lock the team out of its own work.
 * Outside a team there is nobody to keep anything from, and it draws nothing.
 */
export function VisibilityField({
	value,
	onChange,
}: {
	/** The addresses allowed, or `null` for everyone. */
	value: Array<string> | null;
	onChange: (value: Array<string> | null) => void;
}) {
	const space = useSpace();
	const team = space?.team ?? null;
	if (space === null || team === null) return null;

	return (
		<VStack gap={2}>
			<RadioList
				label="Who can see it"
				description="The team's admin and viewers can always see everything."
				value={value === null ? "everyone" : "chosen"}
				onChange={(next) =>
					onChange(next === "everyone" ? null : (value ?? [space.email]))
				}
			>
				<RadioListItem value="everyone" label={`Everyone in ${team.name}`} />
				<RadioListItem value="chosen" label="Only the people ticked" />
			</RadioList>

			{value === null ? null : (
				<PeopleField
					label="People who can see it"
					isLabelHidden
					members={team.members}
					value={value}
					onChange={onChange}
				/>
			)}
		</VStack>
	);
}
