import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronRight } from "lucide-react";
import { useState } from "react";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ErrorNotice } from "#/components/common/states";
import { createAiTokenFn, deleteAiTokenFn } from "#/functions/ai.functions";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";
import { useSpace } from "#/lib/use-team";
import { aiTokensQuery } from "#/queries/ai";
import { queryKeys } from "#/queries/keys";
import type { AiToken, CreateAiTokenInput } from "#/schemas/ai-token";
import { AiTokenDialog, NewAiTokenDialog } from "./ai-token-dialog";

/**
 * Your AI access tokens: each one's name, the space it works in and when it
 * was last used. Making one, and everything about one — how to give it to an
 * assistant, deleting it — opens in a popup.
 *
 * Both draw at once, the request going out behind them; a token the server
 * turns down is taken back off the list, with why.
 */
export function AiTokens({
	isCreating,
	onCreatingChange,
}: {
	isCreating: boolean;
	onCreatingChange: (isCreating: boolean) => void;
}) {
	const space = useSpace();
	const toast = useToast();
	const queryClient = useQueryClient();
	const tokens = useQuery(aiTokensQuery());
	const [openTokenId, setOpenTokenId] = useState<string | null>(null);
	// The secret of the token just made, the one time it is known.
	const [fresh, setFresh] = useState<{
		tokenId: string;
		secret: string;
	} | null>(null);

	function create(input: CreateAiTokenInput) {
		const key = queryKeys.aiTokens;
		const team = space?.team ?? null;
		queryClient.setQueryData<Array<AiToken>>(key, (list = []) => [
			{
				tokenId: input.tokenId,
				label: input.label,
				hint: input.secret.slice(-4),
				space: team === null ? null : { teamId: team.teamId, name: team.name },
				createdAt: new Date().toISOString(),
				lastUsedAt: null,
			},
			...list,
		]);
		setFresh({ tokenId: input.tokenId, secret: input.secret });
		setOpenTokenId(input.tokenId);

		createAiTokenFn({ data: input })
			.catch((error) => {
				queryClient.setQueryData<Array<AiToken>>(key, (list = []) =>
					list.filter((each) => each.tokenId !== input.tokenId),
				);
				toast({
					body: errorMessage(error),
					type: "error",
					uniqueID: "ai-token",
				});
			})
			.finally(() => void queryClient.invalidateQueries({ queryKey: key }));
	}

	function remove(tokenId: string) {
		const key = queryKeys.aiTokens;
		queryClient.setQueryData<Array<AiToken>>(key, (list = []) =>
			list.filter((each) => each.tokenId !== tokenId),
		);
		close();

		deleteAiTokenFn({ data: { tokenId } })
			.catch((error) =>
				toast({
					body: errorMessage(error),
					type: "error",
					uniqueID: "ai-token",
				}),
			)
			// Back from the server either way: gone, or there again.
			.finally(() => void queryClient.invalidateQueries({ queryKey: key }));
	}

	function close() {
		setOpenTokenId(null);
		// Closed, the secret is gone for good.
		setFresh(null);
	}

	const list = tokens.data ?? [];
	// A token taken back off the list closes with it.
	const open = list.find((each) => each.tokenId === openTokenId) ?? null;

	return (
		<>
			{tokens.isError ? (
				<ErrorNotice
					error={tokens.error}
					onRetry={() => void tokens.refetch()}
				/>
			) : tokens.data === undefined ? (
				<SectionSpinner label="Loading tokens…" />
			) : list.length === 0 ? (
				<Card padding={4}>
					<Text type="supporting">
						No tokens yet. Make one, and an assistant like Claude Code can add
						tasks, tick them off, plan, track and run your teams for you.
					</Text>
				</Card>
			) : (
				<Card padding={0}>
					<List hasDividers>
						{list.map((token) => (
							<ListItem
								key={token.tokenId}
								startContent={<Icon icon={Bot} color="secondary" />}
								label={token.label}
								description={
									<>
										Works in {token.space?.name ?? "your own space"} ·{" "}
										{token.lastUsedAt === null ? (
											"never used"
										) : (
											<>
												used{" "}
												<Timestamp value={token.lastUsedAt} format="relative" />
											</>
										)}
									</>
								}
								endContent={
									<IconButton
										label={`Open ${token.label}`}
										tooltip="Setup and delete"
										icon={<ChevronRight aria-hidden />}
										variant="ghost"
										size="sm"
										onClick={() => setOpenTokenId(token.tokenId)}
									/>
								}
							/>
						))}
					</List>
				</Card>
			)}

			<NewAiTokenDialog
				isOpen={isCreating}
				onOpenChange={onCreatingChange}
				onCreate={create}
			/>
			<AiTokenDialog
				token={open}
				secret={
					fresh !== null && fresh.tokenId === openTokenId ? fresh.secret : null
				}
				onClose={close}
				onDelete={remove}
			/>
		</>
	);
}
