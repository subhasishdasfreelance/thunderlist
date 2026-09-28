import { describe, expect, it } from "bun:test";
import * as v from "valibot";
import { createNotificationCode } from "#/lib/ids";
import { notificationCodeSchema, notifyInputSchema } from "./notification-code";

describe("notification codes", () => {
	it("mints codes the schema takes, and never the same one twice", () => {
		const first = createNotificationCode();
		expect(v.is(notificationCodeSchema, first)).toBe(true);
		expect(createNotificationCode()).not.toBe(first);
	});

	it("turns down anything else", () => {
		expect(v.is(notificationCodeSchema, "ntf_short")).toBe(false);
		expect(v.is(notificationCodeSchema, "chk_abc")).toBe(false);
	});
});

describe("notifyInputSchema", () => {
	const code = createNotificationCode();

	it("needs only a code and a title", () => {
		const parsed = v.parse(notifyInputSchema, { code, title: " Deployed " });
		expect(parsed).toEqual({ code, title: "Deployed", body: "" });
	});

	it("takes a picture, and a link in the app or on the web", () => {
		for (const url of ["/tags/today", "https://example.com/run/1"]) {
			expect(
				v.is(notifyInputSchema, {
					code,
					title: "Deployed",
					image: "https://example.com/preview.png",
					url,
				}),
			).toBe(true);
		}
	});

	it("turns down a link that is neither", () => {
		for (const url of ["javascript:alert(1)", "tags/today"]) {
			expect(v.is(notifyInputSchema, { code, title: "Deployed", url })).toBe(
				false,
			);
		}
		expect(
			v.is(notifyInputSchema, { code, title: "Deployed", image: "data:x" }),
		).toBe(false);
	});

	it("needs a title", () => {
		expect(v.is(notifyInputSchema, { code, title: "  " })).toBe(false);
		expect(v.is(notifyInputSchema, { code })).toBe(false);
	});
});
