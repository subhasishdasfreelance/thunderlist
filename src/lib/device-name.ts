/**
 * Names for the devices notifications are sent to, the way a person would
 * recognise them: "Chrome on Windows".
 */

/** Checked in order: Edge, Opera and Samsung Internet also say "Chrome". */
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
	[/Edg(A|iOS)?\//, "Edge"],
	[/OPR\//, "Opera"],
	[/SamsungBrowser\//, "Samsung Internet"],
	[/Firefox\/|FxiOS\//, "Firefox"],
	[/Chrome\/|CriOS\//, "Chrome"],
	[/Safari\//, "Safari"],
];

/** Checked in order: Android also says "Linux", and iOS "Mac OS X". */
const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
	[/iPhone/, "iPhone"],
	[/iPad/, "iPad"],
	[/Android/, "Android"],
	[/CrOS/, "ChromeOS"],
	[/Windows/, "Windows"],
	[/Macintosh/, "macOS"],
	[/Linux/, "Linux"],
];

function firstMatch(
	text: string,
	names: ReadonlyArray<[RegExp, string]>,
): string | null {
	return names.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/**
 * The browser and system a user agent names, or `null` when it names neither
 * recognisably.
 */
export function deviceName(userAgent: string): string | null {
	const browser = firstMatch(userAgent, BROWSERS);
	const system = firstMatch(userAgent, SYSTEMS);
	if (browser !== null && system !== null) return `${browser} on ${system}`;
	return browser ?? system;
}

/**
 * The browser behind a push endpoint, from the push service it belongs to;
 * for a device saved before its name was. Chrome's service is shared by most
 * browsers built on it.
 */
export function pushServiceName(endpoint: string): string {
	const host = URL.canParse(endpoint) ? new URL(endpoint).hostname : endpoint;
	if (host.endsWith("fcm.googleapis.com")) return "Chrome-based browser";
	if (host.endsWith("notify.windows.com")) return "Edge";
	if (host.endsWith("mozilla.com")) return "Firefox";
	if (host.endsWith("push.apple.com")) return "Safari";
	return host;
}
