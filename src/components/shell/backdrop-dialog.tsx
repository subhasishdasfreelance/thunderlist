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
	type Backdrop,
	type Backdrops,
	backdropOf,
	followerNoun,
	type Page,
	pageLabel,
	paletteColors,
	SECTION_PALETTES,
} from "#/schemas/backdrop";
import { DESIGNS, PALETTES } from "#/schemas/backdrop-designs";
import { BackdropArt } from "./backdrop-art";

/**
 * Pick how one page is drawn behind it: its colours, and its design or none.
 * It is this person's own — the same on every device, and nobody else's.
 *
 * A pick is drawn at once, behind the dialog, so it can be seen in place
 * before it is kept; the saving follows.
 */
export function BackdropDialog({
	page,
	isOpen,
	onOpenChange,
}: {
	page: Page;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const toast = useToast();
	const backdrops = useQuery(backdropsQuery()).data;
	const current = backdropOf(backdrops, page);
	const colors = paletteColors(current, page.section);
	const follower = followerNoun(page);

	function pick(change: Partial<Backdrop>) {
		const next = { ...current, ...change };
		const key = queryKeys.backdrops;
		const before = queryClient.getQueryData<Backdrops>(key);
		queryClient.setQueryData<Backdrops>(key, (all) => ({
			...all,
			[page.key]: next,
		}));

		setBackdropFn({ data: { page: page.key, ...next } }).catch((error) => {
			queryClient.setQueryData<Backdrops>(key, before);
			toast({ body: errorMessage(error), type: "error", uniqueID: "backdrop" });
		});
	}

	const own = PALETTES.find(
		(each) => each.paletteId === SECTION_PALETTES[page.section],
	);

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={`Background for ${pageLabel(page)}`}
			subtitle={
				follower === null
					? "Just for you, on every device."
					: `Just for you, on every device. Each ${follower} without one of its own uses it too.`
			}
			width={720}
			actions={() => (
				<Button
					label="Done"
					icon={<Check aria-hidden />}
					variant="primary"
					onClick={() => onOpenChange(false)}
				/>
			)}
		>
			<VStack gap={4}>
				<VStack gap={2}>
					<Text type="label" weight="semibold">
						Colours
					</Text>
					<Grid columns={{ minWidth: 104 }} gap={2}>
						{[
							{
								paletteId: null,
								name: "Page colours",
								colors: own?.colors ?? colors,
							},
							...PALETTES,
						].map((palette) => (
							<SelectableCard
								key={palette.paletteId ?? "own"}
								label={palette.name}
								isSelected={palette.paletteId === current.palette}
								onChange={() => pick({ palette: palette.paletteId })}
								padding={2}
							>
								<VStack gap={1.5}>
									<span className="thunderlist-palette-swatch">
										{palette.colors.map((color) => (
											<span key={color} style={{ backgroundColor: color }} />
										))}
									</span>
									<Text type="supporting" maxLines={1}>
										{palette.name}
									</Text>
								</VStack>
							</SelectableCard>
						))}
					</Grid>
				</VStack>

				<VStack gap={2}>
					<Text type="label" weight="semibold">
						Design
					</Text>
					<Grid columns={{ minWidth: 132 }} gap={2}>
						<SelectableCard
							label="None"
							isSelected={current.design === null}
							onChange={() => pick({ design: null })}
							padding={2}
						>
							<VStack gap={1.5}>
								<div className="thunderlist-art-thumb" />
								<Text type="supporting">None</Text>
							</VStack>
						</SelectableCard>
						{DESIGNS.map((design) => (
							<SelectableCard
								key={design.designId}
								label={design.name}
								isSelected={design.designId === current.design}
								onChange={() => pick({ design: design.designId })}
								padding={2}
							>
								<VStack gap={1.5}>
									<div className="thunderlist-art-thumb">
										<BackdropArt designId={design.designId} colors={colors} />
									</div>
									<Text type="supporting" maxLines={1}>
										{design.name}
									</Text>
								</VStack>
							</SelectableCard>
						))}
					</Grid>
				</VStack>
			</VStack>
		</FormDialog>
	);
}
