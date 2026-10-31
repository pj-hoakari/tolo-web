"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { JollyTextField } from "@/components/ui/textfield";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { REGISTER_TENANT_ERROR_MESSAGES } from "./errorMessages";

type State =
  | { status: "editing"; error: string | null }
  | { status: "submitting" }
  | { status: "done"; tenantUrl: string };

function tenantUrl(subdomain: string): string {
  const host = location.host.replace(/^www\./, "");
  return `${location.protocol}//${subdomain}.${host}/`;
}

export function CreateTenantForm() {
  const t = useTranslations("Onboarding");
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerDisplayName, setOwnerDisplayName] = useState("");
  const [state, setState] = useState<State>({ status: "editing", error: null });

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
      const tenant = await orpc.tenant.register({
        name,
        subdomain,
        ownerEmail,
        ownerDisplayName,
      });
      setState({ status: "done", tenantUrl: tenantUrl(tenant.subdomain) });
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
        isDisabled={submitting}
      />
      <JollyTextField
        label={t("subdomain")}
        value={subdomain}
        onChange={setSubdomain}
        isDisabled={submitting}
      />
      <JollyTextField
        label={t("ownerEmail")}
        type="email"
        value={ownerEmail}
        onChange={setOwnerEmail}
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
          !ownerEmail.trim() ||
          !ownerDisplayName.trim()
        }
      >
        {t("submit")}
      </Button>
    </form>
  );
}
