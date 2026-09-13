import {
	CheckboxList,
	CheckboxListItem,
} from "@astryxdesign/core/CheckboxList";
import { memberName, type TeamMember } from "#/schemas/team";

/**
 * People in the team, to tick: who a task or a tracker is for, or who can see
 * a checklist or a tag.
 */
export function PeopleField({
	label,
	description,
	isLabelHidden = false,
	members,
	value,
	onChange,
}: {
	label: string;
	description?: string;
	isLabelHidden?: boolean;
	members: ReadonlyArray<TeamMember>;
	/** The addresses ticked. */
	value: Array<string>;
	onChange: (value: Array<string>) => void;
}) {
	return (
		<CheckboxList
			label={label}
			description={description}
			isLabelHidden={isLabelHidden}
			value={value}
			onChange={onChange}
			hasDividers
		>
			{members.map((member) => (
				<CheckboxListItem
					key={member.email}
					value={member.email}
					label={memberName(member)}
					description={member.name === null ? undefined : member.email}
				/>
			))}
		</CheckboxList>
	);
}
