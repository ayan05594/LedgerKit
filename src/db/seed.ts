import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import {
  CREDIT_CARD_CATALOG_VERSION,
  CREDIT_CARD_INSTRUMENT_SEEDS,
  PARTIAL_REWARD_CARD_IDS,
} from "../data/credit-card-seed";
import {
  categories,
  instruments,
  merchants,
  paymentApps,
  rewardRules,
  settings,
} from "./schema";

type DB = PostgresJsDatabase<Record<string, unknown>>;

const R = (rupees: number) => Math.round(rupees * 100);
const CATALOG_INSTRUMENT_IDS = new Set(
  CREDIT_CARD_INSTRUMENT_SEEDS.map((row) => row.id),
);
/* ------------------------------------------------------------- categories */

interface Cat {
  slug: string;
  name: string;
  icon: string;
  color: string;
  parent?: string;
  requiresLabel?: boolean;
}

export const CATEGORIES: Cat[] = [
  // Food
  { slug: "food", name: "Food & Drink", icon: "UtensilsCrossed", color: "#E8590C" },
  { slug: "food-delivery", name: "Food delivery", icon: "Bike", color: "#E8590C", parent: "food" },
  { slug: "dining-out", name: "Restaurants", icon: "UtensilsCrossed", color: "#F08C00", parent: "food" },
  { slug: "cafe", name: "Cafés", icon: "Coffee", color: "#B45309", parent: "food" },
  { slug: "groceries", name: "Groceries", icon: "ShoppingBasket", color: "#2F9E44", parent: "food" },
  { slug: "quick-commerce", name: "Quick commerce", icon: "Timer", color: "#37B24D", parent: "food" },

  // Shopping
  { slug: "shopping", name: "Shopping", icon: "ShoppingBag", color: "#7048E8" },
  { slug: "online-shopping", name: "Online shopping", icon: "Package", color: "#7048E8", parent: "shopping" },
  { slug: "fashion", name: "Clothing & fashion", icon: "Shirt", color: "#AE3EC9", parent: "shopping" },
  { slug: "electronics", name: "Electronics", icon: "Smartphone", color: "#4C6EF5", parent: "shopping" },
  { slug: "home-goods", name: "Home & furniture", icon: "Lamp", color: "#0CA678", parent: "shopping" },
  { slug: "beauty", name: "Beauty & personal care", icon: "Sparkles", color: "#E64980", parent: "shopping" },
  { slug: "gift-cards", name: "Gift cards & vouchers", icon: "Ticket", color: "#868E96", parent: "shopping" },

  // Transport
  { slug: "transport", name: "Transport", icon: "Car", color: "#1C7ED6" },
  { slug: "cab-ride", name: "Cabs & autos", icon: "Car", color: "#1C7ED6", parent: "transport" },
  { slug: "fuel", name: "Fuel", icon: "Fuel", color: "#F76707", parent: "transport" },
  { slug: "public-transport", name: "Metro & bus", icon: "TrainFront", color: "#1098AD", parent: "transport" },
  { slug: "tolls-parking", name: "Tolls & parking", icon: "CircleParking", color: "#495057", parent: "transport" },
  { slug: "vehicle", name: "Vehicle upkeep", icon: "Wrench", color: "#5C7CFA", parent: "transport" },

  // Bills
  { slug: "bills", name: "Bills & utilities", icon: "ReceiptText", color: "#0C8599" },
  { slug: "electricity", name: "Electricity", icon: "Zap", color: "#F59F00", parent: "bills" },
  { slug: "mobile-recharge", name: "Mobile & recharge", icon: "Signal", color: "#0C8599", parent: "bills" },
  { slug: "broadband", name: "Broadband", icon: "Wifi", color: "#1098AD", parent: "bills" },
  { slug: "dth-cable", name: "DTH & cable", icon: "Tv", color: "#3B5BDB", parent: "bills" },
  { slug: "water-gas", name: "Water & gas", icon: "Droplets", color: "#22B8CF", parent: "bills" },
  { slug: "rent", name: "Rent", icon: "House", color: "#495057", parent: "bills" },
  { slug: "maintenance", name: "Society maintenance", icon: "Building2", color: "#868E96", parent: "bills" },

  // Entertainment
  { slug: "entertainment", name: "Entertainment", icon: "Clapperboard", color: "#D6336C" },
  { slug: "movies", name: "Movies", icon: "Clapperboard", color: "#D6336C", parent: "entertainment" },
  { slug: "streaming", name: "Streaming", icon: "PlayCircle", color: "#E64980", parent: "entertainment" },
  { slug: "events", name: "Events & shows", icon: "PartyPopper", color: "#F06595", parent: "entertainment" },
  { slug: "gaming", name: "Gaming", icon: "Gamepad2", color: "#9C36B5", parent: "entertainment" },

  // Travel
  { slug: "travel", name: "Travel", icon: "Plane", color: "#0B7285" },
  { slug: "flights", name: "Flights", icon: "Plane", color: "#0B7285", parent: "travel" },
  { slug: "hotels", name: "Hotels & stays", icon: "BedDouble", color: "#1098AD", parent: "travel" },
  { slug: "trains", name: "Trains", icon: "TrainFront", color: "#087F5B", parent: "travel" },
  { slug: "bus", name: "Bus", icon: "Bus", color: "#2B8A3E", parent: "travel" },

  // Health
  { slug: "health", name: "Health", icon: "HeartPulse", color: "#E03131" },
  { slug: "pharmacy", name: "Pharmacy", icon: "Pill", color: "#E03131", parent: "health" },
  { slug: "doctor", name: "Doctor & hospital", icon: "Stethoscope", color: "#C92A2A", parent: "health" },
  { slug: "diagnostics", name: "Lab tests", icon: "TestTube", color: "#F03E3E", parent: "health" },
  { slug: "fitness", name: "Gym & fitness", icon: "Dumbbell", color: "#F76707", parent: "health" },

  // Education
  { slug: "education", name: "Education", icon: "GraduationCap", color: "#5F3DC4" },
  { slug: "courses", name: "Courses", icon: "GraduationCap", color: "#5F3DC4", parent: "education" },
  { slug: "books", name: "Books", icon: "BookOpen", color: "#6741D9", parent: "education" },

  // Money
  { slug: "money", name: "Money & finance", icon: "Landmark", color: "#343A40" },
  { slug: "emi", name: "EMI", icon: "CalendarClock", color: "#343A40", parent: "money" },
  { slug: "credit-card-bill", name: "Credit card bill", icon: "CreditCard", color: "#495057", parent: "money" },
  { slug: "investments", name: "Investments", icon: "TrendingUp", color: "#2B8A3E", parent: "money" },
  { slug: "insurance", name: "Insurance", icon: "ShieldCheck", color: "#1864AB", parent: "money" },
  { slug: "taxes", name: "Taxes & government", icon: "Landmark", color: "#343A40", parent: "money" },
  { slug: "bank-charges", name: "Bank charges", icon: "Receipt", color: "#868E96", parent: "money" },
  { slug: "wallet-load", name: "Wallet load", icon: "Wallet", color: "#7950F2", parent: "money" },

  // Personal & people
  { slug: "personal", name: "Personal", icon: "User", color: "#12B886" },
  { slug: "salon", name: "Salon & grooming", icon: "Scissors", color: "#12B886", parent: "personal" },
  { slug: "subscriptions", name: "Subscriptions", icon: "RefreshCw", color: "#15AABF", parent: "personal" },
  { slug: "laundry", name: "Laundry & help", icon: "Shirt", color: "#20C997", parent: "personal" },
  { slug: "pets", name: "Pets", icon: "PawPrint", color: "#74B816", parent: "personal" },
  { slug: "gifts-given", name: "Gifts", icon: "Gift", color: "#F06595", parent: "personal" },
  { slug: "charity", name: "Donations", icon: "HandHeart", color: "#37B24D", parent: "personal" },

  // Catch-alls — these two ask you to name the spend yourself.
  { slug: "miscellaneous", name: "Miscellaneous", icon: "Shapes", color: "#868E96", requiresLabel: true },
  { slug: "other", name: "Other", icon: "CircleDashed", color: "#adb5bd", requiresLabel: true },
];

