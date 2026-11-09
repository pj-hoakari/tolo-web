export const CHALLENGE_PARAM = "challenge";

export type ChallengeLogin = {
  endpoint: string;
  signupEndpoint: string;
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
    signupEndpoint: new URL("/api/signup", issuer).href,
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

export type SignupInputError = "invalidUsername" | "lengthOutOfRange";

export function signupInputError(
  username: string,
  password: string,
): SignupInputError | null {
  const length = [...username].length;
  if (length < 1 || length > 50 || /[\s\p{Cc}]/u.test(username)) {
    return "invalidUsername";
  }
  if (
    [...password].length < 8 ||
    new TextEncoder().encode(password).length > 72
  ) {
    return "lengthOutOfRange";
  }
  return null;
}

export async function submitSignup(
  { signupEndpoint, challenge }: ChallengeLogin,
  username: string,
  password: string,
): Promise<"accepted" | "usernameTaken" | "failed"> {
  const response = await fetch(signupEndpoint, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, challenge }),
  }).catch(() => undefined);
  if (response?.ok) return "accepted";
  return response?.status === 409 ? "usernameTaken" : "failed";
}
