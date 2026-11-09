"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { JollyTextField } from "@/components/ui/textfield";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import {
  type OnboardingError,
  REGISTER_TENANT_ERROR_MESSAGES,
} from "./errorMessages";

type State =
  | { status: "editing"; error: string | null }
  | { status: "submitting" }
  | { status: "done"; tenantUrl: string };

function tenantUrl(subdomain: string): string {
  const host = location.host.replace(/^www\./, "");
  return `${location.protocol}//${subdomain}.${host}/`;
}

export type PendingTenant = {
  name: string;
  subdomain: string;
  displayName: string;
};

export function CreateTenantForm({
  pending,
  error = null,
}: {
  pending?: PendingTenant;
  error?: OnboardingError | null;
}) {
  const t = useTranslations("Onboarding");
  const [name, setName] = useState(pending?.name ?? "");
  const [subdomain, setSubdomain] = useState(pending?.subdomain ?? "");
  const [ownerDisplayName, setOwnerDisplayName] = useState(
    pending?.displayName ?? "",
  );
  const [state, setState] = useState<State>({
    status: "editing",
    error: error && t(error),
  });

  if (state.status === "done") {
    return (
      <div className="flex flex-col items-start gap-4">
        <h2 className="text-xl font-semibold">{t("done")}</h2>
        <Link href={state.tenantUrl} variant="default">
          {t("openTenant")}
        </Link>
      </div>
    );
  }

  const submitting = state.status === "submitting";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "submitting" });
    try {
      const result = await orpc.tenant.register({
        name,
        subdomain,
        ownerDisplayName,
      });
      if (result.type === "authorize") {
        location.assign(result.next);
        return;
      }
      setState({ status: "done", tenantUrl: tenantUrl(result.subdomain) });
    } catch (err) {
      setState({
        status: "editing",
        error: t(errorMessageKey(err, REGISTER_TENANT_ERROR_MESSAGES)),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <JollyTextField
        label={t("name")}
        value={name}
        onChange={setName}
        isDisabled={submitting || !!pending}
      />
      <JollyTextField
        label={t("subdomain")}
        value={subdomain}
        onChange={setSubdomain}
        isDisabled={submitting}
      />
      <JollyTextField
        label={t("ownerDisplayName")}
        description={t("ownerDisplayNameDescription")}
        value={ownerDisplayName}
        onChange={setOwnerDisplayName}
        maxLength={64}
        isDisabled={submitting}
      />
      {state.status === "editing" && state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        className="self-start"
        isDisabled={
          submitting ||
          !name.trim() ||
          !subdomain.trim() ||
          !ownerDisplayName.trim()
        }
      >
        {t("submit")}
      </Button>
    </form>
  );
}
