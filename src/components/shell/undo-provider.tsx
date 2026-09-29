import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { useQueryClient } from "@tanstack/react-query";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useApplyChange } from "#/lib/changes";
import { useToast } from "#/lib/toasts";
import { invertChange, UndoContext, type UndoStep, useUndo } from "#/lib/undo";
import { useSpace } from "#/lib/use-team";
import type { Change } from "#/schemas/change";

/** How far back Ctrl+Z goes. Further than anyone reaches, short of a log. */
const DEPTH = 20;

/**
 * Ctrl+Z, from anywhere in the app.
 *
 * Every change made while reading a list hands in its undo as it goes out; see
 * `invertChange`. They stack up here, and Ctrl+Z — or, on a touch screen, the
 * Undo on the toast each step raises — takes the top one off and applies it.
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
	const { applyAsync } = useApplyChange();
	const toast = useToast();
	// Each with the change it undoes, so a refused change's can be taken out,
	// and when it was made.
	const steps = useRef<Array<UndoStep & { source: Change; at: number }>>([]);
	const [asking, setAsking] = useState<UndoStep | null>(null);

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
	 */
	const run = useCallback(
		(step: UndoStep) => {
			for (const change of step.changes) {
				applyAsync(change).catch(() => {});
			}
			toast({
				body: `Undone: ${step.label.toLowerCase()}.`,
				type: "info",
				uniqueID: "undo",
			});
		},
		[applyAsync, toast],
	);

	/** Take the last step back, asking first where it deletes or writes a task. */
	const undoLast = useCallback(() => {
		const step = steps.current[steps.current.length - 1];
		if (step === undefined) {
			toast({ body: "Nothing to undo.", type: "info", uniqueID: "undo" });
			return;
		}

		steps.current = steps.current.slice(0, -1);
		if (step.question === null) run(step);
		else setAsking(step);
	}, [run, toast]);

	/*
	 * On a touch screen there is no Ctrl+Z, so each step is offered as it is
	 * made: a toast naming it, with Undo on it. Only the latest is offered —
	 * each replaces the one before — as Undo takes the latest back. A keyboard
	 * has the key, and a toast on every tick there would only be noise.
	 */
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

			steps.current = [
				...(isParking ? steps.current.slice(0, -1) : steps.current),
				{ ...step, source: change, at: Date.now() },
			].slice(-DEPTH);

			if (!window.matchMedia("(pointer: coarse)").matches) return;
			const dismiss = toast({
				body: `${step.label}.`,
				type: "info",
				uniqueID: "undo",
				endContent: (
					<Button
						label="Undo"
						variant="ghost"
						size="sm"
						onClick={() => {
							dismiss();
							undoLast();
						}}
					/>
				),
			});
		},
		[client, toast, undoLast],
	);

	useEffect(() => {
		function isTyping(target: EventTarget | null): boolean {
			return (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target instanceof HTMLInputElement ||
					target instanceof HTMLTextAreaElement)
			);
		}

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

	const forget = useCallback((change: Change) => {
		steps.current = steps.current.filter((step) => step.source !== change);
	}, []);

	/*
	 * What was done in one space is not there to undo in another: the tasks
	 * are the other space's, and the undo would be sent where they are not.
	 * Switching space starts the history afresh. Nothing is known while the
	 * new space is still being read, so that is waited out.
	 */
	const space = useSpace();
	const where = space === null ? null : (space.team?.teamId ?? "own");
	useEffect(() => {
		if (where !== null) steps.current = [];
	}, [where]);

	const value = useMemo(
		() => ({
			remember,
			forget,
			asking,
			confirm: () => {
				if (asking !== null) run(asking);
				setAsking(null);
			},
			dismiss: () => setAsking(null),
		}),
		[remember, forget, asking, run],
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
