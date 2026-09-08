import { z } from "zod";
import { ApiError, handle, handleRead } from "@/lib/api";
import { requireUserId } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCardSelection,
  saveCardSelection,
} from "@/server/card-selection";

export const dynamic = "force-dynamic";
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
    const saved = await saveCardSelection(userId, parsed.data);

    // app_metadata is signed into the access token used by middleware. Issue a
    // fresh token now so the first navigation after onboarding is not bounced
    // back to this page with stale claims.
    const supabase = await createSupabaseServerClient();
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (
      error ||
      refreshed.user?.app_metadata?.card_onboarding_completed !== true
    ) {
      throw new ApiError(
        "Your cards were saved, but the session could not be refreshed. Please try once more.",
        503,
      );
    }

    return { ...saved, redirectTo: "/" };
  });
}
