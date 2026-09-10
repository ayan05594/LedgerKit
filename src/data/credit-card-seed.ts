import {
  CREDIT_CARD_CATALOG,
  CREDIT_CARD_STARTER_CATALOG,
  type CreditCardCatalogEntry,
} from "./credit-card-catalog";
import {
  CREDIT_CARD_CATALOG_EXTRA_A,
  type CreditCardCatalogExtension,
} from "./credit-card-catalog-extra-a";
import { CREDIT_CARD_CATALOG_EXTRA_B } from "./credit-card-catalog-extra-b";
import {
  firstResearchUrl,
  getCreditCardResearch,
  researchFeeNote,
  researchFeePaise,
  researchPerks,
  researchSourceNotes,
  researchSummary,
} from "./credit-card-research";

export const CREDIT_CARD_CATALOG_VERSION = "india-2026-09-10-v8";

/**
 * This stable legacy card has executable rules, but the engine does not model
 * every issuer/MID/posting nuance. It must always be presented as an estimate,
 * never as an exact statement outcome.
 */
export const PARTIAL_REWARD_CARD_IDS = new Set([
  "card-flipkart-axis",
  "card-hdfc-millennia-cc",
  "card-slice-rupay",
]);

export interface CreditCardInstrumentSeed {
  id: string;
  name: string;
  shortName: string;
  issuer: string;
  network: "visa" | "mastercard" | "rupay" | "amex" | "other";
  kind: "credit";
  colorFrom: string;
  colorTo: string;
  rewardUnit: string;
  unitValuePaise: number;
  rewardKind: "points" | "statement_cashback" | "wallet_balance";
  annualFeePaise: number;
  annualFeeKnown: boolean;
  joiningFeePaise: number;
  joiningFeeKnown: boolean;
  feeNote: string;
  perks: string;
  sourceNote: string;
  options: string;
  catalogCategory: string;
  catalogSummary: string;
  officialUrl: string;
  termsUrl: string;
  verifiedAt: string;
  availability:
    | "active"
    | "invite_only"
    | "secured"
    | "applications_paused"
    | "discontinued";
  rewardCoverage: "exact" | "partial" | "manual";
  isCatalogCard: true;
  archived: false;
  sortOrder: number;
}

const PARTIAL_REWARD_CONFIG: Record<
  string,
  {
    rewardUnit: string;
    unitValuePaise: number;
    rewardKind: CreditCardInstrumentSeed["rewardKind"];
    options?: Record<string, unknown>;
  }
> = {
  "card-flipkart-axis": {
    rewardUnit: "INR",
    unitValuePaise: 100,
    rewardKind: "statement_cashback",
    options: {
      floorRewardToWholeUnit: true,
      statementQuarterUsesDefaultStatementDay: true,
      merchantIdClassificationMayDiffer: true,
      excludedTollsNeedManualReview: true,
    },
  },
  "card-hdfc-millennia-cc": {
    rewardUnit: "CashPoints",
    unitValuePaise: 100,
    rewardKind: "points",
  },
  "card-slice-rupay": {
    rewardUnit: "monies",
    unitValuePaise: 1,
    rewardKind: "points",
    options: {
      rewardEstimate: "base-redemption-tier",
      higherRedemptionTiersRequireBalance: true,
      sparkOffersTrackedManually: true,
      statementDatesUserSpecific: true,
      agricultureMccNotAutomated: true,
      gamingMccNotAutomated: true,
    },
  },
};

const palette: Record<string, readonly [string, string]> = {
  "HDFC Bank": ["#0B4F9C", "#082A59"],
  "ICICI Bank": ["#F58220", "#8B2E0B"],
  "Axis Bank": ["#97144D", "#4E0828"],
  "SBI Card": ["#256EB5", "#123B72"],
  "Kotak Mahindra Bank": ["#ED1C24", "#79080C"],
  "IDFC FIRST Bank": ["#9E1B32", "#4D0916"],
  "IndusInd Bank": ["#9C4A18", "#4F2109"],
  "AU Small Finance Bank": ["#F59B23", "#8A4704"],
  "YES BANK": ["#1565A7", "#07365F"],
  "RBL Bank": ["#1A4B8C", "#0A2344"],
  "American Express India": ["#1687C7", "#053C68"],
  "HSBC India": ["#DB0011", "#6C0008"],
  "Standard Chartered India": ["#007A6B", "#003E36"],
  BOBCARD: ["#F15A22", "#8C2D05"],
  "Federal Bank": ["#6A2C91", "#301044"],
  "slice Small Finance Bank": ["#6C3EF5", "#2B1071"],
};

