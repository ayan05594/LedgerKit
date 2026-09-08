import type { Instrument } from "@/db/schema";
import type { RewardOutcome } from "./engine";

export const MANUAL_REWARD_EXPLANATION =
  "Automatic reward calculation is unavailable for this card. Record only an issuer-confirmed reward manually.";

/**
 * Reward rules are executable only after the catalogue record explicitly says
 * its complete current terms have been verified. Merely having legacy rows in
 * reward_rules is not sufficient evidence.
 */
export function rewardAutomationEnabled(
  instrument: Pick<Instrument, "rewardCoverage">,
) {
  return instrument.rewardCoverage === "exact" || instrument.rewardCoverage === "partial";
}

export function manualRewardOutcome(): RewardOutcome {
  return {
    ruleId: null,
    ruleName: "Manual tracking",
    unitsMilli: 0,
    valuePaise: 0,
    cappedUnitsMilli: 0,
    explain: MANUAL_REWARD_EXPLANATION,
  };
}
