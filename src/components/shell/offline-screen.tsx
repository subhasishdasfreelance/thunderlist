import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { WifiOff } from "lucide-react";

/**
 * What the app shows in place of every screen while there is no connection.
 *
 * The page `public/offline.html` is, drawn by the app itself, and laid out like
 * the login page. A screen left open when the connection drops would otherwise
 * take a tick or an edit and then fail to save it; here nothing can be changed,
 * and it goes away on its own once the connection is back; see `useIsOnline`.
 */
export function OfflineScreen() {
	return (
		<Center>
			<VStack gap={4} hAlign="center" paddingBlock={10} maxWidth="22rem">
				{/* The bolt from `public/logo.svg`, drawn inline as in
				    `public/offline.html`: offline, the file may not be there to fetch. */}
				<svg
					width={56}
					height={56}
					viewBox="0 0 280.027 280.027"
					aria-hidden="true"
				>
					<path
						fill="#EFC75E"
						d="M249.399,96.583h-83.404L216.382,0H88.419L30.628,166.161h79.712L71.906,280.027L249.399,96.583z"
					/>
					<path
						fill="#F5DD9D"
						d="M101.046,17.598h78.364l-70.584,17.537l-43.168,78.758C65.658,113.892,101.046,17.598,101.046,17.598z"
					/>
				</svg>

				<Heading level={1}>Thunderlist</Heading>

				<Card padding={5}>
					<VStack gap={3} hAlign="center">
						<Icon icon={WifiOff} color="secondary" />
						<VStack gap={1} hAlign="center">
							<Heading level={2}>You’re offline</Heading>
							<div className="text-center">
								<Text color="secondary">
									Check your Wi-Fi or mobile data. Thunderlist comes back on its
									own once you’re online.
								</Text>
							</div>
						</VStack>
					</VStack>
				</Card>
			</VStack>
		</Center>
	);
}
