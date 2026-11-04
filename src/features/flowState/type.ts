export type FlowObservation =
  | "unobserved"
  | "invalid"
  | "hold"
  | "stale"
  | "ok";

export type FlowHistory = "none" | "windowOnly" | "short" | "established";

export type FlowJudgement =
  | "surge"
  | "highStagnation"
  | "combined"
  | "puncture";

export interface FlowElementState {
  targetKey: string;
  observation: FlowObservation | null;
  history: FlowHistory | null;
  linePoints: number;
  skipped: FlowJudgement[];
}
