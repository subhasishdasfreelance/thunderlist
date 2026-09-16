import { Button } from "@astryxdesign/core/Button";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Users } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useSpace } from "#/lib/use-team";
import {
	ACCESS_LABELS,
	type AccessEntry,
	levelFor,
	roleCeiling,
} from "#/schemas/access";
import { memberName } from "#/schemas/team";
import { AccessDialog } from "./access-dialog";

/**
 * The list a new checklist, tag or tracker starts with: its author alone,
 * running it.
 *
 * `null` — everyone — outside a team, where there is nobody to keep anything
 * from, and where the field is not drawn at all.
 */
export function useOwnAlone(): Array<AccessEntry> | null {
	const space = useSpace();
	const email = space?.team === null ? null : (space?.email ?? null);

	return useMemo(
		() => (email === null ? null : [{ email, level: "full" }]),
		[email],
	);
}

/**
 * Who a checklist, a tag or a tracker is for, while it is being written.
 *
 * Two choices and a list: the whole team, or the people picked — and for each
 * of those, how far in they may go. The list itself is chosen in the same
 * popup the page uses once the thing exists, rather than a second control that
 * does the same job differently; see `AccessDialog`.
 *
 * A new one starts with its author alone on it, so adding someone to a team
 * hands them nothing until they are put on something. Whoever is writing it is
 * always on the list and runs it, and the admin and viewers see everything, so
 * nobody can lock the team out of its own work.
 *
 * Memoised, like the other sections of a form: a list of the team's people is
 * not drawn again on every keystroke in the title.
 */
export const AccessField = memo(function AccessField({
	noun,
	value,
	onChange,
}: {
	/** What this is — "checklist", "tag", "tracker" — for its words. */
	noun: string;
	/** Who may do what, or `null` for the whole team. */
	value: Array<AccessEntry> | null;
	onChange: (value: Array<AccessEntry> | null) => void;
}) {
	const space = useSpace();
	const [isPicking, setIsPicking] = useState(false);

	const team = space?.team ?? null;
	if (space === null || team === null) return null;

	const on = team.members.filter(
		(member) => levelFor(member.role, member.email, value) !== null,
	);
	const named = on
		.map(
			(member) =>
				`${memberName(member)} (${ACCESS_LABELS[
					// Shown as it will be read: capped by the role, as the server caps it.
					levelFor(member.role, member.email, value) ?? roleCeiling(member.role)
				].toLowerCase()})`,
		)
		.join(", ");

	return (
		<VStack gap={2}>
			<RadioList
				label="Who it is for"
				description="The team's admin and viewers can always see everything."
				value={value === null ? "everyone" : "chosen"}
				onChange={(next) =>
					onChange(
						next === "everyone"
							? null
							: (value ?? [{ email: space.email, level: "full" }]),
					)
				}
			>
				<RadioListItem value="everyone" label={`Everyone in ${team.name}`} />
				<RadioListItem value="chosen" label="Only the people picked" />
			</RadioList>

			{value === null ? null : (
				<VStack gap={1}>
					<HStack hAlign="start">
						<Button
							label={
								on.length === 1 && on[0].email === space.email
									? "Only you — pick people…"
									: `${on.length} ${on.length === 1 ? "person" : "people"} — change…`
							}
							variant="secondary"
							size="sm"
							icon={<Users aria-hidden />}
							onClick={() => setIsPicking(true)}
						/>
					</HStack>
					{named === "" ? null : <Text type="supporting">{named}</Text>}
				</VStack>
			)}

			<AccessDialog
				isOpen={isPicking}
				onOpenChange={setIsPicking}
				title={`Who this ${noun} is for`}
				subtitle={`${on.length} of ${team.members.length} people in ${team.name}.`}
				noun={noun}
				members={team.members}
				value={value}
				onSubmit={(next) => {
					onChange(next);
					setIsPicking(false);
				}}
			/>
		</VStack>
	);
});