function shortName(value: string) {
  return value
    .replace(/\s+(Credit|Charge)\s+Card$/i, "")
    .replace(/\s+Card$/i, "")
    .slice(0, 40);
}

function network(value: readonly string[] | undefined) {
  if (!value?.length || value.length > 1) return "other" as const;
  const first = value[0]?.toLowerCase();
  if (first === "visa") return "visa" as const;
  if (first === "rupay") return "rupay" as const;
  if (first === "mastercard") return "mastercard" as const;
  if (first === "american express") return "amex" as const;
  return "other" as const;
}

function inferredNetwork(name: string) {
  if (/rupay/i.test(name)) return "rupay" as const;
  if (/mastercard/i.test(name)) return "mastercard" as const;
  if (/american express|amex/i.test(name)) return "amex" as const;
  if (/visa/i.test(name)) return "visa" as const;
  return "other" as const;
}

function rewardKind(value: string) {
  return /cashback|cash back/i.test(value)
    ? ("statement_cashback" as const)
    : ("points" as const);
}

function paise(value: number | null) {
  return value == null ? 0 : Math.round(value * 100);
}

export function catalogProductIdentity(issuer: string, name: string) {
  const words = (value: string) =>
    value
      .toLowerCase()
      .replace(/\+/g, " plus ")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/);
  const issuerWords = new Set([
    ...words(issuer),
    "bank",
    "credit",
    "card",
    "india",
  ]);
  return `${issuer.toLowerCase()}|${words(name)
    .filter((word) => !issuerWords.has(word))
    .join("-")}`;
}

/**
 * Convert the researched discovery catalogue into deterministic database rows.
 * Existing engine-backed cards keep their stable IDs, while discovery-only
 * cards receive a namespaced ID and deliberately have manual reward coverage.
 */
export function projectCreditCardCatalog(): CreditCardInstrumentSeed[] {
  return CREDIT_CARD_CATALOG.map((rawEntry, index) => {
    // The source uses `satisfies`, so TypeScript otherwise narrows it to a
    // union whose individual members omit optional properties.
    const item: CreditCardCatalogEntry = rawEntry;
    const projected = CREDIT_CARD_STARTER_CATALOG[index]!;
    const colors = palette[item.issuer] ?? ["#334155", "#0F172A"];
    const storageId =
      projected.aliases[0] ?? `card-catalog-${projected.id}`;
    const sourceUrls = item.additionalSourceUrls ?? [];
    const partialConfig = PARTIAL_REWARD_CONFIG[storageId];
    const research = getCreditCardResearch(item.issuer, item.name);
    const researchedAnnualFee = researchFeePaise(research?.annualFee ?? null);
    const researchedJoiningFee = researchFeePaise(research?.joiningFee ?? null);
    const officialUrl =
      firstResearchUrl(research?.officialSourceUrl ?? null) ?? item.sourceUrl;
    const termsUrl =
      firstResearchUrl(research?.rewardSourceUrl ?? null) ??
      sourceUrls[0] ??
      officialUrl;

    return {
      id: storageId,
      name: item.name,
      shortName: shortName(item.name),
      issuer: item.issuer,
      network: network(item.networks),
      kind: "credit",
      colorFrom: colors[0],
      colorTo: colors[1],
      rewardUnit: partialConfig?.rewardUnit ?? item.rewardCurrency,
      unitValuePaise: partialConfig?.unitValuePaise ?? 0,
      rewardKind: partialConfig?.rewardKind ?? rewardKind(item.rewardCurrency),
      annualFeePaise:
        researchedAnnualFee ?? paise(item.fees.annualInr),
      annualFeeKnown:
        researchedAnnualFee != null || item.fees.annualInr != null,
      joiningFeePaise:
        researchedJoiningFee ?? paise(item.fees.joiningInr),
      joiningFeeKnown:
        researchedJoiningFee != null || item.fees.joiningInr != null,
      feeNote:
        (research && researchFeeNote(research)) || item.fees.note || "",
      perks: JSON.stringify([
        ...item.highlights,
        ...(research ? researchPerks(research) : []),
      ]),
      sourceNote: JSON.stringify([
        ...(item.caveats ?? []),
        ...(research ? researchSourceNotes(research) : []),
      ]),
      options: JSON.stringify({
        catalogId: item.id,
        aliases: projected.aliases,
        sourceUrls,
        researchVersion: research ? "2026-09-09-second-pass" : null,
        catalogResearch: research,
        ...partialConfig?.options,
      }),
      catalogCategory: projected.catalogCategory,
      catalogSummary:
        (research && researchSummary(research)) || item.rewardSummary,
      officialUrl,
      termsUrl,
      verifiedAt: research?.rewardResearchDate ?? item.verifiedAt,
      availability: projected.availability,
      // Only explicitly maintained partial calculators are executable.
      // Catalogue metadata alone never proves a complete reward calculator.
      rewardCoverage: PARTIAL_REWARD_CARD_IDS.has(storageId)
        ? "partial"
        : "manual",
      isCatalogCard: true,
      archived: false,
      sortOrder: index,
    };
  });
}

