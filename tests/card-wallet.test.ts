import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CARD_ONBOARDING_VERSION,
  hasCurrentCardOnboarding,
  withCardOnboardingMetadata,
} from "../src/lib/card-onboarding";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

assert.equal(hasCurrentCardOnboarding(null), false);
assert.equal(hasCurrentCardOnboarding({ card_onboarding_completed: true }), false);
assert.equal(
  hasCurrentCardOnboarding({
    card_onboarding_completed: true,
    card_onboarding_version: CARD_ONBOARDING_VERSION,
  }),
  true,
);
assert.deepEqual(withCardOnboardingMetadata({ role: "member" }, true), {
  role: "member",
  card_onboarding_completed: true,
  card_onboarding_version: CARD_ONBOARDING_VERSION,
});
assert.equal(
  hasCurrentCardOnboarding(withCardOnboardingMetadata({}, false)),
  false,
);

const proxy = source("src/proxy.ts");
const queries = source("src/server/queries.ts");
const selection = source("src/server/card-selection.ts");
const settings = source("src/app/settings/page.tsx");
const onboarding = source("src/app/onboarding/cards/page.tsx");
const client = source("src/lib/client-api.ts");
const route = source("src/app/api/card-selection/route.ts");
const supabaseServer = source("src/lib/supabase/server.ts");
const login = source("src/app/api/auth/login/route.ts");
const picker = source("src/components/cards/card-selection.tsx");

assert.match(
  proxy,
  /hasCurrentCardOnboarding\(appMetadata\)/,
  "middleware must reject pre-version wallet claims",
);
assert.match(
  proxy,
  /requestHeaders\.set\("cookie", request\.cookies\.toString\(\)\)/,
  "rotated Supabase cookies must reach the downstream request",
);
assert.match(
  proxy,
  /Object\.entries\(authResponseHeaders\)/,
  "Supabase private/no-store response headers must be preserved",
);
assert.match(
  queries,
  /walletConfirmed \? selectedInstrumentIds : \[\]/,
  "unconfirmed migration suggestions must stay out of expense dropdowns",
);
assert.match(
  selection,
  /if \(!onboarding\.completed \|\| !selectedIds\.length\) return \[\]/,
  "card list reads must require an explicitly confirmed wallet",
);
assert.match(
  route,
  /if \(!sessionWasCurrent\)[\s\S]*setCardOnboardingMetadata/,
  "ordinary Settings saves must not depend on auth token rotation",
);
assert.match(
  login,
  /if \(claimCompleted && !completed\)/,
  "login may clear an invalid current claim but must not promote a legacy one",
);
assert.doesNotMatch(
  login,
  /setCardOnboardingMetadata\(data\.user\.id, completed\)/,
  "durable legacy completion must not be silently upgraded to the current claim",
);
assert.match(
  route,
  /reauthRequired[\s\S]*\/login\?walletSaved=1/,
  "a committed wallet with a damaged refresh token must recover through sign-in",
);
assert.match(
  route,
  /settleWithin\([\s\S]*OPTIONAL_WALLET_HYDRATION_TIMEOUT_MS/,
  "optional wallet cache hydration must not hold a committed save open indefinitely",
);
assert.match(
  supabaseServer,
  /cookie\.name\.startsWith\(authCookiePrefix\)[\s\S]*cookieStore\.delete/,
  "the damaged chunked auth session must be cleared before reauthentication",
);
assert.match(
  settings,
  /\{cardsOpen && cardSelection && \(/,
  "the wallet picker must mount with the latest saved selections",
);
assert.match(
  onboarding,
  /!data \|\| !hydrated/,
  "onboarding must hydrate migration suggestions before mounting the picker",
);
assert.match(
  settings,
  /if \(result\.reauthRequired\)[\s\S]*window\.location\.assign/,
  "Settings must follow the clean-sign-in recovery response",
);
assert.match(
  client,
  /instruments:[\s\S]*saved\.instruments \?\?[\s\S]*selected\.has\(instrument\.id\)/,
  "the exact saved wallet must replace the cached expense dropdown immediately",
);
assert.match(
  picker,
  /nextQuery\.trim\(\) && bank === SELECTED_CARDS[\s\S]*setBank\(ALL_BANKS\)/,
  "typing in an existing wallet must search the full catalogue",
);

console.log("card wallet: existing sessions must confirm and dropdowns stay selected-only");
