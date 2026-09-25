import { Button } from "@astryxdesign/core/Button";
import { Markdown } from "@astryxdesign/core/Markdown";
import {
	SegmentedControl,
	SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Check, FileUp, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { FadeImage } from "#/components/common/fade-image";
import { FormDialog } from "#/components/common/form-dialog";
import { type Plan, planTitleFrom } from "#/schemas/plan";

export type PlanValues = { title: string; body: string };

/** An image in a plan, drawn as every image in the app is. */
const MARKDOWN_COMPONENTS = {
	image: ({ src, alt }: { src: string; alt: string }) => (
		<FadeImage src={src} alt={alt} />
	),
};

/**
 * Write a plan, or bring one in from a `.md` file.
 *
 * A file fills the body — and the title too, while that is still empty, from
 * the file's first heading or its name — so a document written elsewhere is
 * one pick away from being here. Either way it can be read over before it is
 * saved, in Preview.
 */
export function PlanFormDialog({
	isOpen,
	onOpenChange,
	plan,
	initial,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The plan being edited; absent for a new one. */
	plan?: Plan;
	/** What a new plan starts as — a file picked before the dialog opened. */
	initial?: PlanValues;
	onSubmit: (values: PlanValues) => void;
}) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [view, setView] = useState<"write" | "preview">("write");
	const [readError, setReadError] = useState<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: read as it opens, not followed while it is open.
	useEffect(() => {
		if (!isOpen) return;
		setTitle(plan?.title ?? initial?.title ?? "");
		setBody(plan?.body ?? initial?.body ?? "");
		setView(plan === undefined && initial !== undefined ? "preview" : "write");
		setReadError(null);
	}, [isOpen]);

	async function importFile(file: File) {
		try {
			const text = await file.text();
			setBody(text);
			if (title.trim() === "") setTitle(planTitleFrom(file.name, text));
			setView("preview");
			setReadError(null);
		} catch {
			setReadError("That file could not be read.");
		}
	}

	const trimmed = title.trim();
	const problem = trimmed === "" ? "Give it a title." : null;

	function submit(event: FormEvent) {
		event.preventDefault();
		if (problem !== null) return;
		onSubmit({ title: trimmed, body });
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={plan ? "Edit plan" : "New plan"}
			width={720}
			onSubmit={submit}
			actions={(formId) => (
				<HStack gap={2} hAlign="end" vAlign="center">
					{problem === null ? null : <Text type="supporting">{problem}</Text>}
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={plan ? "Save changes" : "Create plan"}
						icon={<Check aria-hidden />}
						variant="primary"
						type="submit"
						form={formId}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<TextInput
					autoComplete="off"
					label="Title"
					isRequired
					value={title}
					onChange={setTitle}
					placeholder="Q4 roadmap"
				/>

				<VStack gap={2}>
					<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
						<SegmentedControl
							label="Show the plan as"
							size="sm"
							value={view}
							onChange={(next) => setView(next as "write" | "preview")}
						>
							<SegmentedControlItem value="write" label="Write" />
							<SegmentedControlItem value="preview" label="Preview" />
						</SegmentedControl>
						<Button
							label="Import .md file"
							variant="secondary"
							size="sm"
							icon={<FileUp aria-hidden />}
							onClick={() => fileRef.current?.click()}
						/>
						<input
							ref={fileRef}
							type="file"
							accept=".md,.markdown,.txt,text/markdown,text/plain"
							hidden
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) void importFile(file);
								event.target.value = "";
							}}
						/>
					</HStack>

					{readError === null ? null : (
						<Text type="supporting" color="secondary">
							{readError}
						</Text>
					)}

					{view === "write" ? (
						<div className="thunderlist-resizable">
							<TextArea
								autoComplete="off"
								label="Plan"
								isLabelHidden
								rows={16}
								value={body}
								onChange={setBody}
								placeholder="Write in Markdown, or import a .md file."
								width="100%"
							/>
						</div>
					) : body.trim() === "" ? (
						<Text type="supporting">Nothing written yet.</Text>
					) : (
						<div className="thunderlist-plan-body">
							<Markdown components={MARKDOWN_COMPONENTS}>{body}</Markdown>
						</div>
					)}
				</VStack>
			</VStack>
		</FormDialog>
	);
}
