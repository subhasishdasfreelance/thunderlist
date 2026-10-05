import { createFileRoute } from "@tanstack/react-router";
import { createRouteHandler } from "uploadthing/server";
import { imageRouter } from "#/data/images.server";

/**
 * Where the browser asks UploadThing to take a picture, and where UploadThing
 * calls back once it has; see `imageRouter`. The token is read from
 * `UPLOADTHING_TOKEN`.
 */
const handler = createRouteHandler({ router: imageRouter });

export const Route = createFileRoute("/api/uploadthing")({
	server: {
		handlers: {
			GET: ({ request }) => handler(request),
			POST: ({ request }) => handler(request),
		},
	},
});
