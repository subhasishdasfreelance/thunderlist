import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
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
import {
	ACCESS_LABELS,
	ACCESS_LEVELS,
	ACCESS_SUMMARIES,
	type AccessEntry,
	type AccessLevel,
	roleCeiling,
} from "#/schemas/access";
import {
	memberName,
	ROLE_LABELS,
	roleCan,
	type TeamMember,
} from "#/schemas/team";

/** What someone starts on when they are first put on a list. */
const FIRST_LEVEL: AccessLevel = "edit";

/**
 * Who may do what with one checklist, tag or tracker.
 *
 * The same shape as the picker a task is assigned with — a search and a row a
 * person — with one thing more on each row: how far in they are allowed.
 * Picking a row puts someone on the list; the menu beside them says what they
 * may do once they are.
 *
 * Whoever is setting this is on the list and runs it, and the admin and the
 * viewers are on every list by right, so a team can never be locked out of its
 * own work. A role still caps what a level means — a collaborator given Full
 * adds and deletes nothing — and the row says so where that bites.
 */
export function AccessDialog({
	isOpen,
	onOpenChange,
	title,
	subtitle,
	noun,
	members,
	value,
	isReadOnly = false,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title: string;
	subtitle?: string;
	/** What this is — "checklist", "tag", "tracker" — for its words. */
	noun: string;
	members: ReadonlyArray<TeamMember>;
	/** Who is on it when it opens; `null` for the whole team. */
	value: ReadonlyArray<AccessEntry> | null;
	/** Set when this person may only look; nothing can be changed. */
	isReadOnly?: boolean;
	onSubmit: (value: Array<AccessEntry> | null) => void;
}) {
	const space = useSpace();
	const [chosen, setChosen] = useState<Array<AccessEntry> | null>([]);
	const [query, setQuery] = useState("");

	// What it is now, every time it opens, with a fresh search.
	useEffect(() => {
		if (!isOpen) return;
		setChosen(value === null ? null : value.map((entry) => ({ ...entry })));
		setQuery("");
	}, [isOpen, value]);

	const needle = query.trim().toLowerCase();
	const shown = members.filter(
		(member) =>
			needle === "" ||
			member.email.includes(needle) ||
			(member.name ?? "").toLowerCase().includes(needle),
	);

	/** Always on the list, whatever it says: they see everything anyway. */
	const isByRight = (member: TeamMember) =>
		roleCan(member.role, "seeEverything");

	const entryFor = (member: TeamMember) =>
		chosen?.find((entry) => entry.email === member.email);

	const levelOf = (member: TeamMember): AccessLevel | null => {
		if (isByRight(member)) return roleCeiling(member.role);
		if (chosen === null) return roleCeiling(member.role);
		return entryFor(member)?.level ?? null;
	};

	function toggle(member: TeamMember) {
		if (isReadOnly || chosen === null || isByRight(member)) return;
		setChosen(
			entryFor(member) === undefined
				? [...chosen, { email: member.email, level: FIRST_LEVEL }]
				: chosen.filter((entry) => entry.email !== member.email),
		);
	}

	function setLevel(member: TeamMember, level: AccessLevel) {
		if (isReadOnly || chosen === null) return;
		setChosen(
			entryFor(member) === undefined
				? [...chosen, { email: member.email, level }]
				: chosen.map((entry) =>
						entry.email === member.email ? { ...entry, level } : entry,
					),
		);
	}

	const onCount = members.filter((member) => levelOf(member) !== null).length;

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={title}
			subtitle={subtitle}
			width={520}
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
				{!isReadOnly ? null : (
					<Text type="supporting">
						Only the admin and whoever runs this {noun} can change who is on it.
					</Text>
				)}

				<RadioList
					label="Who it is for"
					isLabelHidden
					isDisabled={isReadOnly}
					value={chosen === null ? "everyone" : "chosen"}
					onChange={(next) =>
						setChosen(
							next === "everyone"
								? null
								: value !== null
									? value.map((entry) => ({ ...entry }))
									: space === null
										? []
										: [{ email: space.email, level: "full" }],
						)
					}
				>
					<RadioListItem
						value="everyone"
						label="Everyone in the team"
						description="Each at whatever their role allows, anyone who joins later included."
					/>
					<RadioListItem
						value="chosen"
						label="Only the people picked"
						description="Everyone else doesn't see it at all."
					/>
				</RadioList>

				<HStack gap={2} hAlign="between" vAlign="center">
					<Text type="label" weight="semibold" color="secondary">
						{onCount} of {members.length}{" "}
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
							const level = levelOf(member);
							const byRight = isByRight(member);
							const ceiling = roleCeiling(member.role);
							const isMe = member.email === space?.email;

							return (
								<ListItem
									key={member.email}
									isSelected={level !== null}
									isDisabled={isReadOnly || chosen === null || byRight}
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
										byRight
											? `${ROLE_LABELS[member.role]}, sees everything`
											: ROLE_LABELS[member.role],
									].join(" · ")}
									endContent={
										<LevelControl
											level={level}
											/*
											 * Nobody reaches past their role, so the levels above it
											 * are not offered: a menu that hands out something the
											 * server will not honour is a lie.
											 */
											ceiling={ceiling}
											isFixed={isReadOnly || chosen === null || byRight}
											onChange={(next) => setLevel(member, next)}
										/>
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

/** What one person may do, as a word — and, where it can change, a menu. */
function LevelControl({
	level,
	ceiling,
	isFixed,
	onChange,
}: {
	level: AccessLevel | null;
	ceiling: AccessLevel;
	isFixed: boolean;
	onChange: (level: AccessLevel) => void;
}) {
	if (level === null) return null;

	const offered = ACCESS_LEVELS.slice(0, ACCESS_LEVELS.indexOf(ceiling) + 1);

	if (isFixed || offered.length < 2) {
		return (
			<Text type="supporting" color="secondary">
				{ACCESS_LABELS[level]}
			</Text>
		);
	}

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			menuWidth={280}
			button={{
				label: ACCESS_LABELS[level],
				variant: "ghost",
				size: "sm",
			}}
			items={[
				{
					type: "section" as const,
					title: "Can",
					items: offered.map((each) => ({
						id: each,
						label: ACCESS_LABELS[each],
						description: ACCESS_SUMMARIES[each],
						endContent:
							each === level ? (
								<Icon icon={Check} size="sm" color="accent" />
							) : undefined,
						onClick: () => onChange(each),
					})),
				},
			]}
		/>
	);
}
