import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { RotateCw } from "lucide-react";
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
					<Button
						label="Try again"
						icon={<RotateCw aria-hidden />}
						size="sm"
						onClick={onRetry}
					/>
				) : undefined
			}
		/>
	);
}
