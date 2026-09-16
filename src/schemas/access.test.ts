import { describe, expect, it } from "bun:test";
import {
	type AccessEntry,
	accessFromVisibleTo,
	levelFor,
	reaches,
	roleCeiling,
} from "./access";

const ANA = "ana@example.com";
const BO = "bo@example.com";

describe("roleCeiling", () => {
	it("is as far as the role itself goes", () => {
		expect(roleCeiling("admin")).toBe("full");
		expect(roleCeiling("manager")).toBe("full");
		expect(roleCeiling("collaborator")).toBe("edit");
		expect(roleCeiling("viewer")).toBe("read");
	});
});

describe("reaches", () => {
	it("compares two levels", () => {
		expect(reaches("full", "edit")).toBe(true);
		expect(reaches("edit", "edit")).toBe(true);
		expect(reaches("edit", "full")).toBe(false);
		expect(reaches("read", "edit")).toBe(false);
	});
});

describe("levelFor", () => {
	const list: Array<AccessEntry> = [
		{ email: ANA, level: "full" },
		{ email: BO, level: "read" },
	];

	it("gives nothing to someone the list leaves out", () => {
		expect(levelFor("manager", "cy@example.com", list)).toBeNull();
		expect(levelFor("collaborator", "cy@example.com", list)).toBeNull();
	});

	it("gives what the list says, while the role allows it", () => {
		expect(levelFor("manager", ANA, list)).toBe("full");
		expect(levelFor("manager", BO, list)).toBe("read");
	});

	/*
	 * A list can narrow what a role allows, never widen it: the thing it is
	 * about is one checklist, and what someone may do in the team at all is a
	 * different question, answered once.
	 */
	it("never hands out more than the role does", () => {
		expect(levelFor("collaborator", ANA, list)).toBe("edit");
		expect(levelFor("viewer", ANA, list)).toBe("read");
	});

	it("is the whole team, at their own ceiling, with no list", () => {
		expect(levelFor("manager", ANA, null)).toBe("full");
		expect(levelFor("collaborator", ANA, null)).toBe("edit");
		expect(levelFor("manager", "cy@example.com", undefined)).toBe("full");
	});

	it("puts the admin and viewers on every list by right", () => {
		expect(levelFor("admin", "cy@example.com", list)).toBe("full");
		expect(levelFor("viewer", "cy@example.com", list)).toBe("read");
	});
});

describe("accessFromVisibleTo", () => {
	/*
	 * The old field said who could see something and left what they could do to
	 * their role. Read as Full and capped by the role, that is exactly what
	 * those people could already do — so nothing changes for anything stored
	 * before levels existed.
	 */
	it("reads an old audience as a list nobody is promoted by", () => {
		const migrated = accessFromVisibleTo([ANA, BO]);

		expect(migrated).toEqual([
			{ email: ANA, level: "full" },
			{ email: BO, level: "full" },
		]);
		expect(levelFor("collaborator", ANA, migrated)).toBe("edit");
		expect(levelFor("manager", ANA, migrated)).toBe("full");
		expect(levelFor("manager", "cy@example.com", migrated)).toBeNull();
	});

	it("leaves everyone's as everyone's", () => {
		expect(accessFromVisibleTo(null)).toBeNull();
		expect(accessFromVisibleTo(undefined)).toBeNull();
	});
});
