/**
 * The Thunderlist wordmark.
 *
 * A logo, not a control: the bolt and the name, with nothing drawn around them.
 * It sits in a bar of real buttons, so anything that gave it a panel or an edge
 * would make the one unpressable thing there look the most pressable.
 *
 * The bolt is `public/logo.svg`, so there is one file to change. Its colour is
 * its own — the mark is gold against the app's blue, which is the pairing the
 * rest of the palette was chosen around.
 */
export function BrandMark() {
	return (
		<span className="thunderlist-brand">
			<img src="/logo.svg" alt="" width={20} height={20} aria-hidden />
			<span className="thunderlist-brand-name">Thunderlist</span>
		</span>
	);
}
