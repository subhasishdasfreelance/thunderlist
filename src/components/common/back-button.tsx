import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/**
 * The way back out of a detail screen.
 *
 * A button rather than a link, because it is an action on this screen and not a
 * piece of the sentence around it: the arrow says which way it goes and the
 * hit target is a target, which on a phone is the difference between reaching
 * it and reaching past it.
 */
export function BackButton({ to, label }: { to: string; label: string }) {
	const navigate = useNavigate();

	return (
		// Pinned to the start of the row: a stacked child would otherwise centre
		// itself, and a back control in the middle of the screen reads as a title.
		<HStack hAlign="start">
			<Button
				label={label}
				variant="ghost"
				size="sm"
				icon={<ChevronLeft aria-hidden />}
				onClick={() => void navigate({ to })}
			/>
		</HStack>
	);
}
