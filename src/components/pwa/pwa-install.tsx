"use client";

import { useTranslations } from "next-intl";
import { type InstallGuide, PwaInstallView } from "./pwa-install-view";
import { usePwaInstall } from "./pwa-provider";

export function PwaInstall({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("PwaInstall");
  const { ready, installed, secure, platform, canPrompt, status, install } =
    usePwaInstall();
  if (!ready || installed) return null;

  const guides: InstallGuide[] = [
    {
      id: "ios",
      title: t("iosTitle"),
      steps: [t("iosSteps.first"), t("iosSteps.second"), t("iosSteps.third")],
    },
    {
      id: "android",
      title: t("androidTitle"),
      steps: [
        t("androidSteps.first"),
        t("androidSteps.second"),
        t("androidSteps.third"),
      ],
    },
    {
      id: "desktop",
      title: t("desktopTitle"),
      steps: [
        t("desktopSteps.first"),
        t("desktopSteps.second"),
        t("desktopSteps.third"),
      ],
    },
    {
      id: "mac",
      title: t("macTitle"),
      steps: [t("macSteps.first"), t("macSteps.second"), t("macSteps.third")],
    },
  ];

  return (
    <PwaInstallView
      compact={compact}
      secure={secure}
      platform={platform}
      canPrompt={canPrompt}
      status={status}
      onInstall={install}
      guides={guides}
      labels={{
        button: t("button"),
        title: t("title"),
        description: t("description"),
        nativeIntro: t("nativeIntro"),
        nativeInstall: t("nativeInstall"),
        otherIntro: t("otherIntro"),
        insecure: t("insecure"),
        close: t("close"),
        statuses: {
          installing: t("installing"),
          accepted: t("accepted"),
          dismissed: t("dismissed"),
          error: t("error"),
        },
      }}
    />
  );
}
