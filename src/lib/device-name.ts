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

export type DeviceType = "mobile" | "tablet" | "desktop";

/** Checked in order: an Android tablet is Android without "Mobile". */
const TYPES: ReadonlyArray<[RegExp, DeviceType]> = [
	[/iPad|Tablet/, "tablet"],
	[/iPhone|iPod|Mobile/, "mobile"],
	[/Android/, "tablet"],
	[/CrOS|Windows|Macintosh|Linux|X11/, "desktop"],
];

/**
 * Whether a user agent is a phone, a tablet or a computer, or `null` when it
 * does not say. An iPad asking for desktop sites, as it does by default, says
 * it is a Mac, so it counts as one.
 */
export function deviceType(userAgent: string): DeviceType | null {
	return TYPES.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
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
