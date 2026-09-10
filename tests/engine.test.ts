import { evaluateExpense, newCapLedger, capStatusFor, type EngineInstrument, type EngineRule } from "../src/lib/rewards/engine";

// These are isolated engine-mechanics fixtures. They are never imported by the
// catalogue, seed, or migrations and must not be treated as current card terms.

let pass = 0, fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n       got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`); }
}

const baseRule = (o: Partial<EngineRule>): EngineRule => ({
  id: "r", name: "r", priority: 0, isBase: false, matchMerchants: [], matchCategories: [],
  matchApps: [], channel: "any", rateType: "percent", rateBps: 0, blockSizePaise: 10000,
  pointsPerBlock: 0, minTxnPaise: 0, maxTxnPaise: null, capUnits: null, capPeriod: "none",
  capGroup: "", excludeCategories: [], excludeMerchants: [], requiresFlag: null,
  requiresFlagValue: true, validFrom: null, validTo: null, active: true, ...o,
});

const exp = (o: any) => ({
  id: "e", occurredAt: "2026-09-05", eligiblePaise: 100000, categorySlug: "online-shopping",
  merchantSlug: null, paymentAppSlug: null, channel: "online" as const, flags: {}, ...o,
});

/* ---- Flipkart Axis: quarterly cap per merchant ---- */
const fka: EngineInstrument = {
  id: "fka", shortName: "Flipkart Axis", statementDay: 18, rewardUnit: "INR",
  unitValuePaise: 100, overallCapUnits: null, overallCapPeriod: "none",
  excludedCategories: ["fuel", "rent"], defaultFlags: {},
  floorRewardToWholeUnit: true,
};
const fkaRules = [
  baseRule({ id: "myntra", name: "Myntra", matchMerchants: ["myntra"], rateBps: 750, minTxnPaise: 10000, capUnits: 4000, capPeriod: "quarter", capGroup: "m" }),
  baseRule({ id: "flipkart", name: "Flipkart", matchMerchants: ["flipkart"], rateBps: 500, minTxnPaise: 10000, capUnits: 4000, capPeriod: "quarter", capGroup: "f" }),
  baseRule({ id: "cleartrip", name: "Cleartrip", matchMerchants: ["cleartrip"], rateBps: 500, minTxnPaise: 10000, capUnits: 4000, capPeriod: "quarter", capGroup: "c" }),
  baseRule({ id: "partners", name: "Partners", matchMerchants: ["swiggy", "uber"], rateBps: 400, minTxnPaise: 10001 }),
  baseRule({ id: "base", name: "Base", isBase: true, rateBps: 100, minTxnPaise: 10000 }),
];

console.log("Flipkart Axis");
let L = newCapLedger();
check("₹1,000 Myntra → ₹75",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "myntra", eligiblePaise: 100000 }), L).valuePaise, 7500);
check("₹1,000 Flipkart → ₹50",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "flipkart", eligiblePaise: 100000 }), L).valuePaise, 5000);
check("₹1,000 Swiggy → ₹40",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "swiggy", eligiblePaise: 100000 }), L).valuePaise, 4000);
check("₹1,000 unknown merchant → ₹10 base",
  evaluateExpense(fka, fkaRules, exp({ eligiblePaise: 100000 }), L).valuePaise, 1000);
check("₹99.99 is below the general cashback threshold",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "flipkart", eligiblePaise: 9999 }), L).valuePaise, 0);
check("an exact ₹100 Flipkart transaction earns cashback",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "flipkart", eligiblePaise: 10000 }), L).valuePaise, 500);
check("an exact ₹100 preferred-partner transaction falls back to 1%",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "swiggy", eligiblePaise: 10000 }), L).valuePaise, 100);
check("₹630 Cleartrip cashback rounds down from ₹31.50 to ₹31",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "cleartrip", eligiblePaise: 63000 }), L).valuePaise, 3100);
check("fuel is excluded card-wide",
  evaluateExpense(fka, fkaRules, exp({ categorySlug: "fuel", eligiblePaise: 500000 }), L).valuePaise, 0);

// Cap: Myntra cap is ₹4000/quarter. Already used ₹75. Spend ₹60,000 → 7.5% = ₹4500, capped to ₹3925.
L = newCapLedger();
const big = evaluateExpense(fka, fkaRules, exp({ merchantSlug: "myntra", eligiblePaise: 6000000 }), L);
check("₹60k Myntra capped at ₹4,000/qtr", big.valuePaise, 400000);
check("  ...and ₹500 recorded as lost to the cap", big.cappedUnitsMilli, 500 * 1000);
const after = evaluateExpense(fka, fkaRules, exp({ merchantSlug: "myntra", eligiblePaise: 100000 }), L);
check("next Myntra spend in same quarter earns nothing", after.valuePaise, 0);
// Flipkart bucket is separate and untouched
check("Flipkart bucket unaffected by Myntra cap",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "flipkart", eligiblePaise: 100000 }), L).valuePaise, 5000);
// New quarter resets
check("new quarter resets the cap",
  evaluateExpense(fka, fkaRules, exp({ merchantSlug: "myntra", eligiblePaise: 100000, occurredAt: "2026-10-02" }), L).valuePaise, 7500);

/* ---- Millennia CC: two separate monthly buckets + SmartBuy downgrade ---- */
console.log("\nHDFC Millennia CC");
const mcc: EngineInstrument = {
  id: "mcc", shortName: "Millennia CC", statementDay: 2, rewardUnit: "CashPoints",
  unitValuePaise: 100, overallCapUnits: null, overallCapPeriod: "none",
  excludedCategories: ["fuel"], defaultFlags: {},
};
const mccRules = [
  baseRule({ id: "sb", name: "SmartBuy downgrade", priority: 200, matchApps: ["smartbuy"], rateBps: 100, capUnits: 1000, capPeriod: "month", capGroup: "base" }),
  baseRule({ id: "partners", name: "Partners", matchMerchants: ["amazon", "swiggy"], rateBps: 500, capUnits: 1000, capPeriod: "month", capGroup: "acc" }),
  baseRule({ id: "base", name: "Base", isBase: true, rateBps: 100, capUnits: 1000, capPeriod: "month", capGroup: "base" }),
];
L = newCapLedger();
check("₹10,000 Amazon → 500 CashPoints",
  evaluateExpense(mcc, mccRules, exp({ merchantSlug: "amazon", eligiblePaise: 1000000 }), L).unitsMilli, 500000);
check("Amazon via SmartBuy downgrades to 1%",
  evaluateExpense(mcc, mccRules, exp({ merchantSlug: "amazon", paymentAppSlug: "smartbuy", eligiblePaise: 1000000 }), L).unitsMilli, 100000);
L = newCapLedger();
const m1 = evaluateExpense(mcc, mccRules, exp({ merchantSlug: "amazon", eligiblePaise: 3000000 }), L);
check("₹30,000 Amazon hits the 1,000 point monthly cap", m1.unitsMilli, 1000000);
check("base bucket still has room after 5% bucket is exhausted",
  evaluateExpense(mcc, mccRules, exp({ eligiblePaise: 1000000 }), L).unitsMilli, 100000);

/* ---- Millennia DC: card-wide ₹400/month ceiling on top of rule caps ---- */
console.log("\nHDFC Millennia DC (card-wide cap)");
const mdc: EngineInstrument = {
  id: "mdc", shortName: "Millennia DC", statementDay: 1, rewardUnit: "INR",
  unitValuePaise: 100, overallCapUnits: 400, overallCapPeriod: "month",
  excludedCategories: ["fuel"], defaultFlags: {},
};
const mdcRules = [
  baseRule({ id: "sb", name: "SmartBuy", priority: 100, matchApps: ["smartbuy"], rateBps: 500, minTxnPaise: 40000, capUnits: 1000, capPeriod: "month", capGroup: "sb" }),
  baseRule({ id: "online", name: "Online", channel: "online", rateBps: 250, minTxnPaise: 40000, capUnits: 400, capPeriod: "month", capGroup: "on" }),
  baseRule({ id: "base", name: "Offline", isBase: true, rateBps: 100, minTxnPaise: 10000, capUnits: 400, capPeriod: "month", capGroup: "off" }),
];
L = newCapLedger();
const d1 = evaluateExpense(mdc, mdcRules, exp({ paymentAppSlug: "smartbuy", eligiblePaise: 1600000 }), L);
check("₹16,000 SmartBuy: 5% = ₹800 → clipped to card-wide ₹400", d1.valuePaise, 40000);
check("next online spend earns nothing — card cap gone",
  evaluateExpense(mdc, mdcRules, exp({ eligiblePaise: 1000000 }), L).valuePaise, 0);
check("₹300 online is under the ₹400 minimum → base rule instead",
  evaluateExpense(mdc, mdcRules, exp({ eligiblePaise: 30000, occurredAt: "2026-10-05" }), newCapLedger()).ruleName, "Offline");

/* ---- headroom reporting ---- */
console.log("\nCap reporting");
L = newCapLedger();
evaluateExpense(fka, fkaRules, exp({ merchantSlug: "myntra", eligiblePaise: 2000000 }), L); // ₹20k → ₹1500
const caps = capStatusFor(fka, fkaRules, L, "2026-09-05");
const myntraCap = caps.find((c) => c.ruleName === "Myntra")!;
check("Myntra cap used = ₹1,500", myntraCap.usedUnits, 1500);
check("remaining = ₹2,500", myntraCap.remainingUnits, 2500);
check("headroom = ₹33,333 more Myntra spend", myntraCap.headroomSpendPaise, 3333333);

/* ---- Amazon Pay ICICI: Prime answered per expense ---- */
console.log("\nAmazon Pay ICICI (Prime asked per expense)");
const api: EngineInstrument = {
  id: "api", shortName: "Amazon Pay ICICI", statementDay: 12, rewardUnit: "INR",
  unitValuePaise: 100, overallCapUnits: null, overallCapPeriod: "none",
  excludedCategories: ["rent"], defaultFlags: { primeMember: true },
};
const apiRules = [
  baseRule({ id: "prime", name: "Amazon.in with Prime", matchMerchants: ["amazon"], rateBps: 500, requiresFlag: "primeMember", requiresFlagValue: true }),
  baseRule({ id: "noprime", name: "Amazon.in without Prime", matchMerchants: ["amazon"], rateBps: 300, requiresFlag: "primeMember", requiresFlagValue: false }),
  baseRule({ id: "base", name: "Base", isBase: true, rateBps: 100 }),
];
L = newCapLedger();
check("₹10,000 Amazon with Prime → ₹500",
  evaluateExpense(api, apiRules, exp({ merchantSlug: "amazon", eligiblePaise: 1000000, flags: { primeMember: true } }), L).valuePaise, 50000);
check("same spend without Prime → ₹300",
  evaluateExpense(api, apiRules, exp({ merchantSlug: "amazon", eligiblePaise: 1000000, flags: { primeMember: false } }), L).valuePaise, 30000);
check("the rule name records which applied",
  evaluateExpense(api, apiRules, exp({ merchantSlug: "amazon", eligiblePaise: 100000, flags: { primeMember: false } }), L).ruleName, "Amazon.in without Prime");
check("an expense with no answer falls back to the card default",
  evaluateExpense(api, apiRules, exp({ merchantSlug: "amazon", eligiblePaise: 1000000 }), L).valuePaise, 50000);
check("the flag does not leak into non-Amazon spend",
  evaluateExpense(api, apiRules, exp({ eligiblePaise: 1000000, flags: { primeMember: false } }), L).ruleName, "Base");

/* ---- slice UPI Credit Card: published base redemption tier ---- */
console.log("\nslice UPI Credit Card (base-tier estimate)");
const slice: EngineInstrument = {
  id: "card-slice-rupay", shortName: "slice UPI", statementDay: 1,
  rewardUnit: "monies", unitValuePaise: 1, overallCapUnits: null,
  overallCapPeriod: "none",
  excludedCategories: [
    "fuel", "rent", "taxes", "credit-card-bill", "wallet-load",
    "insurance", "investments", "bank-charges", "education", "courses",
    "emi",
  ],
  defaultFlags: {},
};
const sliceRules = [
  baseRule({
    id: "slice-base",
    name: "Eligible card and UPI spends",
    isBase: true,
    rateType: "points_per_block",
    blockSizePaise: 100,
    pointsPerBlock: 1,
  }),
];
const sliceSpend = evaluateExpense(
  slice,
  sliceRules,
  exp({ eligiblePaise: 100075, channel: "upi" }),
  newCapLedger(),
);
check(
  "base-tier estimate floors ₹1,000.75 to 1,000 monies",
  sliceSpend.unitsMilli,
  1000000,
);
check("base redemption tier values those monies at ₹10", sliceSpend.valuePaise, 1000);
check("fuel earns no monies",
  evaluateExpense(slice, sliceRules, exp({ categorySlug: "fuel", channel: "upi" }), newCapLedger()).valuePaise, 0);
check("sliced/EMI transactions earn no monies",
  evaluateExpense(slice, sliceRules, exp({ categorySlug: "emi" }), newCapLedger()).valuePaise, 0);
check("education parent category earns no monies",
  evaluateExpense(slice, sliceRules, exp({ categorySlug: "education" }), newCapLedger()).valuePaise, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
