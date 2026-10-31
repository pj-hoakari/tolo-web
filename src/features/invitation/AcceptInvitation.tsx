"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { type ErrorMessageKeys, errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";

type AcceptError = "unusable" | "cannotJoin" | "notFound" | "failed";

const ACCEPT_ERROR_MESSAGES = {
  byCode: {
    UNAUTHORIZED: "unusable",
    PRECONDITION_FAILED: "cannotJoin",
    NOT_FOUND: "notFound",
  },
  fallback: "failed",
} as const satisfies ErrorMessageKeys<AcceptError>;

type State =
  | { status: "ready" }
  | { status: "accepting" }
  | { status: "failed"; error: AcceptError };

export function AcceptInvitation({ host }: { host: string }) {
  const t = useTranslations("Invitation");
  const [state, setState] = useState<State>({ status: "ready" });

  async function accept() {
    setState({ status: "accepting" });
    try {
      const { next } = await orpc.tenant.acceptInvitation();
      location.assign(next);
    } catch (err) {
      setState({
        status: "failed",
        error: errorMessageKey(err, ACCEPT_ERROR_MESSAGES),
      });
    }
  }

  const error = state.status === "failed" ? state.error : null;

  return (
    <>
      <p>{t("description", { host })}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
      {error === "cannotJoin" && (
        <Link href="/management" variant="default">
          {t("openManagement")}
        </Link>
      )}
      {(!error || error === "failed") && (
        <Button onPress={accept} isDisabled={state.status === "accepting"}>
          {t("accept")}
        </Button>
      )}
    </>
  );
}
