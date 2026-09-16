/**
 * The small sounds that confirm a change.
 *
 * Adding, ticking, deleting, moving, tagging, recording a reading — each has a
 * sound of its own, short and quiet enough to be felt more than heard: a
 * confirmation, never a notification. They are synthesised rather than
 * recorded, so there are no files to fetch and nothing to wait for.
 *
 * Every change gets one, since every change is something the user did; which
 * one is decided in `soundFor`, and anything without a sound of its own falls
 * back to the barely-there tap rather than to silence.
 *
 * Nothing is pitched much below 250 Hz: a phone's or a laptop's speaker
 * barely plays anything lower, so a sound down there was simply not heard.
 */

import type { Change } from "#/schemas/change";

export type Sound =
	| "add"
	| "join"
	| "role"
	| "check"
	| "uncheck"
	| "delete"
	| "move"
	| "tag"
	| "progress"
	| "tap";

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
	// Three notes climbing: someone new in the team.
	join: (audio) => {
		tone(audio, { from: 523, to: 523, seconds: 0.05, volume: 0.025 });
		tone(audio, {
			from: 659,
			to: 659,
			seconds: 0.05,
			volume: 0.025,
			delay: 0.05,
		});
		tone(audio, {
			from: 784,
			to: 784,
			seconds: 0.09,
			volume: 0.02,
			delay: 0.1,
		});
	},
	// Two level notes a fourth apart: someone's standing changed, nothing
	// came or went.
	role: (audio) => {
		tone(audio, { from: 587, to: 587, seconds: 0.06, volume: 0.025 });
		tone(audio, {
			from: 784,
			to: 784,
			seconds: 0.08,
			volume: 0.02,
			delay: 0.06,
		});
	},
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
	// Falling an octave: gone.
	delete: (audio) =>
		tone(audio, { from: 520, to: 260, seconds: 0.12, volume: 0.045 }),
	// The same note twice: the same thing, somewhere else. Moving a task to
	// another checklist, or along to another stage — nothing came, nothing went.
	move: (audio) => {
		tone(audio, { from: 640, to: 640, seconds: 0.045, volume: 0.022 });
		tone(audio, {
			from: 640,
			to: 640,
			seconds: 0.055,
			volume: 0.022,
			delay: 0.07,
		});
	},
	// A short blip, high and quick: a label stuck on, or peeled off.
	tag: (audio) =>
		tone(audio, { from: 980, to: 1180, seconds: 0.04, volume: 0.02 }),
	// A long climb: a reading recorded, further up the same slope.
	progress: (audio) =>
		tone(audio, { from: 480, to: 720, seconds: 0.13, volume: 0.028 }),
	// Barely there: anything else that changed.
	tap: (audio) =>
		tone(audio, { from: 1100, to: 950, seconds: 0.03, volume: 0.015 }),
};

function soundFor(change: Change): Sound {
	switch (change.kind) {
		case "checklist.create":
		case "task.create":
		case "tracker.create":
		case "tag.create":
			return "add";
		case "checklist.delete":
		case "task.delete":
		case "tracker.delete":
		case "entry.delete":
		case "tag.delete":
			return "delete";
		// A reading is not a thing added to a list; it is the climb going on.
		case "entry.create":
		case "entry.update":
			return "progress";
		case "task.move":
			return "move";
		case "task.update":
			if (change.patch.completed === true) return "check";
			if (change.patch.completed === false) return "uncheck";
			// Along to another stage is the same journey as into another list.
			if (change.patch.stageId !== undefined) return "move";
			if (change.patch.tagIds !== undefined) return "tag";
			return "tap";
		default:
			return "tap";
	}
}

/**
 * Play a sound for something the user has just done: a change, or something
 * that is not one — a person added to a team, a role changed.
 *
 * Only ever called from something the user did — a click, a key — which is
 * what a browser waits for before a page may make a sound. Without audio it is
 * simply skipped: the sound is a nicety, never the confirmation itself.
 */
export function playSound(sound: Sound): void {
	if (typeof AudioContext === "undefined") return;

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

/** Play the sound for a change the user has just made. */
export function playChangeSound(change: Change): void {
	playSound(soundFor(change));
}
