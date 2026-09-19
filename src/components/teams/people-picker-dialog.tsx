import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Check, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { useSpace } from "#/lib/use-team";
import { memberName, ROLE_LABELS, type TeamMember } from "#/schemas/team";

/**
 * People in the team, to pick: who a task is for, or who can see a checklist,
 * a tag or a tracker.
 *
 * One dialog for both, so choosing people works the same wherever it is done:
 * a search across names and addresses, and a row per person — their face, who
 * they are and what they are in the team — that is picked by pressing it. A
 * team can be a hundred people, which is past what a list of checkboxes can be
 * scanned in.
 */
export function PeoplePickerDialog({
	isOpen,
	onOpenChange,
	title,
	subtitle,
	members,
	value,
	everyoneLabel,
	lockedNote,
	readOnlyNote,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title: string;
	subtitle?: string;
	members: ReadonlyArray<TeamMember>;
	/** Who is picked when it opens; `null` for everyone, see `everyoneLabel`. */
	value: ReadonlyArray<string> | null;
	/**
	 * Offer "everyone" as well as a list — for who can see something, where
	 * everyone includes whoever joins later. Left out, a list is all there is.
	 */
	everyoneLabel?: string;
	/** Why someone is always included and cannot be taken off, if they are. */
	lockedNote?: (member: TeamMember) => string | null;
	/** Set when this person may only look; says why, and nothing can change. */
	readOnlyNote?: string;
	onSubmit: (value: Array<string> | null) => void;
}) {
	const space = useSpace();
	const [chosen, setChosen] = useState<Array<string> | null>([]);
	const [query, setQuery] = useState("");
	const isReadOnly = readOnlyNote !== undefined;

	// What it is now, every time it opens, with a fresh search.
	useEffect(() => {
		if (!isOpen) return;
		setChosen(value === null ? null : [...value]);
		setQuery("");
	}, [isOpen, value]);

	const needle = query.trim().toLowerCase();
	const shown = members.filter(
		(member) =>
			needle === "" ||
			member.email.includes(needle) ||
			(member.name ?? "").toLowerCase().includes(needle),
	);

	const isLocked = (member: TeamMember) => lockedNote?.(member) != null;
	const isPicked = (member: TeamMember) =>
		chosen === null || chosen.includes(member.email) || isLocked(member);
	const pickedCount = members.filter(isPicked).length;

	function toggle(member: TeamMember) {
		if (isReadOnly || chosen === null || isLocked(member)) return;
		setChosen(
			chosen.includes(member.email)
				? chosen.filter((email) => email !== member.email)
				: [...chosen, member.email],
		);
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={title}
			subtitle={subtitle}
			width={460}
			actions={() =>
				isReadOnly ? (
					<Button
						label="Close"
						variant="secondary"
						onClick={() => onOpenChange(false)}
					/>
				) : (
					<HStack gap={2} hAlign="end">
						<Button
							label="Cancel"
							icon={<X aria-hidden />}
							variant="ghost"
							onClick={() => onOpenChange(false)}
						/>
						<Button
							label="Save"
							icon={<Check aria-hidden />}
							variant="primary"
							onClick={() => onSubmit(chosen)}
						/>
					</HStack>
				)
			}
		>
			<VStack gap={3}>
				{readOnlyNote === undefined ? null : (
					<Text type="supporting">{readOnlyNote}</Text>
				)}

				{everyoneLabel === undefined ? null : (
					<RadioList
						label="Who can see it"
						isLabelHidden
						isDisabled={isReadOnly}
						value={chosen === null ? "everyone" : "chosen"}
						onChange={(next) =>
							setChosen(
								next === "everyone"
									? null
									: value === null
										? space === null
											? []
											: [space.email]
										: [...value],
							)
						}
					>
						<RadioListItem
							value="everyone"
							label={everyoneLabel}
							description="Including anyone who joins later."
						/>
						<RadioListItem
							value="chosen"
							label="Only the people picked"
							description="Everyone else doesn't see it at all."
						/>
					</RadioList>
				)}

				<HStack gap={2} hAlign="between" vAlign="center">
					<Text type="label" weight="semibold" color="secondary">
						{pickedCount} of {members.length}{" "}
						{members.length === 1 ? "person" : "people"}
					</Text>
					{chosen === null || chosen.length === 0 || isReadOnly ? null : (
						<Button
							label="Clear"
							variant="ghost"
							size="sm"
							onClick={() => setChosen([])}
						/>
					)}
				</HStack>

				<TextInput
					autoComplete="off"
					label="Search people"
					isLabelHidden
					placeholder="Search by name or email"
					startIcon={<Search aria-hidden />}
					value={query}
					onChange={setQuery}
					width="100%"
				/>

				{shown.length === 0 ? (
					<EmptyState
						isCompact
						title="No one matches"
						description={`Nobody in the team matches "${query.trim()}".`}
					/>
				) : (
					<List hasDividers className="thunderlist-picker-list">
						{shown.map((member) => {
							const note = lockedNote?.(member) ?? null;
							const isOn = isPicked(member);
							const isMe = member.email === space?.email;

							return (
								<ListItem
									key={member.email}
									isSelected={isOn}
									isDisabled={isReadOnly || chosen === null || note !== null}
									onClick={() => toggle(member)}
									startContent={
										<Avatar
											size="md"
											name={memberName(member)}
											src={member.image ?? undefined}
											tooltip={false}
										/>
									}
									label={
										isMe ? `${memberName(member)} (you)` : memberName(member)
									}
									description={[
										member.name === null ? "Not signed in yet" : member.email,
										note ?? ROLE_LABELS[member.role],
									].join(" · ")}
									endContent={
										isOn ? (
											<Icon icon={Check} size="sm" color="accent" />
										) : undefined
									}
								/>
							);
						})}
					</List>
				)}
			</VStack>
		</FormDialog>
	);
}