/* -------------------------------------------------------------- merchants */

const MERCHANTS: [slug: string, name: string, cat: string, color: string][] = [
  ["amazon", "Amazon", "online-shopping", "#FF9900"],
  ["flipkart", "Flipkart", "online-shopping", "#2874F0"],
  ["myntra", "Myntra", "fashion", "#FF3F6C"],
  ["ajio", "AJIO", "fashion", "#2C4152"],
  ["tatacliq", "Tata CLiQ", "online-shopping", "#B4975A"],
  ["nykaa", "Nykaa", "beauty", "#FC2779"],
  ["meesho", "Meesho", "online-shopping", "#570D51"],
  ["croma", "Croma", "electronics", "#00B1AC"],
  ["reliance-digital", "Reliance Digital", "electronics", "#E4002B"],
  ["decathlon", "Decathlon", "shopping", "#0082C3"],
  ["ikea", "IKEA", "home-goods", "#0058A3"],
  ["lenskart", "Lenskart", "shopping", "#00BFA5"],

  ["swiggy", "Swiggy", "food-delivery", "#FC8019"],
  ["zomato", "Zomato", "food-delivery", "#E23744"],
  ["instamart", "Swiggy Instamart", "quick-commerce", "#FC8019"],
  ["blinkit", "Blinkit", "quick-commerce", "#F8CB46"],
  ["zepto", "Zepto", "quick-commerce", "#3E0B6B"],
  ["bigbasket", "BigBasket", "groceries", "#84C225"],
  ["dmart", "DMart", "groceries", "#00A650"],
  ["jiomart", "JioMart", "groceries", "#0F3CC9"],
  ["dominos", "Domino's", "dining-out", "#0078AE"],
  ["starbucks", "Starbucks", "cafe", "#00704A"],
  ["kfc", "KFC", "dining-out", "#A32638"],
  ["mcdonalds", "McDonald's", "dining-out", "#FFC72C"],

  ["uber", "Uber", "cab-ride", "#000000"],
  ["ola", "Ola", "cab-ride", "#C8D400"],
  ["rapido", "Rapido", "cab-ride", "#F9C900"],
  ["namma-yatri", "Namma Yatri", "cab-ride", "#F5C518"],

  ["cleartrip", "Cleartrip", "travel", "#F47523"],
  ["makemytrip", "MakeMyTrip", "travel", "#EB2026"],
  ["goibibo", "Goibibo", "travel", "#2A64F6"],
  ["irctc", "IRCTC", "trains", "#213E7B"],
  ["indigo", "IndiGo", "flights", "#09216B"],
  ["redbus", "redBus", "bus", "#D84E55"],
  ["oyo", "OYO", "hotels", "#EE2E24"],

  ["bookmyshow", "BookMyShow", "movies", "#C4242B"],
  ["pvr", "PVR INOX", "movies", "#F4B223"],
  ["netflix", "Netflix", "streaming", "#E50914"],
  ["hotstar", "JioHotstar", "streaming", "#1F80E0"],
  ["sonyliv", "Sony LIV", "streaming", "#0B2A5B"],
  ["spotify", "Spotify", "streaming", "#1DB954"],
  ["prime-video", "Prime Video", "streaming", "#00A8E1"],
  ["youtube", "YouTube Premium", "streaming", "#FF0000"],

  ["cultfit", "cult.fit", "fitness", "#171717"],
  ["apollo-pharmacy", "Apollo Pharmacy", "pharmacy", "#00A03E"],
  ["pharmeasy", "PharmEasy", "pharmacy", "#10847E"],
  ["tata-1mg", "Tata 1mg", "pharmacy", "#FF6F61"],
  ["practo", "Practo", "doctor", "#28B4C8"],

  ["jio", "Jio", "mobile-recharge", "#0F3CC9"],
  ["airtel", "Airtel", "mobile-recharge", "#E40000"],
  ["vi", "Vi", "mobile-recharge", "#EE1C25"],
  ["act-fibernet", "ACT Fibernet", "broadband", "#F58220"],
  ["zerodha", "Zerodha", "investments", "#387ED1"],
  ["groww", "Groww", "investments", "#00D09C"],
];

