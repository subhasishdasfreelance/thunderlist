import { Link } from "@tanstack/react-router";
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
 */
export function RouterLink({ href, ...rest }: AnchorProps) {
	if (!href || EXTERNAL.test(href)) {
		return <a href={href} {...rest} />;
	}

	return <Link {...rest} to={href as never} />;
}
