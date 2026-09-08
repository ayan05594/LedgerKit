import type { Instrument } from "@/db/schema";

/** Safe subset returned by the global discovery picker. */
export type CardCatalogItem = Pick<
  Instrument,
  | "id"
  | "name"
  | "shortName"
  | "issuer"
  | "network"
  | "kind"
  | "colorFrom"
  | "colorTo"
  | "annualFeePaise"
  | "joiningFeePaise"
  | "annualFeeKnown"
  | "joiningFeeKnown"
  | "feeNote"
  | "catalogCategory"
  | "catalogSummary"
  | "officialUrl"
  | "termsUrl"
  | "verifiedAt"
  | "availability"
  | "rewardCoverage"
  | "isCatalogCard"
  | "archived"
  | "sortOrder"
>;

/** Never add account linkage, last-four digits, limits or statement dates. */
export const CARD_CATALOG_SELECT = [
  "id",
  "name",
  "short_name",
  "issuer",
  "network",
  "kind",
  "color_from",
  "color_to",
  "annual_fee_paise",
  "joining_fee_paise",
  "annual_fee_known",
  "joining_fee_known",
  "fee_note",
  "catalog_category",
  "catalog_summary",
  "official_url",
  "terms_url",
  "verified_at",
  "availability",
  "reward_coverage",
  "is_catalog_card",
  "archived",
  "sort_order",
].join(",");
