import { Link, useRouter } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";

type AnchorProps = ComponentPropsWithoutRef<"a">;

const EXTERNAL = /^(?:[a-z]+:|\/\/|#)/i;

/**
 * Adapter that lets every Astryx link navigate through TanStack Router.
 *
 * Astryx components hand their link element a plain `href` string, while the
 * router's `Link` wants a typed route. This is the single place the two meet,
 * so the cast lives here instead of at every call site. External and protocol
 * links fall through to a normal anchor.
 *
 * The router reads `to` as a path only, so a query on the href is handed over
 * as its `search` instead.
 */
export function RouterLink({ href, ...rest }: AnchorProps) {
	const router = useRouter();

	if (!href || EXTERNAL.test(href)) {
		return <a href={href} {...rest} />;
	}

	const [path, query] = href.split("?");
	return (
		<Link
			{...rest}
			to={path as never}
			search={
				query === undefined
					? undefined
					: (router.options.parseSearch(`?${query}`) as never)
			}
		/>
	);
}
