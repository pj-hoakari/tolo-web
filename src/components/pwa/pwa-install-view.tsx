"use client";

import { Download } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Disclosure,
  DisclosureGroup,
  DisclosureHeader,
  DisclosurePanel,
} from "@/components/ui/disclosure";
import {
  Popover,
  PopoverDialog,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { InstallStatus } from "./pwa-provider";
import type { InstallPlatform } from "./pwa-utils";

export type InstallGuide = {
  id: Exclude<InstallPlatform, "other">;
  title: string;
  steps: [string, string, string];
};

export type PwaInstallViewProps = {
  compact?: boolean;
  platform: InstallPlatform;
  canPrompt: boolean;
  secure: boolean;
  status: InstallStatus;
  onInstall: () => Promise<void>;
  guides: InstallGuide[];
  labels: {
    button: string;
    title: string;
    description: string;
    nativeIntro: string;
    nativeInstall: string;
    otherIntro: string;
    insecure: string;
    close: string;
    statuses: Record<Exclude<InstallStatus, "idle">, string>;
  };
};

export function PwaInstallView({
  compact = false,
  platform,
  canPrompt,
  secure,
  status,
  onInstall,
  guides,
  labels,
}: PwaInstallViewProps) {
  const titleId = useId();

  return (
    <PopoverTrigger>
      <Button
        variant="outline"
        size={compact ? "icon" : "sm"}
        aria-label={labels.button}
      >
        <Download className="size-4 shrink-0" aria-hidden />
        <span className={compact ? "sr-only" : "ml-2"}>{labels.button}</span>
      </Button>
      <Popover
        placement="bottom end"
        className="w-[min(26rem,calc(100vw-2rem))]"
      >
        <PopoverDialog
          aria-labelledby={titleId}
          className="max-h-[min(36rem,80dvh)] overflow-y-auto p-5 outline-0"
        >
          {({ close }) => (
            <div className="space-y-4">
              <h2 id={titleId} className="text-lg font-semibold">
                {labels.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {labels.description}
              </p>
              {!secure ? (
                <p role="status" className="text-sm">
                  {labels.insecure}
                </p>
              ) : (
                <>
                  {status !== "idle" && (
                    <p role="status" className="text-sm">
                      {labels.statuses[status]}
                    </p>
                  )}
                  {canPrompt && (
                    <div className="space-y-3">
                      <p className="text-sm">{labels.nativeIntro}</p>
                      <Button onPress={() => void onInstall()}>
                        {labels.nativeInstall}
                      </Button>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {labels.otherIntro}
                  </p>
                  <DisclosureGroup
                    defaultExpandedKeys={
                      platform === "other" || canPrompt ? [] : [platform]
                    }
                  >
                    {guides.map((guide) => (
                      <Disclosure
                        key={guide.id}
                        id={guide.id}
                        className="min-w-0"
                      >
                        <DisclosureHeader>{guide.title}</DisclosureHeader>
                        <DisclosurePanel>
                          <ol className="list-decimal space-y-3 pl-5">
                            {guide.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        </DisclosurePanel>
                      </Disclosure>
                    ))}
                  </DisclosureGroup>
                </>
              )}
              <div className="flex justify-end">
                <Button variant="secondary" onPress={close}>
                  {labels.close}
                </Button>
              </div>
            </div>
          )}
        </PopoverDialog>
      </Popover>
    </PopoverTrigger>
  );
}