function projectExtensionCatalog(): CreditCardInstrumentSeed[] {
  const detailedNames = new Set(
    CREDIT_CARD_CATALOG.map(
      (item) => catalogProductIdentity(item.issuer, item.name),
    ),
  );
  const extensions: readonly CreditCardCatalogExtension[] = [
    ...CREDIT_CARD_CATALOG_EXTRA_A,
    ...CREDIT_CARD_CATALOG_EXTRA_B,
  ];

  return extensions
    .filter((item, index, all) => {
      const nameKey = catalogProductIdentity(item.issuer, item.name);
      return (
        !detailedNames.has(nameKey) &&
        all.findIndex(
          (candidate) =>
            catalogProductIdentity(candidate.issuer, candidate.name) === nameKey,
        ) === index
      );
    })
    .map((item, index) => {
      const colors = palette[item.issuer] ?? ["#334155", "#0F172A"];
      const research = getCreditCardResearch(item.issuer, item.name);
      const researchedAnnualFee = researchFeePaise(research?.annualFee ?? null);
      const researchedJoiningFee = researchFeePaise(research?.joiningFee ?? null);
      const officialUrl =
        firstResearchUrl(research?.officialSourceUrl ?? null) ?? item.officialUrl;
      const termsUrl =
        firstResearchUrl(research?.rewardSourceUrl ?? null) ?? officialUrl;
      return {
        id: `card-catalog-${item.id}`,
        name: item.name,
        shortName: shortName(item.name),
        issuer: item.issuer,
        network: inferredNetwork(item.name),
        kind: "credit",
        colorFrom: colors[0],
        colorTo: colors[1],
        rewardUnit: "Rewards (manual)",
        unitValuePaise: 0,
        rewardKind: "points",
        annualFeePaise: researchedAnnualFee ?? 0,
        annualFeeKnown: researchedAnnualFee != null,
        joiningFeePaise: researchedJoiningFee ?? 0,
        joiningFeeKnown: researchedJoiningFee != null,
        feeNote:
          (research && researchFeeNote(research)) ||
          "Check the linked issuer page for the current fee on your exact variant.",
        perks: JSON.stringify(research ? researchPerks(research) : []),
        sourceNote: JSON.stringify([
          "Card name and availability verified from the issuer catalogue. Detailed reward automation is intentionally disabled.",
          ...(research ? researchSourceNotes(research) : []),
        ]),
        options: JSON.stringify({
          catalogExtension: true,
          researchVersion: research ? "2026-09-09-second-pass" : null,
          catalogResearch: research,
        }),
        catalogCategory: item.category,
        catalogSummary:
          (research && researchSummary(research)) ||
          "Official catalogue card. Open the issuer source for current benefits, caps, exclusions and fees.",
        officialUrl,
        termsUrl,
        verifiedAt: research?.rewardResearchDate ?? "2026-09-08",
        availability: item.availability,
        rewardCoverage: "manual",
        isCatalogCard: true,
        archived: false,
        sortOrder: 1_000 + index,
      };
    });
}

export const CREDIT_CARD_INSTRUMENT_SEEDS = [
  ...projectCreditCardCatalog(),
  ...projectExtensionCatalog(),
];
