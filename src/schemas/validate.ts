import * as v from "valibot";

/**
 * Adapt a Valibot schema into a TanStack Start server-function validator.
 *
 * Typing the parameter as the schema's *input* is what keeps call sites checked:
 * the server function infers its `data` type from here, so a bad payload is a
 * compile error as well as a runtime one.
 *
 * Validation failures are re-thrown with the schema's own message. Every schema
 * in this folder carries messages written for people, so the browser gets
 * "Title is required" rather than a serialised issue tree.
 */
export function validator<TSchema extends v.GenericSchema>(schema: TSchema) {
	return (input: v.InferInput<TSchema>): v.InferOutput<TSchema> => {
		const result = v.safeParse(schema, input);
		if (result.success) return result.output;

		throw new Error(result.issues[0]?.message ?? "That input is not valid.");
	};
}
