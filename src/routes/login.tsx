import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { createFileRoute } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

/**
 * The way in, and the only page there is without an account.
 *
 * Anyone already signed in is redirected away from here before it renders; see
 * the root route's `beforeLoad`. There is no form: Google is the only
 * credential, so there is no password to store, no reset to abuse and no
 * sign-up to tell apart from a sign-in.
 */
function LoginPage() {
	const [isStarting, setIsStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function signIn() {
		setIsStarting(true);
		setError(null);

		try {
			await authClient.signIn.social({
				provider: "google",
				callbackURL: "/today",
			});
		} catch {
			// The redirect never happened, so this page is still here to say so.
			setIsStarting(false);
			setError("Could not reach Google just then. Try again.");
		}
	}

	return (
		<Center>
			<VStack gap={4} hAlign="center" paddingBlock={10} maxWidth="22rem">
				<img src="/logo.svg" alt="" width={56} height={56} aria-hidden />

				<VStack gap={1} hAlign="center">
					<Heading level={1}>Thunderlist</Heading>
					<Text color="secondary">Your day, your lists, your pace.</Text>
				</VStack>

				<Card padding={5}>
					<VStack gap={3} hAlign="center">
						<Button
							label={
								isStarting ? "Taking you to Google…" : "Continue with Google"
							}
							variant="primary"
							icon={<LogIn aria-hidden />}
							isDisabled={isStarting}
							onClick={() => {
								void signIn();
							}}
						/>
						<Text type="supporting">
							Thunderlist only ever sees your name, email and picture.
						</Text>
						{error === null ? null : <Text type="supporting">{error}</Text>}
					</VStack>
				</Card>
			</VStack>
		</Center>
	);
}
