import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

/**
 * One section of a screen, still arriving.
 *
 * The page's headline read lands first and the rest follows, so this marks the
 * part that is still coming without the whole screen turning into a wait. It is
 * deliberately small and quiet: everything above it is already usable, and a
 * full-page "Please wait" here would say the opposite.
 */
export function SectionSpinner({ label = "Loading…" }: { label?: string }) {
	return (
		<HStack gap={2} vAlign="center" paddingBlock={3}>
			<Spinner size="sm" aria-label={label} />
			<Text type="supporting">{label}</Text>
		</HStack>
	);
}