/* ------------------------------------------------------------ payment apps */

const APPS: [slug: string, name: string, kind: "upi" | "card" | "netbanking" | "wallet" | "cash" | "other", color: string][] = [
  ["gpay", "Google Pay", "upi", "#4285F4"],
  ["phonepe", "PhonePe", "upi", "#5F259F"],
  ["paytm", "Paytm", "upi", "#00BAF2"],
  ["bhim", "BHIM", "upi", "#EF7F1A"],
  ["cred", "CRED", "upi", "#0E0E0E"],
  ["slice-app", "slice app", "upi", "#6C3EF5"],
  ["supermoney", "super.money", "upi", "#111827"],
  ["navi", "Navi", "upi", "#2C6EF2"],
  ["whatsapp-pay", "WhatsApp Pay", "upi", "#25D366"],
  ["amazon-pay", "Amazon Pay", "wallet", "#FF9900"],
  ["payzapp", "HDFC PayZapp", "wallet", "#004C8F"],
  ["smartbuy", "HDFC SmartBuy", "other", "#004C8F"],
  ["mobikwik", "MobiKwik", "wallet", "#2D3E92"],
  ["card-online", "Card — online checkout", "card", "#4C6EF5"],
  ["card-pos", "Card — tap or swipe", "card", "#495057"],
  ["netbanking", "Net banking", "netbanking", "#1864AB"],
  ["autopay", "Auto-debit / standing instruction", "other", "#868E96"],
  ["cash", "Cash", "cash", "#2B8A3E"],
];

