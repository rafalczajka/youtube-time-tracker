import type { RuntimeState } from "./types";

const NO_ACTIVE_TAB_REASON = "No active YouTube tab";

interface ActionBadgeState {
  isCounting: boolean;
  label: string;
  dotColor: string;
  title: string;
}

function getInactiveReason({
  activeSession,
  idleState,
  isManuallyPaused
}: Pick<RuntimeState, "activeSession" | "idleState" | "isManuallyPaused">): string | undefined {
  if (isManuallyPaused) {
    return "Paused manually";
  }
  if (idleState === "locked") {
    return "Screen locked";
  }
  if (idleState === "idle") {
    return "Idle";
  }
  return activeSession ? undefined : NO_ACTIVE_TAB_REASON;
}

export function getActionBadgeState(
  state: Pick<RuntimeState, "activeSession" | "idleState" | "isManuallyPaused">
): ActionBadgeState {
  const reason = getInactiveReason(state);
  const isCounting = reason === undefined;
  const label = reason === NO_ACTIVE_TAB_REASON ? "No YouTube tab" : (reason ?? "Counting");

  return {
    isCounting,
    label,
    dotColor: isCounting ? "#1a7f37" : "#d4a017",
    title: `YouTube Time Tracker: ${reason ?? "counting now"}`
  };
}
