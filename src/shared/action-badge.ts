export interface ActionBadgeState {
  dotColor: string;
  title: string;
}

const COUNTING_BADGE_STATE: ActionBadgeState = {
  dotColor: "#1a7f37",
  title: "YouTube Time Tracker: counting now"
};

const PAUSED_BADGE_STATE: ActionBadgeState = {
  dotColor: "#d4a017",
  title: "YouTube Time Tracker: not counting"
};

export function getActionBadgeState(isCounting: boolean): ActionBadgeState {
  return isCounting ? COUNTING_BADGE_STATE : PAUSED_BADGE_STATE;
}
