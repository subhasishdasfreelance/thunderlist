import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { FormDialog } from "#/components/common/form-dialog";
import { setBackdropFn } from "#/functions/preferences.functions";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";
import { queryKeys } from "#/queries/keys";
import { backdropsQuery } from "#/queries/preferences";
import {
	type Backdrops,
	backdropOf,
	ILLUSTRATIONS,
	type IllustrationId,
	illustrationUrl,
	SECTION_LABELS,
	type Section,
} from "#/schemas/backdrop";

/**
 * Pick the illustration at the foot of one part of the app. It is this
 * person's own: the same on every device, and nobody else's.
 *
 * A pick is drawn at once, behind the dialog, so the choice can be seen in
 * place before it is kept; the saving follows.
 */
export function BackdropDialog({
	section,
	isOpen,
	onOpenChange,
}: {
	section: Section;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const backdrops = useQuery(backdropsQuery()).data;
	const current = backdropOf(backdrops, section);

	function pick(illustrationId: IllustrationId | null) {
		if (illustrationId === current) return;
		const key = queryKeys.backdrops;
		const before = queryClient.getQueryData<Backdrops>(key);
		queryClient.setQueryData<Backdrops>(key, (all) => ({
			...all,
			[section]: illustrationId,
		}));

		setBackdropFn({ data: { section, illustrationId } }).catch((error) => {
			queryClient.setQueryData<Backdrops>(key, before);
			toast({ body: errorMessage(error), type: "error", uniqueID: "backdrop" });
		});
	}

	const choices: Array<{
		illustrationId: IllustrationId | null;
		title: string;
	}> = [{ illustrationId: null, title: "None" }, ...ILLUSTRATIONS];

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={`Illustration for ${SECTION_LABELS[section]}`}
			subtitle="Just for you, on every device."
			width={640}
			actions={() => (
				<Button
					label="Done"
					icon={<Check aria-hidden />}
					variant="primary"
					onClick={() => onOpenChange(false)}
				/>
			)}
		>
			<Grid columns={{ minWidth: 132 }} gap={2}>
				{choices.map((choice) => (
					<SelectableCard
						key={choice.illustrationId ?? "none"}
						label={choice.title}
						isSelected={choice.illustrationId === current}
						onChange={() => pick(choice.illustrationId)}
						padding={2}
					>
						<VStack gap={1.5}>
							<div className="thunderlist-art-thumb">
								{choice.illustrationId === null ? null : (
									<img
										src={illustrationUrl(choice.illustrationId)}
										alt=""
										loading="lazy"
									/>
								)}
							</div>
							<Text type="supporting">{choice.title}</Text>
						</VStack>
					</SelectableCard>
				))}
			</Grid>
		</FormDialog>
	);
}
