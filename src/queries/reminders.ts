import { queryOptions } from "@tanstack/react-query";
import { getPushKeyFn, listRemindersFn } from "#/functions/reminder.functions";
import { queryKeys } from "./keys";

/** This person's reminders; see `Reminder`. */
export const remindersQuery = () =>
	queryOptions({
		queryKey: queryKeys.reminders,
		queryFn: () => listRemindersFn(),
		staleTime: 60_000,
	});

/** The key notifications are subscribed with, or `null` if none is set up. */
export const pushKeyQuery = () =>
	queryOptions({
		queryKey: ["push-key"] as const,
		queryFn: () => getPushKeyFn(),
		staleTime: Number.POSITIVE_INFINITY,
	});