/* ------------------------------------------------------------------ cards */

const HDFC_PARTNERS = [
  "amazon", "flipkart", "myntra", "swiggy", "zomato",
  "bookmyshow", "cultfit", "sonyliv", "tatacliq", "uber",
];

/** Categories that broadly never earn, reused across several issuers. */
const NO_EARN_COMMON = [
  "fuel", "rent", "taxes", "credit-card-bill", "gift-cards",
];

interface RuleSeed {
  id: string;
  name: string;
  priority?: number;
  isBase?: boolean;
  matchMerchants?: string[];
  matchCategories?: string[];
  matchApps?: string[];
  channel?: "any" | "online" | "offline" | "upi";
  rateBps?: number;
  rateType?: "percent" | "points_per_block";
  blockSizePaise?: number;
  pointsPerBlock?: number;
  minTxnPaise?: number;
  capUnits?: number | null;
  capPeriod?: "month" | "quarter" | "year" | "statement" | "none";
  capGroup?: string;
  excludeCategories?: string[];
  requiresFlag?: string;
  requiresFlagValue?: boolean;
  notes?: string;
}

interface CardSeed {
  id: string;
  name: string;
  shortName: string;
  issuer: string;
  network: "visa" | "rupay" | "mastercard" | "amex" | "diners" | "other";
  kind: "credit" | "debit" | "prepaid";
  colorFrom: string;
  colorTo: string;
  statementDay?: number;
  dueDay?: number;
  rewardUnit: string;
  unitValuePaise: number;
  rewardKind: "statement_cashback" | "points" | "wallet_balance" | "instant_cashback";
  overallCapUnits?: number | null;
  overallCapPeriod?: "month" | "quarter" | "year" | "statement" | "none";
  excludedCategories: string[];
  options?: Record<string, unknown>;
  annualFeePaise: number;
  feeWaiverSpendPaise: number;
  forexMarkupBps: number;
  perks: string[];
  sourceNote: string;
  rules: RuleSeed[];
}

