#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp "$root/src/lib/money.ts" "$root/src/lib/rewards/periods.ts" "$root/src/lib/rewards/engine.ts" "$tmp/"
sed -i 's|from "../money"|from "./money.ts"|; s|from "./periods"|from "./periods.ts"|' "$tmp/engine.ts"
cp "$root/tests/engine.test.ts" "$tmp/engine.test.ts"
sed -i 's|"../src/lib/rewards/engine.ts"|"./engine.ts"|' "$tmp/engine.test.ts"
node --experimental-strip-types "$tmp/engine.test.ts" 2>&1 | grep -viE "experimentalwarning|trace-warnings"
