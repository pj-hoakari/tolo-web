// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { challengeLogin, signupInputError } from "./idpLogin";
import { SignupOrLogin } from "./SignupOrLogin";

const login = challengeLogin(
  "https://idp.test",
  "https://idp.test/oauth2/authorize",
  "challenge-1",
);

const assign = vi.fn();

beforeEach(() => {
  vi.stubGlobal("location", { assign });
});

afterEach(() => {
  cleanup();
  assign.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function idp(path: "signup" | "login", answer: () => Response) {
  const received: unknown[] = [];
  server.use(
    http.post(`https://idp.test/api/${path}`, async ({ request }) => {
      received.push(await request.json());
      return answer();
    }),
  );
  return received;
}

function fill(username: string, password: string) {
  fireEvent.change(screen.getByLabelText("ID"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText("パスワード"), {
    target: { value: password },
  });
}

function signUp(username: string, password: string) {
  render(<SignupOrLogin login={login} />, { wrapper: IntlTestProvider });
  fill(username, password);
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));
}

describe("signupInputError", () => {
  it.each([
    ["a 1-character ID", "a", null],
    ["a 50-character ID", "a".repeat(50), null],
    ["an empty ID", "", "invalidUsername"],
    ["a 51-character ID", "a".repeat(51), "invalidUsername"],
    ["an ID with a space", "owner 1", "invalidUsername"],
    ["an ID with a full-width space", "owner　1", "invalidUsername"],
    ["an ID with a control character", "owner\u00071", "invalidUsername"],
  ])("judges %s", (_, username, expected) => {
    expect(signupInputError(username, "password")).toBe(expected);
  });

  it.each([
    ["8 characters", "a".repeat(8), null],
    ["72 bytes", "a".repeat(72), null],
    ["7 characters", "a".repeat(7), "lengthOutOfRange"],
    ["73 bytes", "a".repeat(73), "lengthOutOfRange"],
    ["25 three-byte characters", "あ".repeat(25), "lengthOutOfRange"],
  ])("judges a password of %s", (_, password, expected) => {
    expect(signupInputError("owner-1", password)).toBe(expected);
  });
});

it("signs up in the tenant of the challenge and then resumes the authorization", async () => {
  const received = idp("signup", () => new HttpResponse(null, { status: 201 }));
  const sent = vi.spyOn(globalThis, "fetch");

  signUp("owner-1", "pw-1".repeat(2));

  await waitFor(() =>
    expect(assign).toHaveBeenCalledWith(
      "https://idp.test/oauth2/authorize?challenge=challenge-1",
    ),
  );
  expect(received).toEqual([
    {
      username: "owner-1",
      password: "pw-1".repeat(2),
      challenge: "challenge-1",
    },
  ]);
  expect(sent).toHaveBeenCalledWith(
    "https://idp.test/api/signup",
    expect.objectContaining({ credentials: "include" }),
  );
});

it("shows the rules without asking the IdP when the input breaks them", async () => {
  const received = idp("signup", () => new HttpResponse(null, { status: 201 }));

  signUp("owner 1", "pw-1".repeat(2));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "ID は空白を含まない 50 文字以内にしてください。",
  );
  fill("owner-1", "short");
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作成" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "パスワードは 8 文字以上、72 バイト以内にしてください。",
  );
  expect(received).toEqual([]);
});

it("asks for another ID when the IdP already has it in this tenant", async () => {
  idp("signup", () => new HttpResponse(null, { status: 409 }));

  signUp("owner-1", "pw-1".repeat(2));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "この ID は既に使われています。別の ID を指定してください。",
  );
  expect(assign).not.toHaveBeenCalled();
});

it.each([
  ["answers 400", () => new HttpResponse(null, { status: 400 })],
  ["cannot be reached", () => HttpResponse.error()],
])("asks to start over when the IdP %s", async (_, answer) => {
  idp("signup", answer);

  signUp("owner-1", "pw-1".repeat(2));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "アカウントを作成できませんでした。もう一度試しても続くときは、最初からやり直してください。",
  );
  expect(assign).not.toHaveBeenCalled();
});

it("switches to logging in with an existing account of the tenant, and back", async () => {
  const received = idp("login", () => new HttpResponse(null, { status: 200 }));
  render(<SignupOrLogin login={login} />, { wrapper: IntlTestProvider });

  fireEvent.click(
    screen.getByRole("button", { name: "作成済みのアカウントでログインする" }),
  );
  fill("staff-1", "pw-1");
  fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

  await waitFor(() =>
    expect(assign).toHaveBeenCalledWith(
      "https://idp.test/oauth2/authorize?challenge=challenge-1",
    ),
  );
  expect(received).toEqual([
    { username: "staff-1", password: "pw-1", challenge: "challenge-1" },
  ]);
  fireEvent.click(
    screen.getByRole("button", { name: "新しいアカウントを作成する" }),
  );
  expect(
    screen.getByRole("button", { name: "アカウントを作成" }),
  ).toBeDefined();
});
