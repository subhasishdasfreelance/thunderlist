/**
 * The small sounds that confirm a change.
 *
 * Adding, ticking, deleting — each has a sound of its own, short and quiet
 * enough to be felt more than heard: a confirmation, never a notification.
 * They are synthesised rather than recorded, so there are no files to fetch
 * and nothing to wait for.
 */

import type { Change } from "#/schemas/change";

type Sound = "add" | "check" | "uncheck" | "delete" | "tap";

/** The same sound again within this is the same sound: ten pasted tasks are one chime. */
const REPEAT_MS = 80;

let context: AudioContext | null = null;
const lastPlayed = new Map<Sound, number>();

/**
 * One soft note: a sine gliding from one pitch to another, faded in and out so
 * it never clicks.
 */
function tone(
	audio: AudioContext,
	note: {
		from: number;
		to: number;
		seconds: number;
		volume: number;
		delay?: number;
	},
): void {
	const start = audio.currentTime + (note.delay ?? 0);
	const end = start + note.seconds;
	const oscillator = audio.createOscillator();
	const gain = audio.createGain();

	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(note.from, start);
	oscillator.frequency.exponentialRampToValueAtTime(note.to, end);

	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(note.volume, start + 0.006);
	gain.gain.exponentialRampToValueAtTime(0.0001, end);

	oscillator.connect(gain).connect(audio.destination);
	oscillator.start(start);
	oscillator.stop(end + 0.02);
}

const SOUNDS: Record<Sound, (audio: AudioContext) => void> = {
	// Rising: something arrived.
	add: (audio) =>
		tone(audio, { from: 560, to: 840, seconds: 0.08, volume: 0.03 }),
	// Two quick notes, up: done.
	check: (audio) => {
		tone(audio, { from: 880, to: 880, seconds: 0.06, volume: 0.025 });
		tone(audio, {
			from: 1320,
			to: 1320,
			seconds: 0.09,
			volume: 0.02,
			delay: 0.05,
		});
	},
	// Falling: undone.
	uncheck: (audio) =>
		tone(audio, { from: 660, to: 440, seconds: 0.07, volume: 0.025 }),
	// Low and falling further: gone.
	delete: (audio) =>
		tone(audio, { from: 300, to: 150, seconds: 0.11, volume: 0.04 }),
	// Barely there: anything else that changed.
	tap: (audio) =>
		tone(audio, { from: 1100, to: 950, seconds: 0.03, volume: 0.015 }),
};

function soundFor(change: Change): Sound {
	switch (change.kind) {
		case "checklist.create":
		case "task.create":
		case "tracker.create":
		case "entry.create":
		case "tag.create":
			return "add";
		case "checklist.delete":
		case "task.delete":
		case "tracker.delete":
		case "entry.delete":
		case "tag.delete":
			return "delete";
		case "task.update":
			if (change.patch.completed === true) return "check";
			if (change.patch.completed === false) return "uncheck";
			return "tap";
		default:
			return "tap";
	}
}

/**
 * Play the sound for a change the user has just made.
 *
 * Only ever called from something the user did — a click, a key — which is
 * what a browser waits for before a page may make a sound. Without audio it is
 * simply skipped: the sound is a nicety, never the confirmation itself.
 */
export function playChangeSound(change: Change): void {
	if (typeof AudioContext === "undefined") return;

	const sound = soundFor(change);
	const now = performance.now();
	if (now - (lastPlayed.get(sound) ?? Number.NEGATIVE_INFINITY) < REPEAT_MS) {
		return;
	}
	lastPlayed.set(sound, now);

	try {
		context ??= new AudioContext();
		if (context.state === "suspended") void context.resume();
		SOUNDS[sound](context);
	} catch {
		// No audio device, or the browser said no: the change stands regardless.
	}
}
