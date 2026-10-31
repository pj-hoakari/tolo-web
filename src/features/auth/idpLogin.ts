export const CHALLENGE_PARAM = "challenge";

export type ChallengeLogin = {
  endpoint: string;
  challenge: string;
  resumeUrl: string;
};

export function challengeLogin(
  issuer: string,
  authorizationEndpoint: string,
  challenge: string,
): ChallengeLogin {
  const resume = new URL(authorizationEndpoint);
  resume.searchParams.set(CHALLENGE_PARAM, challenge);
  return {
    endpoint: new URL("/api/login", issuer).href,
    challenge,
    resumeUrl: resume.href,
  };
}

export async function submitCredentials(
  { endpoint, challenge }: ChallengeLogin,
  username: string,
  password: string,
): Promise<"accepted" | "invalidCredentials" | "failed"> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, challenge }),
  }).catch(() => undefined);
  if (response?.ok) return "accepted";
  return response?.status === 401 ? "invalidCredentials" : "failed";
}
