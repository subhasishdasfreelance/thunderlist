import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useToast } from "@astryxdesign/core/Toast";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { createTeamFn } from "#/functions/team.functions";
import { errorMessage } from "#/lib/errors";
import { playSound } from "#/lib/sounds";
import { useSpaceChanged } from "#/lib/use-space-changed";

/**
 * Make a team, and go into it.
 *
 * Only a name: the people are added from the team's own dialog, once it exists
 * and there is somewhere for them to be added to.
 */
export function NewTeamDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const toast = useToast();
	const spaceChanged = useSpaceChanged();
	const [name, setName] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (isOpen) setName("");
	}, [isOpen]);

	const trimmed = name.trim();

	async function create() {
		if (trimmed === "" || isSaving) return;
		setIsSaving(true);
		playSound("add");

		try {
			// The server moves this browser into the new team as it makes it.
			await createTeamFn({ data: { name: trimmed } });
			onOpenChange(false);
			await spaceChanged();
		} catch (error) {
			toast({ body: errorMessage(error), type: "error", uniqueID: "team" });
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="New team"
			subtitle="A space of its own, shared with the people you add to it."
			width={420}
			actions={() => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Create team"
						icon={<Check aria-hidden />}
						variant="primary"
						isDisabled={trimmed === ""}
						isLoading={isSaving}
						onClick={() => void create()}
					/>
				</HStack>
			)}
		>
			<TextInput
				autoComplete="off"
				label="Name"
				isRequired
				value={name}
				onChange={setName}
				onEnter={() => void create()}
				placeholder="Design team"
			/>
		</FormDialog>
	);
}
