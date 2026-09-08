import "server-only";

import {
  CREDIT_CARD_CATALOG_VERSION,
  CREDIT_CARD_INSTRUMENT_SEEDS,
} from "@/data/credit-card-seed";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toSupabaseRow } from "@/lib/supabase/rows";

let ready: Promise<void> | null = null;

/**
 * Explicit, idempotent maintenance path for publishing the checked-in card
 * catalogue over Supabase's HTTPS Data API. It is never run during login or
 * registration; production normally receives the same rows via migrations.
 */
export async function syncCreditCardCatalog() {
  const admin = createSupabaseAdminClient();
  const marker = await admin
    .from("settings")
    .select("value")
    .eq("key", "credit_card_catalog_version")
    .maybeSingle();
  if (marker.error) throw marker.error;
  if (marker.data?.value === CREDIT_CARD_CATALOG_VERSION) return;

  const desiredIds = new Set(
    CREDIT_CARD_INSTRUMENT_SEEDS.map((row) => row.id),
  );
  const publishedResult = await admin
    .from("instruments")
    .select("id")
    .eq("is_catalog_card", true);
  if (publishedResult.error) throw publishedResult.error;
  const staleIds = (publishedResult.data ?? [])
    .map((row) => String(row.id))
    .filter((id) => !desiredIds.has(id));

  // Never delete a retired entry because old expenses and selections may
  // still reference it. It disappears from discovery, while an existing
  // selection can still keep or remove it.
  for (let offset = 0; offset < staleIds.length; offset += 100) {
    const staleResult = await admin
      .from("instruments")
      .update({ availability: "discontinued" })
      .in("id", staleIds.slice(offset, offset + 100));
    if (staleResult.error) throw staleResult.error;
  }

  for (let offset = 0; offset < CREDIT_CARD_INSTRUMENT_SEEDS.length; offset += 100) {
    const sourceRows = CREDIT_CARD_INSTRUMENT_SEEDS.slice(offset, offset + 100);
    const existingResult = await admin
      .from("instruments")
      .select(
        "id,annual_fee_paise,annual_fee_known,joining_fee_paise,joining_fee_known,fee_note",
      )
      .in("id", sourceRows.map((row) => row.id));
    if (existingResult.error) throw existingResult.error;
    const existingById = new Map(
      (existingResult.data ?? []).map((row) => [String(row.id), row]),
    );
    const fullRows = sourceRows.map((row) => {
      const existing = existingById.get(row.id);
      const preserveKnownFee =
        (!row.annualFeeKnown && existing?.annual_fee_known === true) ||
        (!row.joiningFeeKnown && existing?.joining_fee_known === true);
      return toSupabaseRow({
        ...row,
        annualFeePaise:
          !row.annualFeeKnown && existing?.annual_fee_known
            ? Number(existing.annual_fee_paise ?? 0)
            : row.annualFeePaise,
        annualFeeKnown:
          row.annualFeeKnown || existing?.annual_fee_known === true,
        joiningFeePaise:
          !row.joiningFeeKnown && existing?.joining_fee_known
            ? Number(existing.joining_fee_paise ?? 0)
            : row.joiningFeePaise,
        joiningFeeKnown:
          row.joiningFeeKnown || existing?.joining_fee_known === true,
        feeNote:
          preserveKnownFee && existing?.fee_note
            ? String(existing.fee_note)
            : row.feeNote,
      });
    });
    const result = await admin
      .from("instruments")
      .upsert(fullRows, { onConflict: "id" });
    if (result.error) throw result.error;
  }
  const markerResult = await admin.from("settings").upsert(
    {
      key: "credit_card_catalog_version",
      value: CREDIT_CARD_CATALOG_VERSION,
    },
    { onConflict: "key" },
  );
  if (markerResult.error) throw markerResult.error;
}

export async function ensureCreditCardCatalog() {
  if (!ready) {
    ready = syncCreditCardCatalog().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
