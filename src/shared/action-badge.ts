export interface ActionBadgeState {
  dotColor: string;
  title: string;
}

const COUNTING_BADGE_STATE: ActionBadgeState = {
  dotColor: "#1a7f37",
  title: "YouTube Time Tracker: counting now"
};

const MANUAL_PAUSED_BADGE_STATE: ActionBadgeState = {
  dotColor: "#d4a017",
  title: "YouTube Time Tracker: paused manually"
};

const INACTIVE_BADGE_STATE: ActionBadgeState = {
  dotColor: "#d4a017",
  title: "YouTube Time Tracker: not counting"
};

export function getActionBadgeState({
  isCounting,
  isManuallyPaused
}: {
  isCounting: boolean;
  isManuallyPaused: boolean;
}): ActionBadgeState {
  if (isCounting) {
    return COUNTING_BADGE_STATE;
  }

  return isManuallyPaused ? MANUAL_PAUSED_BADGE_STATE : INACTIVE_BADGE_STATE;
}
