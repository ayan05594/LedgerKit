import { z } from "zod";
import { ApiError, handle, handleRead } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { hasCurrentCardOnboarding } from "@/lib/card-onboarding";
import {
  clearSupabaseAuthCookies,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  getCardSelection,
  listInstrumentsForSelection,
  saveCardSelection,
  setCardOnboardingMetadata,
} from "@/server/card-selection";

export const dynamic = "force-dynamic";
const OPTIONAL_WALLET_HYDRATION_TIMEOUT_MS = 1_000;

async function settleWithin<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timeoutId = setTimeout(() => resolve(undefined), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
export const runtime = "nodejs";

const saveSchema = z
  .object({
    instrumentIds: z.array(z.string().trim().min(1)).max(100),
    noCards: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.noCards && value.instrumentIds.length) {
      context.addIssue({
        code: "custom",
        message: "Choose cards or the no-card option, not both.",
        path: ["noCards"],
      });
    }
    if (!value.noCards && !value.instrumentIds.length) {
      context.addIssue({
        code: "custom",
        message: "Choose at least one card or use the no-card option.",
        path: ["instrumentIds"],
      });
    }
  });

export async function GET() {
  return handleRead(async () => getCardSelection(await requireUserId()));
}

export async function PUT(request: Request) {
  return handle(async () => {
    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "Invalid card selection.",
        400,
      );
    }

    const userId = await requireUserId();
    const supabase = await createSupabaseServerClient();
    const { data: currentClaims } = await supabase.auth.getClaims();
    const sessionWasCurrent = hasCurrentCardOnboarding(
      currentClaims?.claims?.app_metadata,
    );
    const saved = await saveCardSelection(userId, parsed.data);
    const instrumentsPromise = settleWithin(
      listInstrumentsForSelection(userId, saved.selectedIds).catch(
        (instrumentError) => {
          console.error("Saved wallet instruments could not be returned", {
            name:
              instrumentError instanceof Error
                ? instrumentError.name
                : "UnknownError",
            message:
              instrumentError instanceof Error
                ? instrumentError.message
                : "Unknown instrument read error",
          });
          return undefined;
        },
      ),
      OPTIONAL_WALLET_HYDRATION_TIMEOUT_MS,
    );

    // app_metadata is signed into the access token used by middleware. Issue a
    // fresh token now so the first navigation after onboarding is not bounced
    // back to this page with stale claims.
    // An already-current Settings session does not need refresh-token rotation
    // just to change its wallet.
    let reauthRequired = false;
    if (!sessionWasCurrent) {
      try {
        await setCardOnboardingMetadata(userId, true);
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (error || !hasCurrentCardOnboarding(refreshed.user?.app_metadata)) {
          throw error ?? new Error("The refreshed session has stale claims.");
        }
      } catch (refreshError) {
        // The RPC above is already committed. A refresh token damaged by the
        // previous proxy cannot be repaired by repeatedly saving, so finish
        // successfully and obtain a clean session through password sign-in.
        console.error("Wallet saved but the session requires a fresh sign-in", {
          name:
            refreshError instanceof Error ? refreshError.name : "UnknownError",
          message:
            refreshError instanceof Error
              ? refreshError.message
              : "Unknown session refresh error",
        });
        await clearSupabaseAuthCookies();
        reauthRequired = true;
      }
    }

    const instruments = await instrumentsPromise;
    return {
      ...saved,
      instruments,
      reauthRequired,
      redirectTo: reauthRequired ? "/login?walletSaved=1" : "/",
    };
  });
}
