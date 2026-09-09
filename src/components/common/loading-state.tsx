import { Center } from "@astryxdesign/core/Center";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

/**
 * Waiting for something to arrive.
 *
 * Grey bars pretending to be rows are a worse lie than an honest wait: they
 * promise a shape the answer may not have — six tasks when there are two, a
 * list where there is an empty state — so the screen jumps when the real thing
 * lands. This says what is happening instead, once, in the middle.
 *
 * The mark is the app's own bolt, drawn here rather than loaded, so it can take
 * the current text colour and needs no second request while the first is still
 * in flight.
 */
export function LoadingState({ label = "Please wait…" }: { label?: string }) {
	return (
		<Center>
			<VStack gap={3} hAlign="center" paddingBlock={8}>
				<span className="thunderlist-loading-mark">
					<svg
						width="56"
						height="56"
						viewBox="0 0 280 280"
						role="img"
						aria-label="Loading"
					>
						<title>Loading</title>
						<path
							d="M249.399,96.583h-83.404L216.382,0H88.419L30.628,166.161h79.712L71.906,280.027L249.399,96.583z"
							fill="currentColor"
						/>
					</svg>
				</span>

				<VStack gap={2} hAlign="center">
					<Spinner size="md" aria-label="Loading" />
					<Text type="supporting">{label}</Text>
				</VStack>
			</VStack>
		</Center>
	);
}
