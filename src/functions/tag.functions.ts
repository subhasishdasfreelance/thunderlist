import { createServerFn } from "@tanstack/react-start";
import { listTags } from "#/data/tag.server";
import { requireUserId } from "#/lib/auth.server";
import { guard } from "./guard";

export const listTagsFn = createServerFn().handler(() =>
	guard("listTags", async () => listTags(await requireUserId())),
);
