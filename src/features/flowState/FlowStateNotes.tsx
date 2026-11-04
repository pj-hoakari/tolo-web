import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { FlowElementState, FlowHistory, FlowObservation } from "./type";

type FlowIssue =
  | "unobserved"
  | "invalid"
  | "hold"
  | "stale"
  | "noHistory"
  | "windowOnlyHistory"
  | "shortHistory"
  | "intermittentLine";

const OBSERVATION_ISSUES: Record<FlowObservation, FlowIssue | null> = {
  unobserved: "unobserved",
  invalid: "invalid",
  hold: "hold",
  stale: "stale",
  ok: null,
};

const HISTORY_ISSUES: Record<FlowHistory, FlowIssue | null> = {
  none: "noHistory",
  windowOnly: "windowOnlyHistory",
  short: "shortHistory",
  established: null,
};

const CONTINUOUS_LINE_POINTS = 2;

function flowIssuesOf(state: FlowElementState): FlowIssue[] {
  return [
    state.observation && OBSERVATION_ISSUES[state.observation],
    state.history && HISTORY_ISSUES[state.history],
    state.linePoints < CONTINUOUS_LINE_POINTS ? "intermittentLine" : null,
  ].filter((issue): issue is FlowIssue => issue !== null);
}

export function FlowStateNotes({
  state,
  className,
}: {
  state: FlowElementState | undefined;
  className?: string;
}) {
  const t = useTranslations("FlowState");
  const locale = useLocale();
  if (!state) return null;
  const issues = flowIssuesOf(state);
  return (
    <span
      className={cn(
        "mt-0.5 block space-y-0.5 text-[9px] text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      {issues.map((issue) => (
        <span key={issue} className="block">
          <span className="block font-medium">
            {t(`issue.${issue}.label`, { count: state.linePoints })}
          </span>
          <span className="block text-muted-foreground">
            {t(`issue.${issue}.action`)}
          </span>
        </span>
      ))}
      {state.skipped.length > 0 ? (
        <span className="block">
          {t("skipped", {
            judgements: new Intl.ListFormat(locale, {
              type: "conjunction",
            }).format(state.skipped.map((j) => t(`judgement.${j}`))),
          })}
        </span>
      ) : null}
    </span>
  );
}
