/**
 * Opening the app lands on Today, and Back from there goes to the Checklists.
 *
 * On a fresh open — the installed app launched, or a new tab — Today is the
 * only page in the history, so Back left the app. This puts the Checklists
 * underneath it: the entry is rewritten to `/checklists`, and Today pushed
 * back on top.
 *
 * It runs as an inline script in the page's head, before the router has
 * started. The router then finds the history already arranged and knows
 * nothing about the rearranging, so nothing is loaded twice.
 *
 * Only on a fresh open: `history.length` is 1 there and nothing has written a
 * state yet. A reload keeps the router's state, and arriving from another
 * site leaves more than one entry, so neither is touched.
 */
export const FIRST_OPEN_SCRIPT = `(function(){try{var h=window.history,l=window.location;if(l.pathname!=="/tags/today"||h.length!==1||h.state)return;var here=l.pathname+l.search+l.hash;h.replaceState(null,"","/checklists");h.pushState(null,"",here);}catch(e){}})();`;
