import * as v from "valibot";

/** A push subscription, as the browser hands it over. */
export const pushSubscriptionInputSchema = v.object({
	endpoint: v.pipe(v.string(), v.url(), v.maxLength(2048)),
	keys: v.object({
		p256dh: v.pipe(v.string(), v.maxLength(256)),
		auth: v.pipe(v.string(), v.maxLength(256)),
	}),
});

export const pushEndpointInputSchema = v.object({
	endpoint: v.pipe(v.string(), v.url(), v.maxLength(2048)),
});
