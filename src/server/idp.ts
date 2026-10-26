import "server-only";

export async function issueRegistrationToken(sub: string): Promise<string> {
  const res = await fetch(
    `${process.env.FAKEIDP_URL ?? "http://127.0.0.1:8082"}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token_use: "registration",
        sub,
        client_id: "console-ui",
        scope: "tenant.claim",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`fake IdP returned ${res.status} for a registration token`);
  }
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}
