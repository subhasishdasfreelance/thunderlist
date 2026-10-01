import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { applyBatched, useApplyChange } from "#/lib/changes";
import { useToast } from "#/lib/toasts";
import { invertChange, UndoContext, type UndoStep, useUndo } from "#/lib/undo";
import { isTyping } from "#/lib/use-row-shortcuts";
import { useSpace } from "#/lib/use-team";
import type { Change } from "#/schemas/change";

/** How far back Ctrl+Z goes. Further than anyone reaches, short of a log. */
const DEPTH = 20;

/**
 * Ctrl+Z, from anywhere in the app.
 *
 * Every change made while reading a list hands in its undo as it goes out; see
 * `invertChange`. They stack up here, and Ctrl+Z — or the Undo in the top bar,
 * which is how a touch screen gets at it; see `UndoButton` — takes the top one
 * off and applies it. Nothing is announced as it is done: the change is on
 * screen already, and a toast on every tick is only noise.
 * Undoing something that deletes a task or writes one back asks first, as
 * pressing the same thing on screen would; that question is drawn by
 * `UndoQuestion`, inside the theme, rather than here.
 *
 * Not while typing: a text field has an undo of its own, and taking Ctrl+Z off
 * a half-written task to reverse something else entirely is the opposite of
 * what the key means there.
 *
 * The undo is applied without being recorded — `useApplyChange` remembers
 * nothing outside the provider, and this sits above it — so pressing Ctrl+Z
 * twice goes two steps back rather than flipping between two.
 */
export function UndoProvider({ children }: { children: ReactNode }) {
	const client = useQueryClient();
	const { apply } = useApplyChange();
	const toast = useToast();
	// Each with the change it undoes, so a refused change's can be taken out,
	// and when it was made.
	const steps = useRef<Array<UndoStep & { source: Change; at: number }>>([]);
	const [asking, setAsking] = useState<UndoStep | null>(null);
	// What the top step takes back, for the button; `null` with nothing to undo.
	const [latest, setLatest] = useState<string | null>(null);

	const keep = useCallback(
		(next: Array<UndoStep & { source: Change; at: number }>) => {
			steps.current = next;
			setLatest(next.at(-1)?.label ?? null);
		},
		[],
	);

	/*
	 * Drawn at once, like any change, and said to be done at once too: the
	 * history is kept here in the browser, so there is nothing to wait for
	 * before saying so. The save follows behind, as for anything else.
	 *
	 * Putting a deleted task back is two changes — the task, then the rest of
	 * what it carried — and the second names a task the first has to have
	 * written already. Both are drawn now; the second is only sent once the
	 * first has landed; see `sendingTasks`. A failure puts the screen back and
	 * is reported by `useApplyChange`.
	 *
	 * Every edit and move in a step goes as one batch, so taking back a pick
	 * of twenty is one request rather than twenty; see `applyBatched`.
	 */
	const run = useCallback(
		(step: UndoStep) => {
			applyBatched(apply, (collect) => {
				for (const change of step.changes) collect(change);
			});
			toast({
				body: `Undone: ${step.label.toLowerCase()}.`,
				type: "info",
				uniqueID: "undo",
			});
		},
		[apply, toast],
	);

	/** Take the last step back, asking first where it deletes or writes a task. */
	const undoLast = useCallback(() => {
		const step = steps.current[steps.current.length - 1];
		if (step === undefined) {
			toast({ body: "Nothing to undo.", type: "info", uniqueID: "undo" });
			return;
		}

		keep(steps.current.slice(0, -1));
		if (step.question === null) run(step);
		else setAsking(step);
	}, [keep, run, toast]);

	const remember = useCallback(
		(change: Change) => {
			const inverse = invertChange(client, change);
			if (inverse === null) return;

			/*
			 * Parking a task is an edit — Today taken off it — and then a move,
			 * made together; see `moveToBacklog`. Undone, it is one thing done,
			 * so the two are one step: moved back, then the edit put back.
			 */
			const top = steps.current[steps.current.length - 1];
			const isParking =
				top !== undefined &&
				change.kind === "task.move" &&
				top.source.kind === "task.update" &&
				top.source.taskId === change.taskId &&
				Date.now() - top.at < 1000;
			const step = isParking
				? { ...inverse, changes: [...inverse.changes, ...top.changes] }
				: inverse;

			keep(
				[
					...(isParking ? steps.current.slice(0, -1) : steps.current),
					{ ...step, source: change, at: Date.now() },
				].slice(-DEPTH),
			);
		},
		[client, keep],
	);

	useEffect(() => {
		function handle(event: KeyboardEvent) {
			if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return;
			if (event.key.toLowerCase() !== "z") return;
			if (isTyping(event.target)) return;

			event.preventDefault();
			undoLast();
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [undoLast]);

	const forget = useCallback(
		(change: Change) => {
			keep(steps.current.filter((step) => step.source !== change));
		},
		[keep],
	);

	/*
	 * What was done in one space is not there to undo in another: the tasks
	 * are the other space's, and the undo would be sent where they are not.
	 * Switching space starts the history afresh. Nothing is known while the
	 * new space is still being read, so that is waited out.
	 */
	const space = useSpace();
	const where = space === null ? null : (space.team?.teamId ?? "own");
	useEffect(() => {
		if (where !== null) keep([]);
	}, [where, keep]);

	const value = useMemo(
		() => ({
			remember,
			forget,
			latest,
			undoLast,
			asking,
			confirm: () => {
				if (asking !== null) run(asking);
				setAsking(null);
			},
			dismiss: () => setAsking(null),
		}),
		[remember, forget, latest, undoLast, asking, run],
	);

	return <UndoContext value={value}>{children}</UndoContext>;
}

/**
 * The question asked before an undo that deletes a task or writes one back.
 *
 * Drawn inside the frame rather than by the provider, which wraps it: the
 * theme's own styles are scoped to the element `Theme` renders, so a dialog
 * outside it would come out in Astryx's default colours and type.
 */
export function UndoQuestion() {
	const undo = useUndo();

	return (
		<AlertDialog
			isOpen={undo?.asking != null}
			onOpenChange={(open) => {
				if (!open) undo?.dismiss();
			}}
			title="Undo that?"
			description={undo?.asking?.question ?? ""}
			actionLabel="Undo"
			onAction={() => undo?.confirm()}
		/>
	);
}

/**
 * Undo, in the top bar: Ctrl+Z for a touch screen, where there is no key, and
 * the same on a desktop, where it is one less thing to remember.
 *
 * Only there while something can be taken back, and it says what: the step
 * is named in its tooltip and to a screen reader.
 */
export function UndoButton() {
	const undo = useUndo();
	if (undo?.latest == null) return null;

	return (
		<IconButton
			label={`Undo: ${undo.latest.toLowerCase()}`}
			tooltip={`Undo: ${undo.latest.toLowerCase()} (Ctrl+Z)`}
			variant="ghost"
			size="md"
			icon={<Undo2 aria-hidden size={22} absoluteStrokeWidth />}
			onClick={undo.undoLast}
		/>
	);
}
