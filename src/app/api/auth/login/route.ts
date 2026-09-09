import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { hasCurrentCardOnboarding } from "@/lib/card-onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCardOnboardingStatus,
  setCardOnboardingMetadata,
} from "@/server/card-selection";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Enter a valid email and password.", 400);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("Email or password is incorrect.", 401);

  const claimCompleted = hasCurrentCardOnboarding(data.user.app_metadata);
  let completed: boolean;
  try {
    // The relational row is durable truth. Missing rows mean onboarding has
    // not been completed, including for accounts created before this feature.
    ({ completed } = await getCardOnboardingStatus(data.user.id));
  } catch (statusError) {
    console.error("Card onboarding status could not be loaded at sign in", {
      name: statusError instanceof Error ? statusError.name : "UnknownError",
      message:
        statusError instanceof Error
          ? statusError.message
          : "Unknown onboarding error",
    });
    // Authentication itself succeeded. During a transient Data API failure,
    // keep the valid session and fall back to the signed claim.
    return ok({
      redirectTo: claimCompleted ? "/" : "/onboarding/cards",
      onboardingStatusDeferred: true,
    });
  }

  if (claimCompleted && !completed) {
    try {
      await setCardOnboardingMetadata(data.user.id, false);
      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();
      if (
        refreshError ||
        hasCurrentCardOnboarding(refreshed.user?.app_metadata)
      ) {
        throw refreshError ?? new Error("The refreshed session has stale claims.");
      }
    } catch (refreshError) {
      console.error("Card onboarding session could not be repaired at sign in", {
        name: refreshError instanceof Error ? refreshError.name : "UnknownError",
        message:
          refreshError instanceof Error
            ? refreshError.message
            : "Unknown session refresh error",
      });
      // Never trust a stale true claim when durable state says setup is
      // incomplete. Clearing the session fails closed.
      await supabase.auth.signOut();
      return fail("Your session could not be refreshed. Please sign in again.", 503);
    }
  }

  // A durable timestamp without the current signed claim can be a migrated or
  // pre-release wallet. Never silently upgrade it: the user must explicitly
  // confirm the selected cards once.
  return ok({
    redirectTo: completed && claimCompleted ? "/" : "/onboarding/cards",
  });
}
