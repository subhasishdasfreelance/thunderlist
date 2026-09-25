import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Send } from "lucide-react";
import { useEffect, useState } from "react";
import {
	ReminderField,
	setReminder,
	useReminderTime,
} from "#/components/common/reminder-field";
import { sendTestPushFn } from "#/functions/reminder.functions";
import { useApplyChange } from "#/lib/changes";
import { errorMessage } from "#/lib/errors";
import {
	canPush,
	currentSubscription,
	turnOffPush,
	turnOnPush,
} from "#/lib/push";
import { useToast } from "#/lib/toasts";
import { pushKeyQuery } from "#/queries/reminders";

type DeviceState = "checking" | "unavailable" | "off" | "on" | "denied";

/**
 * Notifications: whether this device gets them, and the daily review.
 *
 * The daily review is a person's, and follows them to every space. Reminders
 * about one checklist, tracker or tag are set from its edit dialog; they all
 * arrive on the devices turned on here.
 */
export function NotificationSettings() {
	const { apply } = useApplyChange();
	const toast = useToast();
	const key = useQuery(pushKeyQuery());
	const dayTime = useReminderTime("day", null);
	const [device, setDevice] = useState<DeviceState>("checking");
	const [isBusy, setIsBusy] = useState(false);

	// What this device is doing, read once the browser is here to ask.
	useEffect(() => {
		if (!canPush()) {
			setDevice("unavailable");
			return;
		}
		if (Notification.permission === "denied") {
			setDevice("denied");
			return;
		}
		void currentSubscription().then((subscription) =>
			setDevice(subscription === null ? "off" : "on"),
		);
	}, []);

	async function run(action: () => Promise<void>) {
		setIsBusy(true);
		try {
			await action();
		} catch (error) {
			toast({ body: errorMessage(error), type: "error", uniqueID: "push" });
		} finally {
			setIsBusy(false);
		}
	}

	const isSetUp = key.data != null;

	const deviceLine: Record<DeviceState, string> = {
		checking: "Checking this device…",
		unavailable:
			"This browser can't show notifications. On a phone, add Thunderlist to the home screen and open it from there.",
		off: "Off on this device.",
		on: "On for this device.",
		denied:
			"Blocked for this site. Allow notifications in the browser's site settings, then come back.",
	};

	return (
		<Card padding={4}>
			<VStack gap={4}>
				{key.isPending ? null : !isSetUp ? (
					<Text type="supporting">
						Notifications aren't set up on this server yet: it needs its push
						keys and a scheduler. See "Reminders" in the README.
					</Text>
				) : (
					<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
						<Text>{deviceLine[device]}</Text>
						<HStack gap={1.5} vAlign="center">
							{device === "on" ? (
								<>
									<Button
										label="Send a test"
										icon={<Send aria-hidden />}
										variant="ghost"
										size="sm"
										isDisabled={isBusy}
										onClick={() =>
											void run(async () => {
												const sent = await sendTestPushFn();
												if (sent === 0) {
													toast({
														body: "No device took it. Turn notifications off and on again here.",
														type: "error",
														uniqueID: "push",
													});
												}
											})
										}
									/>
									<Button
										label="Turn off"
										icon={<BellOff aria-hidden />}
										variant="secondary"
										size="sm"
										isDisabled={isBusy}
										onClick={() =>
											void run(async () => {
												await turnOffPush();
												setDevice("off");
											})
										}
									/>
								</>
							) : device === "off" ? (
								<Button
									label="Turn on"
									icon={<Bell aria-hidden />}
									variant="primary"
									size="sm"
									isDisabled={isBusy}
									onClick={() =>
										void run(async () => {
											const result = await turnOnPush(key.data ?? "");
											setDevice(
												result === "on"
													? "on"
													: result === "denied"
														? "denied"
														: "unavailable",
											);
										})
									}
								/>
							) : null}
						</HStack>
					</HStack>
				)}

				<Divider />

				<ReminderField
					label="Daily review"
					description="A reminder each day to go over Today and what is left. Clear it to stop."
					value={dayTime}
					onChange={(time) => setReminder(apply, "day", null, time)}
				/>
			</VStack>
		</Card>
	);
}
