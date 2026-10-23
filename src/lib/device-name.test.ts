import { describe, expect, it } from "bun:test";
import { deviceName, pushServiceName } from "./device-name";

describe("deviceName", () => {
	it.each([
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
			"Chrome on Windows",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
			"Edge on Windows",
		],
		[
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
			"Chrome on Android",
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
			"Safari on iPhone",
		],
		[
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
			"Firefox on macOS",
		],
		[
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/115.0.0.0",
			"Opera on Linux",
		],
	])("names %s", (userAgent, name) => {
		expect(deviceName(userAgent)).toBe(name);
	});

	it("is null for nothing recognisable", () => {
		expect(deviceName("curl/8.0")).toBeNull();
		expect(deviceName("")).toBeNull();
	});
});

describe("pushServiceName", () => {
	it("names the browser behind each push service", () => {
		expect(pushServiceName("https://fcm.googleapis.com/fcm/send/abc")).toBe(
			"Chrome-based browser",
		);
		expect(
			pushServiceName("https://wns2-bl2p.notify.windows.com/w/?token=abc"),
		).toBe("Edge");
		expect(
			pushServiceName("https://updates.push.services.mozilla.com/wpush/v2/abc"),
		).toBe("Firefox");
		expect(pushServiceName("https://web.push.apple.com/abc")).toBe("Safari");
	});

	it("falls back to the host", () => {
		expect(pushServiceName("https://push.example.com/abc")).toBe(
			"push.example.com",
		);
	});
});
