import "server-only";
import { nanoid } from "nanoid";
import type { Instrument, UserOnboarding } from "@/db/schema";
import {
  CARD_CATALOG_SELECT,
  type CardCatalogItem,
} from "@/lib/card-catalog";
import { ApiError } from "@/lib/api";
import { withCardOnboardingMetadata } from "@/lib/card-onboarding";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromSupabaseRows, toSupabaseRow } from "@/lib/supabase/rows";

export interface CardSelectionSnapshot {
  catalog: CardCatalogItem[];
  selectedIds: string[];
  completed: boolean;
  skippedCards: boolean;
}

const stamp = () => new Date().toISOString();
const SELECTABLE_AVAILABILITY = [
  "active",
  "invite_only",
  "secured",
  "applications_paused",
] as const;

function catalogIdentity(card: Pick<CardCatalogItem, "issuer" | "name">) {
  const normalise = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/\+/g, " plus ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/);
  const issuerWords = new Set([
    ...normalise(card.issuer),
    "bank",
    "credit",
    "card",
    "india",
  ]);
  const product = normalise(card.name)
    .filter((word) => !issuerWords.has(word))
    .join(" ");
  return `${card.issuer.toLowerCase()}|${product}`;
}

/** The catalogue is global; ownership is represented only by this ID mapping. */
export async function getSelectedCardIds(userId: string): Promise<string[]> {
  const result = await createSupabaseAdminClient()
    .from("user_card_selections")
    .select("instrument_id")
    .eq("user_id", userId);
  if (result.error) throw result.error;
  return fromSupabaseRows<{ instrumentId: string }>(result.data).map(
    (row) => row.instrumentId,
  );
}

export async function listInstrumentsForSelection(
  userId: string,
  instrumentIds: string[],
): Promise<Instrument[]> {
  const uniqueIds = [...new Set(instrumentIds)];
  if (!uniqueIds.length) return [];
  const result = await createSupabaseAdminClient()
    .from("instruments")
    .select("*")
    .in("id", uniqueIds)
    .or(`is_catalog_card.eq.true,owner_user_id.eq.${userId}`)
    .order("sort_order")
    .order("name");
  if (result.error) throw result.error;
  return fromSupabaseRows<Instrument>(result.data);
}

/** Selected cards for dashboard/card-list reads. Historical hydration queries
 * deliberately load the global catalogue separately. */
export async function listSelectedInstruments(
  userId: string,
): Promise<Instrument[]> {
  const [selectedIds, onboarding] = await Promise.all([
    getSelectedCardIds(userId),
    getCardOnboardingStatus(userId),
  ]);
  // Rows copied from historical expenses during the migration are suggestions,
  // not a confirmed wallet. Never expose them in normal card pickers until the
  // user has explicitly saved the onboarding step.
  if (!onboarding.completed || !selectedIds.length) return [];
  return listInstrumentsForSelection(userId, selectedIds);
}

export async function getCardOnboardingStatus(userId: string): Promise<{
  completed: boolean;
  skippedCards: boolean;
}> {
  const result = await createSupabaseAdminClient()
    .from("user_onboarding")
    .select("cards_completed_at, skipped_cards")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  const [row] = fromSupabaseRows<
    Pick<UserOnboarding, "cardsCompletedAt" | "skippedCards">
  >(result.data ? [result.data] : []);
  return {
    completed: Boolean(row?.cardsCompletedAt),
    skippedCards: row?.skippedCards ?? false,
  };
}

