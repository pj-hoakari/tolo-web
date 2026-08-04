import { useTranslations } from "next-intl";
import { memo, useState } from "react";
import { FileTrigger } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
} from "@/components/ui/disclosure";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import {
  type CrowdVideoSourceFactory,
  createCameraVideoSource,
  createVideoFileSource,
} from "../utils/videoSource";

type SourceMode = "camera" | "file";

export type DevVideoSourcePanelProps = {
  status: DetectCrowdStatus;
  onSourceChange: (factory: CrowdVideoSourceFactory) => void;
};

function DevVideoSourcePanelComponent({
  status,
  onSourceChange,
}: DevVideoSourcePanelProps) {
  const [mode, setMode] = useState<SourceMode>("camera");
  const [file, setFile] = useState<File | null>(null);
  const [loop, setLoop] = useState(true);
  const [hidden, setHidden] = useState(false);
  const t = useTranslations("Observation.devSource");

  if (hidden) {
    return null;
  }

  const isActive = status === "loading" || status === "detecting";

  const useCamera = () => {
    setMode("camera");
    setFile(null);
    onSourceChange(createCameraVideoSource);
  };

  const handleFileSelect = (files: FileList | null) => {
    const selected = files?.[0] ?? null;
    if (!selected) {
      return;
    }
    setMode("file");
    setFile(selected);
    onSourceChange(() => createVideoFileSource(selected, { loop }));
  };

  const handleLoopChange = (next: boolean) => {
    setLoop(next);
    if (mode === "file" && file) {
      onSourceChange(() => createVideoFileSource(file, { loop: next }));
    }
  };

  return (
    <section className="fixed right-4 bottom-4 z-50 flex w-72 flex-col gap-2 rounded border border-gray-300 border-dashed p-3 text-sm">
      <Disclosure defaultExpanded className="min-w-0">
        <DisclosureHeader className="py-0 font-bold text-xs">
          {t("title")}
        </DisclosureHeader>

        <DisclosurePanel className="flex flex-col gap-2 pt-2 pb-0">
          <FileTrigger
            acceptedFileTypes={["video/*"]}
            onSelect={handleFileSelect}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              isDisabled={isActive}
              className="self-start"
            >
              {t("selectFile")}
            </Button>
          </FileTrigger>

          <Checkbox
            isSelected={loop}
            isDisabled={isActive}
            onChange={handleLoopChange}
          >
            {t("loop")}
          </Checkbox>

          <div>
            <Button
              type="button"
              variant="link"
              size="sm"
              onPress={useCamera}
              isDisabled={isActive || mode === "camera"}
              className="h-auto p-0"
            >
              {t("backToCamera")}
            </Button>
          </div>

          <p className="break-all text-xs">
            {t("current", {
              source: mode === "file" && file ? file.name : t("camera"),
            })}
            {isActive ? t("activeHint") : t("inactiveHint")}
          </p>

          <Button
            type="button"
            variant="link"
            size="sm"
            onPress={() => setHidden(true)}
            className="h-auto self-start p-0 text-xs"
          >
            {t("hide")}
          </Button>
        </DisclosurePanel>
      </Disclosure>
    </section>
  );
}

export const DevVideoSourcePanel = memo(DevVideoSourcePanelComponent);