export const CARDS: CardSeed[] = [
  {
    id: "card-flipkart-axis",
    name: "Flipkart Axis Bank Credit Card",
    shortName: "Flipkart Axis",
    issuer: "Axis Bank",
    network: "visa",
    kind: "credit",
    colorFrom: "#2874F0",
    colorTo: "#0B3C91",
    statementDay: 18,
    dueDay: 8,
    rewardUnit: "INR",
    unitValuePaise: 100,
    rewardKind: "statement_cashback",
    excludedCategories: [
      ...NO_EARN_COMMON, "wallet-load", "electricity", "water-gas",
      "mobile-recharge", "broadband", "dth-cable", "insurance",
      "investments", "courses", "books", "emi",
    ],
    annualFeePaise: R(500),
    feeWaiverSpendPaise: R(350000),
    forexMarkupBps: 350,
    perks: [
      "₹250 Flipkart voucher on your first transaction",
      "1% fuel surcharge waiver on ₹400–₹4,000, up to ₹400 a cycle",
      "Cashback lands as a statement credit, not points",
      "Airport lounge access was withdrawn in June 2025",
    ],
    sourceNote:
      "Rates reflect the June 2025 revision: Myntra rose to 7.5% and per-merchant quarterly caps of ₹4,000 were introduced on Flipkart, Myntra and Cleartrip.",
    rules: [],
  },

  {
    id: "card-hdfc-millennia-cc",
    name: "HDFC Bank Millennia Credit Card",
    shortName: "Millennia CC",
    issuer: "HDFC Bank",
    network: "visa",
    kind: "credit",
    colorFrom: "#1F3A93",
    colorTo: "#0B1B3F",
    statementDay: 2,
    dueDay: 22,
    rewardUnit: "CashPoints",
    unitValuePaise: 100,
    rewardKind: "points",
    excludedCategories: [
      "fuel", "rent", "taxes", "credit-card-bill", "wallet-load", "emi",
    ],
    annualFeePaise: R(1000),
    feeWaiverSpendPaise: R(100000),
    forexMarkupBps: 350,
    perks: [
      "1 CashPoint = ₹1 against your statement",
      "₹1,000 voucher on ₹1,00,000 of spend in a calendar quarter",
      "Fuel surcharge waiver on ₹400–₹5,000, up to ₹250 a cycle",
      "₹99 + GST fee applies when you redeem to statement",
    ],
    sourceNote:
      "The 5% and 1% buckets each cap at 1,000 CashPoints per calendar month, so ₹2,000 a month is the ceiling. Routing partner merchants through SmartBuy or PayZapp drops them to the base rate.",
    rules: [
      {
        id: "mcc-smartbuy-downgrade", name: "Routed via SmartBuy or PayZapp",
        priority: 200, matchApps: ["smartbuy", "payzapp"],
        rateBps: 100, capUnits: 1000, capPeriod: "month", capGroup: "mcc-base",
        notes: "HDFC excludes SmartBuy and PayZapp routing from the 5% list — it falls back to 1%.",
      },
      {
        id: "mcc-partners", name: "Ten partner brands",
        matchMerchants: HDFC_PARTNERS,
        excludeCategories: ["gift-cards"],
        rateBps: 500, capUnits: 1000, capPeriod: "month", capGroup: "mcc-accelerated",
        notes: "Amazon, BookMyShow, cult.fit, Flipkart, Myntra, Sony LIV, Swiggy, Tata CLiQ, Uber, Zomato.",
      },
      {
        id: "mcc-base", name: "Everything else", isBase: true,
        rateBps: 100, capUnits: 1000, capPeriod: "month", capGroup: "mcc-base",
        notes: "Its own 1,000 CashPoint monthly bucket, separate from the 5% one.",
      },
    ],
  },

  {
    id: "card-amazon-pay-icici",
    name: "Amazon Pay ICICI Bank Credit Card",
    shortName: "Amazon Pay ICICI",
    issuer: "ICICI Bank",
    network: "visa",
    kind: "credit",
    colorFrom: "#232F3E",
    colorTo: "#0B1015",
    statementDay: 12,
    dueDay: 2,
    rewardUnit: "INR",
    unitValuePaise: 100,
    rewardKind: "wallet_balance",
    excludedCategories: [
      ...NO_EARN_COMMON, "emi", "courses", "books", "investments",
    ],
    options: {
      flags: [
        {
          key: "primeMember",
          label: "Amazon Prime member",
          hint: "5% on Amazon with Prime, 3% without",
          default: true,
        },
      ],
    },
    annualFeePaise: 0,
    feeWaiverSpendPaise: 0,
    forexMarkupBps: 199,
    perks: [
      "Lifetime free — no joining or annual fee",
      "Cashback arrives as Amazon Pay balance, uncapped",
      "Forex markup cut to 1.99% in October 2025",
      "Three-month no-cost EMI on eligible Amazon orders",
      "Prime status is asked per expense, so a lapse never rewrites past rewards",
    ],
    sourceNote:
      "The Amazon rate depends on Prime: 5% with it, 3% without. You answer that on each expense, so a lapsed or renewed membership does not rewrite what you already earned. The card page sets which way the question is pre-filled. A 1% fee applies to Amazon Pay wallet loads of ₹5,000 or more from 15 January 2026.",
    rules: [],
  },

  {
    id: "card-slice-rupay",
    name: "slice UPI Credit Card",
    shortName: "slice UPI",
    issuer: "slice Small Finance Bank",
    network: "rupay",
    kind: "credit",
    colorFrom: "#6C3EF5",
    colorTo: "#2B1071",
    statementDay: 1,
    dueDay: 15,
    rewardUnit: "monies",
    // The MITC awards 1 money per INR 1. At the base redemption tier each
    // money is worth INR 0.01; higher tiers remain outside this estimate.
    unitValuePaise: 1,
    rewardKind: "points",
    excludedCategories: [
      "fuel", "rent", "taxes", "credit-card-bill", "wallet-load",
      "insurance", "investments", "bank-charges", "education", "courses",
      "emi",
    ],
    options: {
      rewardEstimate: "base-redemption-tier",
      higherRedemptionTiersRequireBalance: true,
      sparkOffersTrackedManually: true,
      statementDatesUserSpecific: true,
      agricultureMccNotAutomated: true,
      gamingMccNotAutomated: true,
    },
    annualFeePaise: 0,
    feeWaiverSpendPaise: 0,
    forexMarkupBps: 0,
    perks: [
      "RuPay card payments and UPI QR scans",
      "1 money per eligible INR 1 spent, including eligible UPI spends",
      "Cash redemption tiers range from 1% to 3% under the published balance conditions",
      "No joining fee, annual membership fee or bank forex markup in the current MITC",
      "Eligible INR 2,000+ spends may be sliced over 2 or 3 months; sliced spends earn no monies",
      "slice spark rotates weekly offers and is tracked manually",
    ],
    sourceNote:
      "Partial estimate using the current MITC's 1% base cash-redemption tier. The 1.5%, 2% and 3% tiers depend on monies balance, and 3% also requires the published slice savings-account quarterly balance. International and excluded-MCC spends, including Agriculture MCC 0763 and specified gaming/gambling MCCs, earn no monies; those MCCs are not mapped automatically to broad app categories. Billing-cycle and due dates are cardholder-specific. Rotating slice spark offers must be logged manually.",
    rules: [
      {
        id: "slice-base", name: "Eligible card and UPI spends", isBase: true,
        rateType: "points_per_block", blockSizePaise: 100,
        pointsPerBlock: 1, capUnits: null, capPeriod: "none",
        notes: "Awards 1 money per eligible INR 1 and values it at the published 1% base redemption tier. Higher balance-based tiers and slice spark offers are not automated.",
      },
    ],
  },

  {
    id: "card-bob-rupay-dc",
    name: "Bank of Baroda RuPay Debit Card",
    shortName: "BOB Debit",
    issuer: "Bank of Baroda",
    network: "rupay",
    kind: "debit",
    colorFrom: "#F15A22",
    colorTo: "#8C2D05",
    rewardUnit: "INR",
    unitValuePaise: 100,
    rewardKind: "instant_cashback",
    excludedCategories: [],
    annualFeePaise: R(200),
    feeWaiverSpendPaise: 0,
    forexMarkupBps: 350,
    perks: [
      "Works on UPI through any RuPay-enabled app",
      "Merchant offers run as time-limited campaigns rather than a standing rate",
    ],
    sourceNote:
      "This card has no standing points or cashback programme — value comes from rotating RuPay and Bank of Baroda merchant offers. Log those per expense as extra cashback, and it will flow into your totals.",
    rules: [],
  },

  {
    id: "card-hdfc-millennia-dc",
    name: "HDFC Bank Millennia Debit Card",
    shortName: "Millennia DC",
    issuer: "HDFC Bank",
    network: "rupay",
    kind: "debit",
    colorFrom: "#0B4F8A",
    colorTo: "#04243F",
    rewardUnit: "INR",
    unitValuePaise: 100,
    rewardKind: "instant_cashback",
    overallCapUnits: 400,
    overallCapPeriod: "month",
    excludedCategories: [
      "fuel", "credit-card-bill", "insurance", "taxes", "rent",
    ],
    annualFeePaise: R(500),
    feeWaiverSpendPaise: 0,
    forexMarkupBps: 350,
    perks: [
      "Airport lounge access after ₹5,000 of spend in the previous quarter",
      "Higher daily shopping and withdrawal limits than the standard debit card",
    ],
    sourceNote:
      "Total cashback on this card is capped at ₹400 a calendar month across every category — the per-rule caps below sit underneath that ceiling. SmartBuy runs its own ₹1,000 monthly offer on top.",
    rules: [
      {
        id: "mdc-smartbuy", name: "SmartBuy & PayZapp",
        matchApps: ["smartbuy", "payzapp"], priority: 100,
        rateBps: 500, minTxnPaise: R(400), capUnits: 1000, capPeriod: "month",
        capGroup: "mdc-smartbuy",
        notes: "5% on SmartBuy and PayZapp routing, minimum ₹400 a transaction.",
      },
      {
        id: "mdc-online", name: "Online spends", channel: "online",
        rateBps: 250, minTxnPaise: R(400), capUnits: 400, capPeriod: "month",
        capGroup: "mdc-online",
        notes: "2.5% on other online purchases.",
      },
      {
        id: "mdc-base", name: "Offline & wallet loads", isBase: true,
        rateBps: 100, minTxnPaise: R(100), capUnits: 400, capPeriod: "month",
        capGroup: "mdc-offline",
        notes: "1% on swipes and wallet reloads. Fuel earns nothing.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ apply */

export async function seedReference(db: DB) {
  const existing = await db.select().from(categories);
  if (existing.length === 0) {
    await db.insert(categories)
      .values(
        CATEGORIES.map((c, i) => ({
          id: `cat-${c.slug}`,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          colorHex: c.color,
          parentSlug: c.parent ?? null,
          requiresLabel: !!c.requiresLabel,
          isSystem: true,
          archived: false,
          sortOrder: i,
        })),
      );
  }

  if ((await db.select().from(merchants)).length === 0) {
    await db.insert(merchants)
      .values(
        MERCHANTS.map(([slug, name, categorySlug, colorHex]) => ({
          id: `mer-${slug}`, slug, name, categorySlug, colorHex, isSystem: true,
        })),
      );
  }

  if ((await db.select().from(paymentApps)).length === 0) {
    await db.insert(paymentApps)
      .values(
        APPS.map(([slug, name, kind, colorHex], i) => ({
          id: `app-${slug}`, slug, name, kind, colorHex, isSystem: true, sortOrder: i,
        })),
      );
  }

  const manualCatalogCardIds = CARDS
    .filter(
      (card) =>
        CATALOG_INSTRUMENT_IDS.has(card.id) &&
        !PARTIAL_REWARD_CARD_IDS.has(card.id),
    )
    .map((card) => card.id);
  if (manualCatalogCardIds.length) {
    await db
      .delete(rewardRules)
      .where(inArray(rewardRules.instrumentId, manualCatalogCardIds));
  }

  // Only explicitly maintained partial calculators are published for
  // catalogue cards. Manual catalogue cards must never retain stale rules.
  for (const card of CARDS) {
    const isCatalogCard = CATALOG_INSTRUMENT_IDS.has(card.id);
    const instrumentRow = {
      id: card.id,
      name: card.name,
      shortName: card.shortName,
      issuer: card.issuer,
      network: card.network,
      kind: card.kind,
      last4: "",
      colorFrom: card.colorFrom ?? "#1F2937",
      colorTo: card.colorTo ?? "#111827",
      accountId: null,
      creditLimitPaise: 0,
      statementDay: card.statementDay ?? 1,
      dueDay: card.dueDay ?? 20,
      rewardUnit: card.rewardUnit,
      unitValuePaise: card.unitValuePaise,
      rewardKind: card.rewardKind,
      overallCapUnits: card.overallCapUnits ?? null,
      overallCapPeriod: card.overallCapPeriod ?? "none",
      excludedCategories: JSON.stringify(card.excludedCategories),
      options: JSON.stringify(card.options ?? {}),
      annualFeePaise: card.annualFeePaise,
      annualFeeKnown: true,
      joiningFeeKnown: false,
      feeWaiverSpendPaise: card.feeWaiverSpendPaise,
      forexMarkupBps: card.forexMarkupBps,
      perks: JSON.stringify(card.perks),
      sourceNote: card.sourceNote,
      rewardCoverage:
        !isCatalogCard && card.rules.length
          ? ("exact" as const)
          : ("manual" as const),
      isCatalogCard,
      archived: false,
      sortOrder: CARDS.indexOf(card),
    };
    const { id: _instrumentId, ...instrumentUpdate } = instrumentRow;
    await db.insert(instruments)
      .values(instrumentRow)
      .onConflictDoUpdate({
        target: instruments.id,
        set: instrumentUpdate,
      });

    const publishRules =
      !isCatalogCard || PARTIAL_REWARD_CARD_IDS.has(card.id);
    for (const [i, rule] of (publishRules ? card.rules : []).entries()) {
      const ruleRow = {
        id: rule.id,
        instrumentId: card.id,
        name: rule.name,
        priority: rule.priority ?? 0,
        isBase: !!rule.isBase,
        matchMerchants: JSON.stringify(rule.matchMerchants ?? []),
        matchCategories: JSON.stringify(rule.matchCategories ?? []),
        matchApps: JSON.stringify(rule.matchApps ?? []),
        channel: rule.channel ?? "any",
        rateType: rule.rateType ?? "percent",
        rateBps: rule.rateBps ?? 0,
        blockSizePaise: rule.blockSizePaise ?? 10000,
        pointsPerBlock: rule.pointsPerBlock ?? 0,
        minTxnPaise: rule.minTxnPaise ?? 0,
        maxTxnPaise: null,
        capUnits: rule.capUnits ?? null,
        capPeriod: rule.capPeriod ?? "none",
        capGroup: rule.capGroup ?? rule.id,
        excludeCategories: JSON.stringify(rule.excludeCategories ?? []),
        excludeMerchants: JSON.stringify([]),
        requiresFlag: rule.requiresFlag ?? null,
        requiresFlagValue: rule.requiresFlagValue ?? true,
        validFrom: null,
        validTo: null,
        active: true,
        notes: rule.notes ?? "",
      };
      const { id: _ruleId, ...ruleUpdate } = ruleRow;
      await db.insert(rewardRules)
        .values(ruleRow)
        .onConflictDoUpdate({
          target: rewardRules.id,
          set: ruleUpdate,
        });
      void i;
    }
  }

  // Keep catalogue membership explicit. The column default is false so a
  // legacy custom/global card can never leak into another user's onboarding
  // picker.
  for (const card of CARDS) {
    const isCatalogCard = CATALOG_INSTRUMENT_IDS.has(card.id);
    await db
      .update(instruments)
      .set({
        accountId: null,
        annualFeeKnown: true,
        rewardCoverage:
          !isCatalogCard && card.rules.length ? "exact" : "manual",
        isCatalogCard,
      })
      .where(eq(instruments.id, card.id));
  }

  for (const sourceRow of CREDIT_CARD_INSTRUMENT_SEEDS) {
    const row = sourceRow;
    const { id: _id, ...projectedUpdate } = row;
    const fullUpdate: Record<string, unknown> = { ...projectedUpdate };
    // A catalogue page that does not publish a fee is "unknown", not zero.
    // Preserve a previously verified value when reseeding an existing DB.
    if (!row.annualFeeKnown) {
      delete fullUpdate.annualFeePaise;
      delete fullUpdate.annualFeeKnown;
    }
    if (!row.joiningFeeKnown) {
      delete fullUpdate.joiningFeePaise;
      delete fullUpdate.joiningFeeKnown;
    }
    await db
      .insert(instruments)
      .values(row)
      .onConflictDoUpdate({
        target: instruments.id,
        set: fullUpdate as typeof instruments.$inferInsert,
      });
  }

  await db.insert(settings)
    .values({ key: "seeded_at", value: new Date().toISOString() })
    .onConflictDoNothing();
  await db
    .insert(settings)
    .values({
      key: "credit_card_catalog_version",
      value: CREDIT_CARD_CATALOG_VERSION,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: CREDIT_CARD_CATALOG_VERSION },
    });
}
