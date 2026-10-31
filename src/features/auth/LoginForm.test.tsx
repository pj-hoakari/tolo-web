// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { challengeLogin } from "./idpLogin";
import { LoginForm } from "./LoginForm";

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

function idpLogin(answer: () => Response) {
  const received: unknown[] = [];
  server.use(
    http.post("https://idp.test/api/login", async ({ request }) => {
      received.push(await request.json());
      return answer();
    }),
  );
  return received;
}

function submitForm(username: string, password: string) {
  render(<LoginForm login={login} />, { wrapper: IntlTestProvider });
  fireEvent.change(screen.getByLabelText("ID"), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText("パスワード"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "ログイン" }));
}

it("sends the credentials and the challenge to the IdP and then resumes the authorization", async () => {
  const received = idpLogin(() => new HttpResponse(null, { status: 200 }));
  const sent = vi.spyOn(globalThis, "fetch");

  submitForm("staff-1", "pw-1");

  await waitFor(() =>
    expect(assign).toHaveBeenCalledWith(
      "https://idp.test/oauth2/authorize?challenge=challenge-1",
    ),
  );
  expect(received).toEqual([
    { username: "staff-1", password: "pw-1", challenge: "challenge-1" },
  ]);
  expect(sent).toHaveBeenCalledWith(
    "https://idp.test/api/login",
    expect.objectContaining({ credentials: "include" }),
  );
});

it("stays on the form and clears the password when the IdP rejects the credentials", async () => {
  idpLogin(() => new HttpResponse(null, { status: 401 }));

  submitForm("staff-1", "wrong-pw");

  expect((await screen.findByRole("alert")).textContent).toBe(
    "ID またはパスワードが違います。",
  );
  expect(screen.getByLabelText<HTMLInputElement>("ID").value).toBe("staff-1");
  expect(screen.getByLabelText<HTMLInputElement>("パスワード").value).toBe("");
  expect(assign).not.toHaveBeenCalled();
});

it.each([
  ["answers 400", () => new HttpResponse(null, { status: 400 })],
  ["answers 500", () => new HttpResponse(null, { status: 500 })],
  ["cannot be reached", () => HttpResponse.error()],
])("asks to start over when the IdP %s", async (_, answer) => {
  idpLogin(answer);

  submitForm("staff-1", "pw-1");

  expect((await screen.findByRole("alert")).textContent).toBe(
    "ログインできませんでした。もう一度試しても続くときは、利用していたテナントのページからやり直してください。",
  );
  expect(screen.getByLabelText<HTMLInputElement>("パスワード").value).toBe(
    "pw-1",
  );
  expect(assign).not.toHaveBeenCalled();
});
