import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading } from "@astryxdesign/core/Heading";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Markdown } from "@astryxdesign/core/Markdown";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { BackButton } from "#/components/common/back-button";
import { FadeImage } from "#/components/common/fade-image";
import { numberTitle } from "#/components/common/item-number";
import { LoadingState } from "#/components/common/loading-state";
import { ErrorNotice } from "#/components/common/states";
import { PlanFormDialog } from "#/components/plans/plan-form-dialog";
import { AccessButton } from "#/components/teams/access-button";
import { useApplyChange } from "#/lib/changes";
import { formatDate } from "#/lib/format-date";
import { useToast } from "#/lib/toasts";
import { useNow } from "#/lib/use-now";
import { useItemPermissions } from "#/lib/use-team";
import { planQuery } from "#/queries/plans";
import { primeQuery } from "#/queries/prime";
import { todayDateOnly } from "#/schemas/common";

export const Route = createFileRoute("/plans/$planId")({
	loader: ({ context, params }) =>
		primeQuery(context.queryClient, planQuery(params.planId)),
	component: PlanPage,
});

/** An image in a plan, drawn as every image in the app is. */
const MARKDOWN_COMPONENTS = {
	image: ({ src, alt }: { src: string; alt: string }) => (
		<FadeImage src={src} alt={alt} />
	),
};

/** Hand the plan back as the `.md` file it could have come from. */
function download(title: string, body: string) {
	const url = URL.createObjectURL(
		new Blob([body], { type: "text/markdown;charset=utf-8" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "plan"}.md`;
	link.click();
	URL.revokeObjectURL(url);
}

/** One plan, to be read; editing it opens over the page. */
function PlanPage() {
	const { planId } = Route.useParams();
	const navigate = useNavigate();
	const { apply } = useApplyChange();
	const toast = useToast();
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const { data, isError, error, refetch } = useQuery(planQuery(planId));
	// Their role, narrowed by the plan's access list; see `useItemPermissions`.
	const { canManageContent } = useItemPermissions(data?.access);
	// The day on the viewer's clock, once the browser has it; see `useNow`.
	const now = useNow();

	if (data === undefined) {
		return (
			<VStack gap={4}>
				<BackButton to="/plans" label="Plans" />
				{isError ? (
					<ErrorNotice error={error} onRetry={() => void refetch()} />
				) : (
					<LoadingState />
				)}
			</VStack>
		);
	}

	function copy(body: string) {
		navigator.clipboard.writeText(body).then(
			() => toast({ body: "Plan copied.", uniqueID: "plan-copy" }),
			() =>
				toast({
					body: "Couldn't copy it. Download the .md instead.",
					type: "error",
					uniqueID: "plan-copy",
				}),
		);
	}

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<BackButton to="/plans" label="Plans" />
				<AccessButton
					noun="plan"
					access={data.access}
					canChange={canManageContent}
					onChange={(access) =>
						apply({ kind: "plan.update", planId, patch: { access } })
					}
				/>
			</HStack>

			<HStack gap={2} hAlign="between" vAlign="start">
				<VStack gap={0.5}>
					<Heading level={1}>{data.title}</Heading>
					<Text type="supporting">
						Updated{" "}
						{formatDate(
							now === null
								? data.updatedAt.slice(0, 10)
								: todayDateOnly(new Date(data.updatedAt)),
						)}
					</Text>
				</VStack>

				<HStack gap={1} vAlign="center">
					{data.body.trim() === "" ? null : (
						<IconButton
							label="Copy plan"
							tooltip="Copy plan"
							icon={<Copy aria-hidden />}
							variant="ghost"
							onClick={() => copy(data.body)}
						/>
					)}
					<DropdownMenu
						hasChevron={false}
						placement="below"
						alignment="end"
						button={{
							label: "Plan actions",
							tooltip: "Plan actions",
							variant: "ghost",
							isIconOnly: true,
							icon: <MoreHorizontal aria-hidden />,
						}}
						items={[
							// Headed by its number; see `numberTitle`.
							{
								type: "section" as const,
								title: numberTitle("plan", data.number),
								items: [
									...(canManageContent
										? [
												{
													label: "Edit plan",
													icon: Pencil,
													onClick: () => setIsEditing(true),
												},
											]
										: []),
									{
										label: "Download .md",
										icon: Download,
										onClick: () => download(data.title, data.body),
									},
								],
							},
							...(canManageContent
								? [
										{ type: "divider" as const },
										{
											label: "Delete plan",
											icon: Trash2,
											variant: "destructive" as const,
											onClick: () => setIsDeleting(true),
										},
									]
								: []),
						]}
					/>
				</HStack>
			</HStack>

			<Card padding={6}>
				{data.body.trim() === "" ? (
					<Text type="supporting">Nothing written yet.</Text>
				) : (
					<div className="thunderlist-plan-body">
						<Markdown
							components={MARKDOWN_COMPONENTS}
							// The full width of the card, not Astryx's 680px default.
							contentWidth="100%"
							// A link opens beside the app, not in place of it.
							onLinkClick={(href) => {
								window.open(href, "_blank", "noopener,noreferrer");
								return false;
							}}
						>
							{data.body}
						</Markdown>
					</div>
				)}
			</Card>

			<PlanFormDialog
				isOpen={isEditing}
				onOpenChange={setIsEditing}
				plan={data}
				onSubmit={(values) => {
					const patch = {
						...(values.title === data.title ? {} : { title: values.title }),
						...(values.body === data.body ? {} : { body: values.body }),
						...(JSON.stringify(values.access) ===
						JSON.stringify(data.access ?? null)
							? {}
							: { access: values.access }),
					};
					// Saved unchanged is nothing to send.
					if (Object.keys(patch).length > 0) {
						apply({ kind: "plan.update", planId, patch });
					}
					setIsEditing(false);
				}}
			/>

			<AlertDialog
				isOpen={isDeleting}
				onOpenChange={setIsDeleting}
				title={`Delete ${data.title}?`}
				description="The plan will be deleted."
				actionLabel="Delete"
				onAction={() => {
					apply({ kind: "plan.delete", planId });
					setIsDeleting(false);
					void navigate({ to: "/plans" });
				}}
			/>
		</VStack>
	);
}
