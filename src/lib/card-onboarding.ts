export const CARD_ONBOARDING_VERSION = "wallet-v1";

type AppMetadata = Record<string, unknown> | null | undefined;

/**
 * The version matters as much as the completion flag. A user can keep an old
 * Supabase access token for a while, so a boolean alone cannot distinguish a
 * wallet they explicitly confirmed from one created by an earlier release.
 */
export function hasCurrentCardOnboarding(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return false;
  const value = metadata as Record<string, unknown>;
  return (
    value.card_onboarding_completed === true &&
    value.card_onboarding_version === CARD_ONBOARDING_VERSION
  );
}

export function withCardOnboardingMetadata(
  metadata: AppMetadata,
  completed: boolean,
) {
  return {
    ...(metadata ?? {}),
    card_onboarding_completed: completed,
    card_onboarding_version: completed ? CARD_ONBOARDING_VERSION : null,
  };
}
