import rawResearch from "./credit-card-research.json";

export type CreditCardResearch = {
  issuer: string;
  status: "Selectable" | "Discontinued";
  name: string;
  baseReward: string | null;
  acceleratedRewards: string | null;
  rewardPointValue: string | null;
  caps: string | null;
  minimumTransaction: string | null;
  excludedCategories: string | null;
  excludedMerchants: string | null;
  joiningFee: string | null;
  annualFee: string | null;
  feeWaiverCondition: string | null;
  forexMarkup: string | null;
  loungeBenefits: string | null;
  milestoneBenefits: string | null;
  fuelSurchargeWaiver: string | null;
  otherBenefits: string | null;
  officialSourceUrl: string | null;
  effectiveDate: string | null;
  rewardSourceUrl: string | null;
  rewardSourceType: string | null;
  rewardResearchDate: string | null;
  rewardResearchNote: string | null;
};

export const CREDIT_CARD_RESEARCH_VERSION = rawResearch.version;
export const CREDIT_CARD_RESEARCH_SOURCE = {
  workbook: rawResearch.sourceWorkbook,
  sha256: rawResearch.sourceSha256,
  cardCount: rawResearch.cardCount,
} as const;

export const CREDIT_CARD_RESEARCH = rawResearch.cards as CreditCardResearch[];

const researchByIdentity = new Map(
  CREDIT_CARD_RESEARCH.map((card) => [identity(card.issuer, card.name), card]),
);

function identity(issuer: string, name: string) {
  return `${issuer}\u0000${name}`;
}

export function getCreditCardResearch(issuer: string, name: string) {
  return researchByIdentity.get(identity(issuer, name)) ?? null;
}

export function firstResearchUrl(value: string | null) {
  return value
    ?.split(/\r?\n/)
    .map((url) => url.trim())
    .find(Boolean) ?? null;
}

/**
 * Extract only an unambiguous, leading INR fee. Descriptions such as
 * "published renewal fee applies" deliberately remain unknown.
 */
export function researchFeePaise(value: string | null) {
  if (!value) return null;
  if (
    /\b(?:nil|lifetime[- ]free|no (?:joining|annual|membership|renewal) fee|zero)\b/i.test(
      value,
    )
  ) {
    return 0;
  }
  const match = value.trim().match(/^₹\s*([\d,]+(?:\.\d+)?)(?:\s|$)/);
  if (!match) return null;
  return Math.round(Number(match[1].replaceAll(",", "")) * 100);
}

/** Extract an explicit leading percentage; inherited/variable rates stay null. */
export function researchForexMarkupBps(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*%/);
  return match ? Math.round(Number(match[1]) * 100) : null;
}

export function researchSummary(card: CreditCardResearch) {
  const sections = [
    card.baseReward ? `Base: ${card.baseReward}` : null,
    card.acceleratedRewards
      ? `Accelerated: ${card.acceleratedRewards}`
      : null,
  ].filter((value): value is string => Boolean(value));
  return sections.join(" ");
}

export function researchPerks(card: CreditCardResearch) {
  return [
    card.loungeBenefits ? `Lounge: ${card.loungeBenefits}` : null,
    card.milestoneBenefits ? `Milestone: ${card.milestoneBenefits}` : null,
    card.fuelSurchargeWaiver
      ? `Fuel surcharge: ${card.fuelSurchargeWaiver}`
      : null,
    card.otherBenefits ? `Other: ${card.otherBenefits}` : null,
  ].filter((value): value is string => Boolean(value));
}

export function researchFeeNote(card: CreditCardResearch) {
  return [
    card.joiningFee ? `Joining fee: ${card.joiningFee}` : null,
    card.annualFee ? `Annual fee: ${card.annualFee}` : null,
    card.feeWaiverCondition
      ? `Fee waiver: ${card.feeWaiverCondition}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function researchSourceNotes(card: CreditCardResearch) {
  return [
    card.rewardSourceType && card.rewardResearchDate
      ? `Reward research: ${card.rewardSourceType}, checked ${card.rewardResearchDate}.`
      : null,
    card.effectiveDate ? `Terms status: ${card.effectiveDate}.` : null,
    card.rewardResearchNote,
  ].filter((value): value is string => Boolean(value));
}
