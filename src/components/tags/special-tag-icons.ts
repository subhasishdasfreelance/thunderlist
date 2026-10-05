import { type LucideIcon, Target, Zap } from "lucide-react";
import type { SpecialTag } from "#/schemas/tag";

/**
 * The mark of each special tag, wherever the tag itself is drawn.
 *
 * Today's is the app's bolt — the same one on every row that puts a task on
 * it. Current focus's is a bullseye: what is being aimed at. Switched on, its
 * centre fills, hit; see `.thunderlist-flag[data-flag="focus"]`.
 */
export const SPECIAL_TAG_ICONS: Record<SpecialTag, LucideIcon> = {
	today: Zap,
	focus: Target,
};
