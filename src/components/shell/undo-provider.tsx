import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useToast } from "@astryxdesign/core/Toast";
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
import { invertChange, UndoContext, type UndoStep, useUndo } from "#/lib/undo";
import type { Change } from "#/schemas/change";

/** How far back Ctrl+Z goes. Further than anyone reaches, short of a log. */
const DEPTH = 20;

/**
 * Ctrl+Z, from anywhere in the app.
 *
 * Every change made while reading a list hands in its undo as it goes out; see
 * `invertChange`. They stack up here, and Ctrl+Z takes the top one off and
 * applies it. Undoing something that deletes a task or writes one back asks
 * first, as pressing the same thing on screen would; that question is drawn by
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
	const steps = useRef<Array<UndoStep>>([]);
	const [asking, setAsking] = useState<UndoStep | null>(null);

	const remember = useCallback(
		(change: Change) => {
			const step = invertChange(client, change);
			if (step === null) return;

			steps.current = [...steps.current, step].slice(-DEPTH);
		},
		[client],
	);

	/*
	 * One at a time, and only then said to be done.
	 *
	 * Putting a deleted task back is two changes — the task, then the rest of
	 * what it carried — and the second names a task the first has to have
	 * written already. Sent together they can arrive in either order, and the
	 * edit would be refused for naming a task that does not exist yet.
	 *
	 * A failure has already been reported by `useApplyChange`, so nothing is
	 * said here beyond not claiming it worked.
	 */
	const run = useCallback(
		(step: UndoStep) => {
			void (async () => {
				for (const change of step.changes) {
					try {
						await applyAsync(change);
					} catch {
						return;
					}
				}

				toast({
					body: `Undone: ${step.label.toLowerCase()}.`,
					type: "info",
					uniqueID: "undo",
				});
			})();
		},
		[applyAsync, toast],
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

			const step = steps.current[steps.current.length - 1];
			if (step === undefined) {
				toast({ body: "Nothing to undo.", type: "info", uniqueID: "undo" });
				return;
			}

			steps.current = steps.current.slice(0, -1);
			if (step.question === null) run(step);
			else setAsking(step);
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [run, toast]);

	const value = useMemo(
		() => ({
			remember,
			asking,
			confirm: () => {
				if (asking !== null) run(asking);
				setAsking(null);
			},
			dismiss: () => setAsking(null),
		}),
		[remember, asking, run],
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
