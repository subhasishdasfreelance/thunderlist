import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ChevronRight,
	Copy,
	MonitorSmartphone,
	User,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ErrorNotice } from "#/components/common/states";
import {
	createNotificationCodeFn,
	deleteNotificationCodeFn,
} from "#/functions/notification-code.functions";
import { errorMessage } from "#/lib/errors";
import { currentSubscription } from "#/lib/push";
import { useToast } from "#/lib/toasts";
import { useSpace } from "#/lib/use-team";
import { queryKeys } from "#/queries/keys";
import { notificationCodesQuery } from "#/queries/reminders";
import type {
	CodeRecipients,
	CreateNotificationCodeInput,
	NotificationCode,
} from "#/schemas/notification-code";
import { memberName } from "#/schemas/team";
import { CodeDialog, NewCodeDialog } from "./notification-code-dialog";

const KIND_ICONS = { device: MonitorSmartphone, person: User, team: Users };

/**
 * Your notification codes in the space being worked in: each one's name, who
 * it notifies and when it was last used. Making one, and everything about one
 * — the code, how to send with it, deleting it — opens in a popup.
 *
 * Both draw at once, the request going out behind them; a code the server
 * turns down is taken back off the list, with why.
 */
export function NotificationCodes({
	isCreating,
	onCreatingChange,
}: {
	isCreating: boolean;
	onCreatingChange: (isCreating: boolean) => void;
}) {
	const space = useSpace();
	const toast = useToast();
	const queryClient = useQueryClient();
	const codes = useQuery(notificationCodesQuery());
	const [openCode, setOpenCode] = useState<string | null>(null);
	// This device's subscription, to tell its codes from another device's.
	const [endpoint, setEndpoint] = useState<string | null>(null);

	useEffect(() => {
		void currentSubscription().then((subscription) =>
			setEndpoint(subscription?.endpoint ?? null),
		);
	}, []);

	/** Who a code notifies, to go mid-sentence: "everyone in Acme". */
	function recipientOf(to: CodeRecipients): string {
		switch (to.kind) {
			case "device":
				return to.endpoint === endpoint
					? "this device only"
					: "another device of yours only";
			case "person": {
				if (to.email === space?.email) return "you, on every device";
				const member = space?.team?.members.find(
					(each) => each.email === to.email,
				);
				return `${member ? memberName(member) : to.email}, on every device`;
			}
			case "team":
				return `everyone in ${space?.team?.name ?? "the team"}`;
		}
	}

	function create(input: CreateNotificationCodeInput) {
		const key = queryKeys.notificationCodes;
		queryClient.setQueryData<Array<NotificationCode>>(key, (list = []) => [
			{ ...input, createdAt: new Date().toISOString(), lastUsedAt: null },
			...list,
		]);
		setOpenCode(input.code);

		createNotificationCodeFn({ data: input })
			.catch((error) => {
				queryClient.setQueryData<Array<NotificationCode>>(key, (list = []) =>
					list.filter((each) => each.code !== input.code),
				);
				toast({
					body: errorMessage(error),
					type: "error",
					uniqueID: "notification-code",
				});
			})
			.finally(() => void queryClient.invalidateQueries({ queryKey: key }));
	}

	function remove(code: string) {
		const key = queryKeys.notificationCodes;
		queryClient.setQueryData<Array<NotificationCode>>(key, (list = []) =>
			list.filter((each) => each.code !== code),
		);
		setOpenCode(null);

		deleteNotificationCodeFn({ data: { code } })
			.catch((error) =>
				toast({
					body: errorMessage(error),
					type: "error",
					uniqueID: "notification-code",
				}),
			)
			// Back from the server either way: gone, or there again.
			.finally(() => void queryClient.invalidateQueries({ queryKey: key }));
	}

	function copy(code: string) {
		navigator.clipboard.writeText(code).then(
			() => toast({ body: "Code copied.", uniqueID: "notification-code" }),
			() =>
				toast({
					body: "Couldn't copy it. Open the code and copy it from there.",
					type: "error",
					uniqueID: "notification-code",
				}),
		);
	}

	const list = codes.data ?? [];
	// A code taken back off the list closes with it.
	const open = list.find((each) => each.code === openCode) ?? null;

	return (
		<>
			{codes.isError ? (
				<ErrorNotice error={codes.error} onRetry={() => void codes.refetch()} />
			) : codes.data === undefined ? (
				<SectionSpinner label="Loading codes…" />
			) : list.length === 0 ? (
				<Card padding={4}>
					<Text type="supporting">
						No codes yet. Make one, and a script, a server or another site can
						send a notification with a single request.
					</Text>
				</Card>
			) : (
				<Card padding={0}>
					<List hasDividers>
						{list.map((code) => (
							<ListItem
								key={code.code}
								startContent={
									<Icon icon={KIND_ICONS[code.to.kind]} color="secondary" />
								}
								label={code.label}
								description={
									<>
										Notifies {recipientOf(code.to)} ·{" "}
										{code.lastUsedAt === null ? (
											"never used"
										) : (
											<>
												used{" "}
												<Timestamp value={code.lastUsedAt} format="relative" />
											</>
										)}
									</>
								}
								endContent={
									<HStack gap={1.5} vAlign="center">
										<IconButton
											label={`Copy the code for ${code.label}`}
											tooltip="Copy code"
											icon={<Copy aria-hidden />}
											variant="ghost"
											size="sm"
											onClick={() => copy(code.code)}
										/>
										<IconButton
											label={`Open ${code.label}`}
											tooltip="Code and how to send"
											icon={<ChevronRight aria-hidden />}
											variant="ghost"
											size="sm"
											onClick={() => setOpenCode(code.code)}
										/>
									</HStack>
								}
							/>
						))}
					</List>
				</Card>
			)}

			<NewCodeDialog
				isOpen={isCreating}
				onOpenChange={onCreatingChange}
				onCreate={create}
			/>
			<CodeDialog
				code={open}
				recipient={open === null ? "" : recipientOf(open.to)}
				onClose={() => setOpenCode(null)}
				onDelete={remove}
			/>
		</>
	);
}
