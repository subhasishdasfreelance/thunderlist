import { Link } from "@tanstack/react-router";

/**
 * The Thunderlist wordmark, and the way home: pressing it opens Today.
 *
 * It is drawn as a mark rather than a button: the bolt and the name level on
 * the bar, with no panel behind them; see `.thunderlist-brand`.
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
