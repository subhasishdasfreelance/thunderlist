import { Icon } from "@astryxdesign/core/Icon";
import { Token } from "@astryxdesign/core/Token";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { PACE_STATUS_LABELS, type PaceStatus } from "#/schemas/checklist";

const TONE = {
	ahead: { color: "green", icon: TrendingUp },
	on_track: { color: "blue", icon: Minus },
	behind: { color: "orange", icon: TrendingDown },
} as const;

/**
 * "Ahead", "On track" or "Behind".
 *
 * Renders nothing when there is no status, so a card never shows an invented
 * judgement. The wording carries the meaning on its own; the colour and the
 * arrow are reinforcement rather than the only signal. Behind is amber, not
 * red: being behind on a personal goal is information, not an error.
 */
export function PaceLabel({ status }: { status: PaceStatus | null }) {
	if (status === null) return null;

	const { color, icon: StatusIcon } = TONE[status];

	return (
		<Token
			size="sm"
			color={color}
			// A token does not size what it is handed; the smallest icon matches
			// its small text.
			icon={<Icon icon={StatusIcon} size="xsm" />}
			label={PACE_STATUS_LABELS[status]}
		/>
	);
}
