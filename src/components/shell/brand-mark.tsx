import { Link } from "@tanstack/react-router";

/**
 * The Thunderlist wordmark, and the way home: pressing it opens Today.
 *
 * It is drawn as a logo rather than a button, with nothing around it. It sits
 * in a bar of real buttons, so anything that gave it a panel or an edge would
 * make it look like the most important control there.
 *
 * The bolt is `public/logo.svg`, so there is one file to change. Its colour is
 * its own — the mark is gold against the app's blue, which is the pairing the
 * rest of the palette was chosen around.
 */
export function BrandMark() {
	return (
		<Link
			to="/tags/$tagId"
			params={{ tagId: "today" }}
			search={{ task: undefined }}
			aria-label="Thunderlist — go to Today"
			className="thunderlist-brand no-underline"
		>
			<img src="/logo.svg" alt="" width={22} height={22} aria-hidden />
			<span className="thunderlist-brand-name">Thunderlist</span>
		</Link>
	);
}
