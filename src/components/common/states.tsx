import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { VStack } from "@astryxdesign/core/Stack";
import { errorMessage } from "#/lib/errors";

/**
 * A failed read, shown in place of the content it replaces.
 *
 * Messages come from the server's `AppError`s, which are written for users;
 * anything unexpected has already been replaced with a safe message.
 */
export function ErrorNotice({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry?: () => void;
}) {
	return (
		<Banner
			status="error"
			title="Something went wrong"
			description={errorMessage(error)}
			collapsible={false}
			endContent={
				onRetry ? (
					<Button label="Try again" size="sm" onClick={onRetry} />
				) : undefined
			}
		/>
	);
}

/** Card-shaped placeholders, sized to the cards they stand in for. */
export function CardListSkeleton({ count = 3 }: { count?: number }) {
	return (
		<VStack gap={3}>
			{Array.from({ length: count }, (_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
				<Card key={index} padding={3}>
					<VStack gap={2}>
						<Skeleton height={16} width="60%" index={index} />
						<Skeleton height={8} radius="rounded" index={index} />
						<Skeleton height={12} width="35%" index={index} />
					</VStack>
				</Card>
			))}
		</VStack>
	);
}

/** Row-shaped placeholders for task and history lists. */
export function RowListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<VStack gap={3}>
			{Array.from({ length: count }, (_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
				<Skeleton key={index} height={20} index={index} />
			))}
		</VStack>
	);
}
