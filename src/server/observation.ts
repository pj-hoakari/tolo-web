import "server-only";

const baseUrl = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";

function authorizationHeader(): Record<string, string> {
  const token = process.env.OBSERVATION_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function callObservation<T>(
  procedure: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${baseUrl}/tolo.observation.v1.${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authorizationHeader() },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `${procedure} failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}
