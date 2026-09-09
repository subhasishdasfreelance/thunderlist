/**
 * Stable, sortable, prefixed ids.
 *
 * Ids are the only identity in Thunderlist, and they are minted in the browser
 * so a change can be shown, referred to by a later change and replayed on the
 * server without being renumbered. Mongo's own `_id` is never used for this.
 * The timestamp prefix keeps ids roughly sortable by creation time.
 */

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export const ID_PREFIX = {
	checklist: "chk",
	tracker: "trk",
	task: "tsk",
	entry: "ent",
	listItem: "itm",
	tag: "tag",
	/** Identifies a queued change in the browser; never written to the database. */
	change: "chg",
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

function randomSuffix(length: number): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const byte of bytes) {
		out += ID_ALPHABET[byte % ID_ALPHABET.length];
	}
	return out;
}

export function createId(prefix: IdPrefix): string {
	return `${prefix}_${Date.now().toString(36)}${randomSuffix(6)}`;
}