export async function getCardSelection(
  userId: string,
): Promise<CardSelectionSnapshot> {
  const admin = createSupabaseAdminClient();
  const [catalogResult, customResult, selectionResult, onboardingResult] = await Promise.all([
    admin
      .from("instruments")
      .select(CARD_CATALOG_SELECT)
      .eq("kind", "credit")
      .eq("is_catalog_card", true)
      .in("availability", [...SELECTABLE_AVAILABILITY])
      .eq("archived", false)
      .order("issuer")
      .order("sort_order")
      .order("name"),
    admin
      .from("instruments")
      .select(CARD_CATALOG_SELECT)
      .eq("kind", "credit")
      .eq("is_catalog_card", false)
      .eq("owner_user_id", userId)
      .eq("archived", false)
      .order("sort_order")
      .order("name"),
    admin
      .from("user_card_selections")
      .select("instrument_id")
      .eq("user_id", userId),
    admin
      .from("user_onboarding")
      .select("cards_completed_at, skipped_cards")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const error = [catalogResult, customResult, selectionResult, onboardingResult].find(
    (result) => result.error,
  )?.error;
  if (error) throw error;

  const requestedSelectionIds = fromSupabaseRows<{ instrumentId: string }>(
    selectionResult.data,
  ).map((row) => row.instrumentId);
  const rawDiscoverableCatalog = fromSupabaseRows<CardCatalogItem>(
    catalogResult.data,
  );
  const requestedIdSet = new Set(requestedSelectionIds);
  const seenProducts = new Set<string>();
  const discoverableCatalog = rawDiscoverableCatalog.filter((card) => {
    const identity = catalogIdentity(card);
    if (!seenProducts.has(identity)) {
      seenProducts.add(identity);
      return true;
    }
    // Preserve an already-saved duplicate so it can still be removed. New
    // users see one canonical choice for each issuer/product combination.
    return requestedIdSet.has(card.id);
  });
  const discoverableIds = new Set(discoverableCatalog.map((card) => card.id));
  const legacySelectionIds = requestedSelectionIds.filter(
    (instrumentId) => !discoverableIds.has(instrumentId),
  );
  let legacySelections: CardCatalogItem[] = [];
  if (legacySelectionIds.length) {
    const legacyResult = await admin
      .from("instruments")
      .select(CARD_CATALOG_SELECT)
      .in("id", legacySelectionIds)
      .eq("is_catalog_card", true);
    if (legacyResult.error) throw legacyResult.error;
    legacySelections = fromSupabaseRows<CardCatalogItem>(legacyResult.data);
  }

  // A discontinued/archived card disappears from discovery, but a user who
  // already selected it must still be able to keep or remove it.
  const customCards = fromSupabaseRows<CardCatalogItem>(customResult.data);
  const catalog = [
    ...discoverableCatalog,
    ...customCards,
    ...legacySelections.filter(
      (legacy) => !customCards.some((custom) => custom.id === legacy.id),
    ),
  ].sort((a, b) =>
    a.issuer.localeCompare(b.issuer) ||
    a.sortOrder - b.sortOrder ||
    a.name.localeCompare(b.name),
  );
  const catalogIds = new Set(catalog.map((card) => card.id));
  const selectedIds = requestedSelectionIds.filter((instrumentId) =>
    catalogIds.has(instrumentId),
  );
  const [onboarding] = fromSupabaseRows<
    Pick<UserOnboarding, "cardsCompletedAt" | "skippedCards">
  >(onboardingResult.data ? [onboardingResult.data] : []);

  return {
    catalog,
    selectedIds,
    completed: Boolean(onboarding?.cardsCompletedAt),
    skippedCards: onboarding?.skippedCards ?? false,
  };
}

export interface ManualCardInput {
  issuer: string;
  name: string;
  network: "visa" | "mastercard" | "rupay" | "amex" | "diners" | "other";
}

/**
 * Add a private, manual-tracking card when an issuer product is not yet in the
 * curated catalogue. No reward rate, fee, source, or benefit is inferred.
 */
export async function createManualCard(userId: string, input: ManualCardInput) {
  const issuer = input.issuer.trim().replace(/\s+/g, " ");
  const name = input.name.trim().replace(/\s+/g, " ");
  const admin = createSupabaseAdminClient();
  const customResult = await admin
    .from("instruments")
    .select(CARD_CATALOG_SELECT)
    .eq("owner_user_id", userId)
    .eq("is_catalog_card", false)
    .eq("kind", "credit")
    .eq("archived", false);
  if (customResult.error) throw customResult.error;
  const customCards = fromSupabaseRows<CardCatalogItem>(customResult.data);
  const existing = customCards.find(
    (card) =>
      card.issuer.localeCompare(issuer, undefined, { sensitivity: "base" }) === 0 &&
      card.name.localeCompare(name, undefined, { sensitivity: "base" }) === 0,
  );
  if (existing) return existing;

  const row = {
    id: `card_user_${nanoid(16)}`,
    name,
    shortName: name.replace(/\s+(credit|charge)\s+card$/i, "").slice(0, 40),
    issuer,
    network: input.network,
    kind: "credit" as const,
    colorFrom: "#334155",
    colorTo: "#0F172A",
    rewardUnit: "Rewards (manual)",
    unitValuePaise: 0,
    rewardKind: "points" as const,
    overallCapPeriod: "none" as const,
    excludedCategories: "[]",
    options: "{}",
    annualFeeKnown: false,
    joiningFeeKnown: false,
    feeNote: "Enter rewards only after confirming them on your issuer statement.",
    perks: "[]",
    sourceNote: "Added by you. LedgerKit does not make issuer or reward claims for this card.",
    catalogCategory: "manual",
    catalogSummary: "Private manual-tracking card. No reward rate or benefit is assumed.",
    officialUrl: "",
    termsUrl: "",
    verifiedAt: null,
    availability: "active" as const,
    rewardCoverage: "manual" as const,
    isCatalogCard: false,
    ownerUserId: userId,
    archived: false,
    sortOrder: 50_000,
  };
  const insertResult = await admin
    .from("instruments")
    .insert(toSupabaseRow(row))
    .select(CARD_CATALOG_SELECT)
    .single();
  if (insertResult.error) throw insertResult.error;
  return fromSupabaseRows<CardCatalogItem>([insertResult.data])[0]!;
}

export async function initializeCardOnboarding(userId: string) {
  const result = await createSupabaseAdminClient()
    .from("user_onboarding")
    .upsert(
      toSupabaseRow({
        userId,
        cardsCompletedAt: null,
        skippedCards: false,
        updatedAt: stamp(),
      }),
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (result.error) throw result.error;
}

/** Replace a user's card set atomically through the migration-owned RPC. */
export async function saveCardSelection(
  userId: string,
  input: { instrumentIds: string[]; noCards: boolean },
) {
  const instrumentIds = [...new Set(input.instrumentIds)];
  if (input.noCards && instrumentIds.length) {
    throw new ApiError(
      "Choose cards or select that you do not use a credit card, not both.",
      400,
    );
  }
  if (!input.noCards && !instrumentIds.length) {
    throw new ApiError(
      "Choose at least one card, or select that you do not use a credit card.",
      400,
    );
  }

  const admin = createSupabaseAdminClient();
  const saveResult = await admin.rpc("save_user_card_selection", {
    p_user_id: userId,
    p_instrument_ids: instrumentIds,
    p_no_cards: input.noCards,
  });
  if (saveResult.error) {
    if (
      saveResult.error.code === "22023" ||
      /not available|select at least|cannot both/i.test(saveResult.error.message)
    ) {
      throw new ApiError(saveResult.error.message, 400);
    }
    throw saveResult.error;
  }

  const selectedIds = Array.isArray(saveResult.data)
    ? saveResult.data.filter((value): value is string => typeof value === "string")
    : instrumentIds;
  return { selectedIds, completed: true as const };
}

export async function setCardOnboardingMetadata(
  userId: string,
  completed: boolean,
) {
  const admin = createSupabaseAdminClient();
  const userResult = await admin.auth.admin.getUserById(userId);
  if (userResult.error || !userResult.data.user) {
    throw userResult.error ?? new ApiError("Could not update your sign-in.", 503);
  }
  const result = await admin.auth.admin.updateUserById(userId, {
    app_metadata: withCardOnboardingMetadata(
      userResult.data.user.app_metadata,
      completed,
    ),
  });
  if (result.error) throw result.error;
}

export async function requireSelectedCard(userId: string, instrumentId: string) {
  const result = await createSupabaseAdminClient()
    .from("user_card_selections")
    .select("instrument_id")
    .eq("user_id", userId)
    .eq("instrument_id", instrumentId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new ApiError("This card is not in your wallet.", 403);
}
