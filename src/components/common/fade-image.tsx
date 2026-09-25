import { type ImgHTMLAttributes, useCallback, useState } from "react";

/**
 * An image fetched only once it is near the screen, which dissolves in once it
 * has arrived rather than painting in strips.
 *
 * The fade is quick and light — see `.thunderlist-fade-image` — so a cover
 * already in the cache is there before it is noticed. One that loaded before
 * the page was interactive, or failed to, is shown as it is at once.
 */
export function FadeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
	const [isLoaded, setIsLoaded] = useState(false);

	// Already there by the time React sees it — cached, or loaded before
	// hydration — and no load event will come.
	const whenMounted = useCallback((image: HTMLImageElement | null) => {
		if (image?.complete) setIsLoaded(true);
	}, []);

	return (
		// biome-ignore lint/a11y/useAltText: `alt` is the caller's, passed through with the rest.
		<img
			loading="lazy"
			decoding="async"
			{...props}
			ref={whenMounted}
			data-loaded={isLoaded}
			className={`thunderlist-fade-image ${props.className ?? ""}`}
			onLoad={(event) => {
				setIsLoaded(true);
				props.onLoad?.(event);
			}}
			onError={(event) => {
				setIsLoaded(true);
				props.onError?.(event);
			}}
		/>
	);
}
