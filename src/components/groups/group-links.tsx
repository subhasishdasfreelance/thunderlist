import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Folders } from "lucide-react";
import { stageColorStyle } from "#/components/common/stage-dot";
import { groupsQuery } from "#/queries/space";
import type { GroupItemKind } from "#/schemas/group";

/**
 * The groups something is in, over its title: a pill each, in the group's
 * colour, that opens it. Nothing while the groups load, or when it is in none.
 */
export function GroupLinks({ kind, id }: { kind: GroupItemKind; id: string }) {
	const { data } = useQuery(groupsQuery());
	const groups = (data ?? []).filter((group) =>
		group.items.some((item) => item.kind === kind && item.id === id),
	);
	if (groups.length === 0) return null;

	return (
		<div className="mb-1 flex flex-wrap gap-1.5">
			{groups.map((group) => (
				<Link
					key={group.groupId}
					to="/groups/$groupId"
					params={{ groupId: group.groupId }}
					className="thunderlist-group-link no-underline"
					style={stageColorStyle(group.color)}
					title={`Open the group ${group.name}`}
				>
					<Folders aria-hidden size={13} />
					<span>{group.name}</span>
				</Link>
			))}
		</div>
	);
}
