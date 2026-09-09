import { createServerFn } from "@tanstack/react-start";
import { listTags } from "#/data/tag.server";
import { guard } from "./guard";

export const listTagsFn = createServerFn().handler(() =>
	guard("listTags", () => listTags()),
);
