/**
 * India consumer credit-card starter catalogue.
 *
 * This file is intentionally discovery-oriented. Reward programmes, caps,
 * exclusions, fees and application availability change frequently. Do not use
 * the summaries below as calculation rules; fetch and review the issuer's live
 * terms/MITC before making a recommendation or computing rewards.
 */

export const CREDIT_CARD_CATALOG_VERIFIED_AT = "2026-09-08" as const;

export type CreditCardAvailability =
  | "accepting-applications"
  | "listed"
  | "invite-only"
  | "secured"
  | "applications-paused";

export type CreditCardNetwork =
  | "American Express"
  | "JCB"
  | "Mastercard"
  | "RuPay"
  | "Visa";

export type CreditCardCatalogEntry = {
  id: string;
  aliases?: readonly string[];
  issuer: string;
  name: string;
  availability: CreditCardAvailability;
  networks?: readonly CreditCardNetwork[];
  fees: {
    joiningInr: number | null;
    annualInr: number | null;
    note?: string;
  };
  rewardCurrency: string;
  rewardSummary: string;
  highlights: readonly string[];
  sourceUrl: string;
  additionalSourceUrls?: readonly string[];
  verifiedAt: typeof CREDIT_CARD_CATALOG_VERIFIED_AT;
  caveats?: readonly string[];
};

export const CREDIT_CARD_CATALOG_META = {
  market: "India",
  currency: "INR",
  verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
  scope: "A broad starter set of consumer cards from issuer-owned catalogues; not an exhaustive market census.",
  limitations: [
    "Reward summaries omit some caps, exclusions, conversion values and merchant-specific conditions.",
    "A null fee means the fee was not confidently verified on the cited current issuer page; it does not mean the card is free.",
    "Acceptance, eligibility and invitation status can vary by customer, location and channel.",
    "Before publishing a recommendation or calculation, re-check the linked issuer page and the latest MITC and reward terms.",
  ],
} as const;

export const CREDIT_CARD_ISSUER_SOURCES = [
  { issuer: "HDFC Bank", url: "https://www.hdfc.bank.in/credit-cards" },
  { issuer: "ICICI Bank", url: "https://www.icici.bank.in/personal-banking/cards/credit-card" },
  { issuer: "Axis Bank", url: "https://www.axis.bank.in/cards/credit-card" },
  { issuer: "SBI Card", url: "https://www.sbicard.com/en/personal/sbi-credit-card.page" },
  { issuer: "Kotak Mahindra Bank", url: "https://www.kotak.com/en/personal-banking/cards/credit-cards.html" },
  { issuer: "IDFC FIRST Bank", url: "https://www.idfcfirstbank.com/credit-card?cardType=Select" },
  { issuer: "IndusInd Bank", url: "https://www.indusind.bank.in/in/en/personal/cards/credit-card.html" },
  { issuer: "AU Small Finance Bank", url: "https://www.au.bank.in/personal-banking/credit-cards" },
  { issuer: "YES BANK", url: "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards" },
  { issuer: "RBL Bank", url: "https://www.rbl.bank.in/personal-banking/cards/credit-cards/category" },
  { issuer: "American Express India", url: "https://www.americanexpress.com/in/credit-cards/all-cards/" },
  { issuer: "HSBC India", url: "https://www.hsbc.bank.in/credit-cards/" },
  { issuer: "Standard Chartered India", url: "https://www.sc.bank.in/credit-cards/" },
  { issuer: "BOBCARD", url: "https://www.bobcard.co.in/credit-card-types" },
  { issuer: "Federal Bank", url: "https://www.federal.bank.in/credit-cards" },
] as const;

export const CREDIT_CARD_CATALOG = [
  {
    id: "hdfc-millennia",
    aliases: ["card-hdfc-millennia-cc"],
    issuer: "HDFC Bank",
    name: "Millennia Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "CashPoints",
    rewardSummary: "5% CashPoints on selected online merchants named by HDFC Bank, plus a quarterly spend milestone voucher.",
    highlights: ["Selected online-merchant acceleration", "Quarterly milestone benefit"],
    sourceUrl: "https://www.hdfc.bank.in/credit-cards",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Merchant list, caps, exclusions and CashPoint redemption value must be read from current terms."],
  },
  {
    id: "hdfc-indianoil",
    issuer: "HDFC Bank",
    name: "IndianOil HDFC Bank Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Fuel Points",
    rewardSummary: "Fuel Points on eligible IndianOil purchases, with accelerated earning on eligible grocery and bill-payment spends.",
    highlights: ["IndianOil fuel focus", "Grocery and bill-payment acceleration"],
    sourceUrl: "https://www.hdfc.bank.in/credit-cards",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Fuel Point rates, monthly caps and eligible transaction rules apply."],
  },
  {
    id: "hdfc-tata-neu-infinity",
    issuer: "HDFC Bank",
    name: "Tata Neu Infinity HDFC Bank Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "NeuCoins",
    rewardSummary: "5% NeuCoins on eligible Tata Neu and partner-brand spends, with an additional select Tata Neu benefit after NeuPass registration and 1.5% on eligible non-UPI spends.",
    highlights: ["Tata ecosystem rewards", "1 NeuCoin is presented as INR 1 in Tata Neu"],
    sourceUrl: "https://www.hdfc.bank.in/credit-cards",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["UPI earning, NeuPass registration, caps and exclusions vary by transaction type."],
  },

  {
    id: "icici-amazon-pay",
    aliases: ["card-amazon-pay-icici"],
    issuer: "ICICI Bank",
    name: "Amazon Pay ICICI Bank Credit Card",
    availability: "invite-only",
    networks: ["Visa"],
    fees: { joiningInr: 0, annualInr: 0, note: "Issuer page states no joining or annual fee." },
    rewardCurrency: "Amazon Pay cashback",
    rewardSummary: "5% on eligible Amazon purchases for Prime members, 3% for non-Prime members, 2% on eligible Amazon Pay partner payments and 1% on other eligible spends.",
    highlights: ["No stated cashback cap", "Cashback credits to Amazon Pay balance"],
    sourceUrl: "https://www.icici.bank.in/personal-banking/cards/credit-card/amazon-pay-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Invite-only; digital-category, gift-card and other exclusions apply."],
  },
  {
    id: "icici-coral",
    issuer: "ICICI Bank",
    name: "ICICI Bank Coral Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 500, annualInr: 500, note: "Taxes extra; annual-fee waiver conditions apply." },
    rewardCurrency: "ICICI Bank Reward Points",
    rewardSummary: "Reward Points on eligible spending, supplemented by issuer-listed movie, fuel-surcharge and lounge benefits.",
    highlights: ["Movie offer", "Domestic lounge access subject to spend threshold"],
    sourceUrl: "https://www.icici.bank.in/personal-banking/cards/credit-card/coral-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["The current reward rate and lounge threshold should be read from the live terms before calculation."],
  },
  {
    id: "icici-sapphiro",
    issuer: "ICICI Bank",
    name: "ICICI Bank Sapphiro Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 6500, annualInr: 3500, note: "Taxes extra; waiver and variant conditions may apply." },
    rewardCurrency: "ICICI Bank Reward Points",
    rewardSummary: "Premium Reward Points programme with issuer-listed welcome, movie and domestic/international lounge benefits.",
    highlights: ["Premium welcome benefits", "Domestic and international lounge access"],
    sourceUrl: "https://www.icici.bank.in/personal-banking/cards/credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Benefits can differ between single-network and dual-card variants."],
  },

  {
    id: "axis-select",
    issuer: "Axis Bank",
    name: "Axis Bank SELECT Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 3000, annualInr: 3000, note: "Taxes extra; waiver or customer-segment offers may apply." },
    rewardCurrency: "EDGE REWARD Points",
    rewardSummary: "10 EDGE REWARD Points per eligible INR 200 base spend, with issuer-listed accelerated retail-shopping rewards.",
    highlights: ["Retail-shopping acceleration", "Dining, grocery, movie and lounge benefits"],
    sourceUrl: "https://www.axis.bank.in/cards/credit-card/axis-bank-select-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Excluded categories, caps and point redemption values apply."],
  },
  {
    id: "axis-indianoil",
    issuer: "Axis Bank",
    name: "IndianOil Axis Bank Credit Card",
    availability: "accepting-applications",
    networks: ["RuPay"],
    fees: { joiningInr: 500, annualInr: 500, note: "Taxes extra; current waiver conditions may apply." },
    rewardCurrency: "EDGE REWARD Points",
    rewardSummary: "Issuer advertises 4% value back on eligible IndianOil fuel purchases, plus rewards on other eligible spends.",
    highlights: ["IndianOil fuel focus", "RuPay UPI support"],
    sourceUrl: "https://www.axis.bank.in/cards/credit-card/indianoil-axis-bank-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Fuel benefits are subject to eligible outlets, transaction bands and caps."],
  },
  {
    id: "axis-airtel",
    issuer: "Axis Bank",
    name: "Airtel Axis Bank Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Cashback",
    rewardSummary: "25% cashback on eligible Airtel payments in the Airtel Thanks app, 10% on eligible utility payments there, 10% on selected food/grocery partners and 1% on other eligible spends.",
    highlights: ["Airtel bill acceleration", "Utility and selected food/grocery cashback"],
    sourceUrl: "https://www.axis.bank.in/cards/credit-card/airtel-axis-bank-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Each accelerated category has a monthly cap; exclusions and channel rules apply."],
  },

  {
    id: "axis-flipkart",
    aliases: ["card-flipkart-axis"],
    issuer: "Axis Bank",
    name: "Flipkart Axis Bank Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 0, annualInr: 500, note: "The issuer currently presents it as first-year free; taxes and renewal terms apply." },
    rewardCurrency: "Cashback",
    rewardSummary: "Cashback on eligible Myntra, Flipkart and Cleartrip purchases, plus cashback with selected partner merchants.",
    highlights: ["Flipkart-group shopping focus", "Selected travel and lifestyle partner cashback"],
    sourceUrl: "https://www.axis.bank.in/cards/credit-card/shopping-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Current cashback rates, partner list, caps and exclusions must be read from the live terms."],
  },

  {
    id: "sbi-cashback",
    issuer: "SBI Card",
    name: "CASHBACK SBI Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Cashback",
    rewardSummary: "5% cashback on eligible online spends and 1% on eligible offline spends, automatically credited to the card account.",
    highlights: ["Online cashback", "Automatic statement credit"],
    sourceUrl: "https://www.sbicard.com/en/personal/sbi-credit-card.page",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["A monthly cashback cap and excluded merchant categories apply."],
  },
  {
    id: "sbi-simplyclick",
    issuer: "SBI Card",
    name: "SimplyCLICK SBI Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: 499, note: "Taxes extra; current joining fee and waiver terms must be confirmed." },
    rewardCurrency: "Reward Points",
    rewardSummary: "5X rewards on eligible online purchases and 10X with selected partners, plus online-spend milestone vouchers.",
    highlights: ["Online-spend acceleration", "Annual online-spend milestones"],
    sourceUrl: "https://www.sbicard.com/en/personal/sbi-credit-card.page",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Partner list, milestone thresholds, exclusions and point value can change."],
  },
  {
    id: "sbi-tata-neu-infinity",
    issuer: "SBI Card",
    name: "Tata Neu Infinity SBI Card",
    availability: "accepting-applications",
    networks: ["RuPay"],
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "NeuCoins",
    rewardSummary: "5% NeuCoins on eligible Tata-brand spends and 1.5% on eligible non-Tata and RuPay UPI spends.",
    highlights: ["Tata ecosystem rewards", "RuPay UPI earning"],
    sourceUrl: "https://www.sbicard.com/en/personal/sbi-credit-card.page",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["UPI caps, excluded categories and Tata Neu redemption conditions apply."],
  },

  {
    id: "kotak-cashback-plus",
    issuer: "Kotak Mahindra Bank",
    name: "Kotak Cashback+ Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 0, annualInr: 750, note: "Taxes extra; waiver conditions may apply." },
    rewardCurrency: "Cashback",
    rewardSummary: "5% cashback on eligible online food-delivery, grocery and entertainment spends, 3% on eligible fuel and 0.5% on other eligible spends.",
    highlights: ["Everyday-category cashback", "Fuel cashback"],
    sourceUrl: "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Category caps, minimum transaction values and exclusions apply."],
  },
  {
    id: "kotak-indianoil",
    issuer: "Kotak Mahindra Bank",
    name: "IndianOil Kotak Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 449, annualInr: 449, note: "Taxes extra; annual-fee waiver conditions apply." },
    rewardCurrency: "Reward Points",
    rewardSummary: "Issuer advertises 5% rewards on eligible IndianOil fuel spends and 2% on eligible grocery and dining spends.",
    highlights: ["IndianOil fuel rewards", "Grocery and dining rewards"],
    sourceUrl: "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Fuel transaction bands, caps, participating outlets and exclusions apply."],
  },
  {
    id: "kotak-upi-rupay",
    issuer: "Kotak Mahindra Bank",
    name: "Kotak UPI RuPay Credit Card",
    availability: "accepting-applications",
    networks: ["RuPay"],
    fees: { joiningInr: 0, annualInr: 0, note: "Issuer catalogue presents the virtual card as lifetime free." },
    rewardCurrency: "Reward Points",
    rewardSummary: "3 Reward Points per eligible INR 100 spend, with RuPay UPI payment support.",
    highlights: ["Virtual card", "RuPay UPI support"],
    sourceUrl: "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["UPI eligibility, exclusions and point redemption value apply."],
  },

  {
    id: "idfc-first-millennia",
    issuer: "IDFC FIRST Bank",
    name: "FIRST Millennia Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 0, annualInr: 0, note: "Issuer presents the card as lifetime free." },
    rewardCurrency: "Reward Points",
    rewardSummary: "Up to 10X Reward Points on eligible spend tiers, with issuer-listed welcome and movie benefits.",
    highlights: ["Lifetime-free positioning", "Tiered rewards"],
    sourceUrl: "https://www.idfcfirstbank.com/credit-card?cardType=Select",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Base/accelerated tiers, excluded categories and point value must be checked in current terms."],
  },
  {
    id: "idfc-first-wow",
    issuer: "IDFC FIRST Bank",
    name: "FIRST WOW! Credit Card",
    availability: "secured",
    fees: { joiningInr: 0, annualInr: 0, note: "Issuer presents the card as lifetime free; fixed deposit is required." },
    rewardCurrency: "Reward Points",
    rewardSummary: "Up to 4X Reward Points on eligible spends, paired with zero-forex-markup positioning.",
    highlights: ["Fixed-deposit-backed card", "Zero forex markup"],
    sourceUrl: "https://www.idfcfirstbank.com/credit-card?cardType=Select",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Credit limit and issuance depend on the required fixed deposit and issuer eligibility rules."],
  },
  {
    id: "idfc-first-wealth",
    issuer: "IDFC FIRST Bank",
    name: "FIRST Wealth Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 0, annualInr: 0, note: "Issuer presents the card as lifetime free." },
    rewardCurrency: "Reward Points",
    rewardSummary: "Up to 10X Reward Points with a premium travel and lifestyle benefit set.",
    highlights: ["1.5% forex markup", "Domestic and international lounge benefits"],
    sourceUrl: "https://www.idfcfirstbank.com/credit-card?cardType=Select",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Spend tiers and lounge-use conditions apply."],
  },

  {
    id: "indusind-platinum-rupay",
    issuer: "IndusInd Bank",
    name: "IndusInd Bank Platinum RuPay Credit Card",
    availability: "accepting-applications",
    networks: ["RuPay"],
    fees: { joiningInr: 0, annualInr: 0, note: "Issuer page presents the card as lifetime free." },
    rewardCurrency: "Reward Points",
    rewardSummary: "2 Reward Points per eligible INR 100 UPI spend, with rewards on eligible non-UPI spends.",
    highlights: ["RuPay UPI rewards", "Fuel-surcharge waiver"],
    sourceUrl: "https://www.indusind.bank.in/in/en/personal/cards/credit-card.html",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["UPI caps, excluded categories and reward conversion values apply."],
  },
  {
    id: "indusind-legend",
    issuer: "IndusInd Bank",
    name: "IndusInd Bank Legend Credit Card",
    availability: "accepting-applications",
    networks: ["Visa"],
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Reward Points",
    rewardSummary: "1 Reward Point per eligible INR 100 weekday spend and 2 Reward Points per eligible INR 100 weekend spend.",
    highlights: ["Weekend reward acceleration", "Issuer-listed travel and lifestyle benefits"],
    sourceUrl: "https://www.indusind.bank.in/in/en/personal/cards/credit-card.html",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["The issuer catalogue states a 1.8% forex markup; taxes and category exclusions apply."],
  },
  {
    id: "indusind-eazydiner-platinum",
    issuer: "IndusInd Bank",
    name: "EazyDiner IndusInd Bank Platinum Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Dining discounts and Reward Points",
    rewardSummary: "Dining-led card with an EazyDiner Prime benefit and an additional eligible EazyDiner discount, alongside card rewards.",
    highlights: ["EazyDiner Prime membership benefit", "Dining discount"],
    sourceUrl: "https://www.indusind.bank.in/in/en/personal/cards/credit-card.html",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Discount caps, monthly usage limits, restaurant eligibility and renewal conditions apply."],
  },

  {
    id: "au-spont",
    issuer: "AU Small Finance Bank",
    name: "AU SPONT Credit Card",
    availability: "listed",
    fees: { joiningInr: null, annualInr: 299, note: "Taxes extra; confirm the latest fee schedule and waiver terms." },
    rewardCurrency: "Cashback and AU Coins",
    rewardSummary: "1% cashback on eligible card transactions, with issuer-listed AU Coin earning for eligible UPI activity.",
    highlights: ["Simple cashback positioning", "UPI-linked benefits"],
    sourceUrl: "https://www.au.bank.in/personal-banking/credit-cards",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Cashback/coin caps, eligible categories and redemption rules apply."],
  },
  {
    id: "au-ixigo",
    issuer: "AU Small Finance Bank",
    name: "ixigo AU Credit Card",
    availability: "listed",
    fees: { joiningInr: null, annualInr: 999, note: "Issuer fee table lists conditional first-year and renewal waivers." },
    rewardCurrency: "Reward Points and ixigo benefits",
    rewardSummary: "Travel-focused rewards and ixigo benefits, paired with zero-forex-markup positioning.",
    highlights: ["Zero forex markup", "Travel-partner benefits"],
    sourceUrl: "https://www.au.bank.in/personal-banking/credit-cards",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Travel discounts, reward rates, fee waivers and exclusions require current-term review."],
  },
  {
    id: "au-zenith-plus",
    issuer: "AU Small Finance Bank",
    name: "AU Zenith+ Credit Card",
    availability: "listed",
    fees: { joiningInr: null, annualInr: 4999, note: "Taxes extra; confirm current joining and renewal-waiver terms." },
    rewardCurrency: "Reward Points",
    rewardSummary: "Premium reward programme with issuer-listed travel, lounge and milestone benefits.",
    highlights: ["0.99% forex markup", "Premium travel and lounge positioning"],
    sourceUrl: "https://www.au.bank.in/personal-banking/credit-cards",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Reward rates, lounge quotas, milestone thresholds and fee waivers apply."],
  },

  {
    id: "yes-marquee",
    issuer: "YES BANK",
    name: "YES BANK MARQUEE Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 9999, annualInr: 4999, note: "Taxes extra; current waiver conditions apply." },
    rewardCurrency: "YES Rewardz Points",
    rewardSummary: "Premium YES Rewardz programme with issuer-listed welcome, movie and domestic/international lounge benefits.",
    highlights: ["1% forex markup", "Premium lounge programme"],
    sourceUrl: "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Reward rates, lounge quotas, welcome-spend conditions and exclusions apply."],
  },
  {
    id: "yes-reserv",
    issuer: "YES BANK",
    name: "YES BANK RESERV Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 2499, annualInr: 2499, note: "Taxes extra; waiver conditions apply." },
    rewardCurrency: "YES Rewardz Points",
    rewardSummary: "24 YES Rewardz Points per eligible INR 200 online spend, 12 per eligible INR 200 offline spend and a lower rate on selected categories.",
    highlights: ["Online-spend acceleration", "Travel and lifestyle benefits"],
    sourceUrl: "https://www.yes.bank.in/personal-banking/cards/credit-card/reserv-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["The issuer changed selected-category earning and exclusions effective 15 June 2026."],
  },
  {
    id: "yes-ace",
    issuer: "YES BANK",
    name: "YES BANK ACE Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 499, annualInr: 499, note: "Taxes extra; issuer lists conditional joining/renewal waivers." },
    rewardCurrency: "YES Rewardz Points",
    rewardSummary: "8 YES Rewardz Points per eligible INR 200 online spend, 4 per eligible INR 200 offline spend and a lower rate on selected categories.",
    highlights: ["Online-spend acceleration", "Entry-level fee with waiver paths"],
    sourceUrl: "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards/ace-credit-card",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["The issuer changed selected-category earning and exclusions effective 15 June 2026."],
  },

  {
    id: "rbl-apex",
    issuer: "RBL Bank",
    name: "Apex Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Cashback",
    rewardSummary: "2% cashback on eligible flight, hotel, shopping and voucher purchases, with 1% on other eligible spends.",
    highlights: ["Travel and shopping cashback", "Issuer-listed milestone benefit"],
    sourceUrl: "https://www.rbl.bank.in/personal-banking/cards/credit-cards/category",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Eligible channels, caps, exclusions and milestone conditions apply."],
  },
  {
    id: "rbl-world-safari",
    issuer: "RBL Bank",
    name: "World Safari Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Travel rewards",
    rewardSummary: "Travel-focused rewards and benefits with issuer-listed zero forex markup.",
    highlights: ["Zero forex markup", "Domestic and international lounge benefits"],
    sourceUrl: "https://www.rbl.bank.in/personal-banking/cards/credit-cards/category",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Insurance, lounge-use and reward-earning conditions apply."],
  },
  {
    id: "rbl-cookies",
    issuer: "RBL Bank",
    name: "Cookies Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Cashback and Reward Points",
    rewardSummary: "10% cashback on selected favourite brands subject to per-brand monthly caps, plus accelerated rewards on eligible online spends.",
    highlights: ["Favourite-brand cashback", "Online-spend acceleration"],
    sourceUrl: "https://www.rbl.bank.in/personal-banking/cards/credit-cards/category",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Brand selection, caps, eligible transactions and reward conversion rules apply."],
  },

  {
    id: "amex-smartearn",
    issuer: "American Express India",
    name: "American Express SmartEarn Credit Card",
    availability: "applications-paused",
    networks: ["American Express"],
    fees: { joiningInr: 495, annualInr: 495, note: "Taxes extra; waiver conditions may apply." },
    rewardCurrency: "Membership Rewards Points",
    rewardSummary: "Membership Rewards Points with accelerated earning on selected partner brands.",
    highlights: ["Selected-partner acceleration", "Entry-level American Express product"],
    sourceUrl: "https://www.americanexpress.com/in/credit-cards/all-cards/",
    additionalSourceUrls: ["https://www.americanexpress.com/in/credit-know-how/credit-card-fees/"],
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["American Express states that new card applications in India are temporarily paused."],
  },
  {
    id: "amex-membership-rewards",
    issuer: "American Express India",
    name: "American Express Membership Rewards Credit Card",
    availability: "applications-paused",
    networks: ["American Express"],
    fees: { joiningInr: 1000, annualInr: 4500, note: "Taxes extra; waiver conditions may apply." },
    rewardCurrency: "Membership Rewards Points",
    rewardSummary: "Membership Rewards Points with issuer-listed monthly spend and transaction-count bonus opportunities.",
    highlights: ["Monthly reward milestones", "Membership Rewards transfer/redemption ecosystem"],
    sourceUrl: "https://www.americanexpress.com/in/credit-cards/all-cards/",
    additionalSourceUrls: ["https://www.americanexpress.com/in/credit-know-how/credit-card-fees/"],
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["American Express states that new card applications in India are temporarily paused."],
  },
  {
    id: "amex-platinum-travel",
    issuer: "American Express India",
    name: "American Express Platinum Travel Credit Card",
    availability: "applications-paused",
    networks: ["American Express"],
    fees: { joiningInr: 5000, annualInr: 5000, note: "Taxes extra; waiver conditions may apply." },
    rewardCurrency: "Membership Rewards Points",
    rewardSummary: "Travel-oriented Membership Rewards programme with issuer-listed annual-spend milestones and lounge benefits.",
    highlights: ["Annual-spend milestone rewards", "Travel and lounge benefits"],
    sourceUrl: "https://www.americanexpress.com/in/credit-cards/all-cards/",
    additionalSourceUrls: ["https://www.americanexpress.com/in/credit-know-how/credit-card-fees/"],
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["American Express states that new card applications in India are temporarily paused."],
  },

  {
    id: "hsbc-live-plus",
    issuer: "HSBC India",
    name: "HSBC Live+ Credit Card",
    availability: "accepting-applications",
    networks: ["Visa"],
    fees: { joiningInr: 999, annualInr: 999, note: "Taxes extra; issuer lists an annual-spend waiver." },
    rewardCurrency: "Cashback",
    rewardSummary: "10% cashback on eligible dining, food-delivery and grocery spends within a combined monthly cap, and 1.5% on most other eligible spends.",
    highlights: ["Dining and grocery cashback", "Visa Infinite benefits listed by issuer"],
    sourceUrl: "https://www.hsbc.bank.in/credit-cards/products/live-plus/",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Accelerated cashback has a combined monthly cap and category exclusions."],
  },
  {
    id: "hsbc-travelone",
    issuer: "HSBC India",
    name: "HSBC TravelOne Credit Card",
    availability: "accepting-applications",
    networks: ["Mastercard"],
    fees: { joiningInr: 4999, annualInr: 4999, note: "Taxes extra; issuer lists an annual-spend waiver." },
    rewardCurrency: "Reward Points",
    rewardSummary: "4 Reward Points per eligible INR 100 on airline, travel-aggregator and foreign-currency spends, and 2 per eligible INR 100 on other spends.",
    highlights: ["1:1 transfer positioning with selected partners", "Domestic and international lounge benefits"],
    sourceUrl: "https://www.hsbc.bank.in/credit-cards/products/travelone/",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Merchant coding, transfer partners, exclusions and lounge quotas apply."],
  },
  {
    id: "hsbc-rupay-cashback",
    issuer: "HSBC India",
    name: "HSBC RuPay Cashback Credit Card",
    availability: "accepting-applications",
    networks: ["RuPay", "JCB"],
    fees: { joiningInr: 499, annualInr: 499, note: "Taxes extra; issuer lists an annual-spend waiver." },
    rewardCurrency: "Cashback",
    rewardSummary: "10% cashback on eligible dining, food-delivery and grocery spends and 1% on other eligible spends, subject to the issuer's monthly cap.",
    highlights: ["RuPay UPI support", "RuPay-JCB international acceptance positioning"],
    sourceUrl: "https://www.hsbc.bank.in/credit-cards/products/rupay-cashback-credit-card/",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Cashback is capped; a zero-forex promotion shown in older material ended before this verification date."],
  },

  {
    id: "sc-rewards",
    issuer: "Standard Chartered India",
    name: "Standard Chartered Rewards Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: 0, annualInr: null, note: "Issuer page states no joining fee; confirm renewal fee and waiver terms." },
    rewardCurrency: "Reward Points",
    rewardSummary: "4 Reward Points per eligible INR 150 retail spend, with an additional 4 points per INR 150 after meeting the issuer's monthly spend threshold.",
    highlights: ["Monthly-spend reward acceleration", "Quarterly domestic lounge benefit"],
    sourceUrl: "https://www.sc.bank.in/credit-cards/",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Threshold, eligible retail definition, lounge conditions and point value apply."],
  },
  {
    id: "sc-smart",
    issuer: "Standard Chartered India",
    name: "Standard Chartered Smart Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Cashback",
    rewardSummary: "2% cashback on eligible online spends and 1% on other eligible spends.",
    highlights: ["Online cashback", "Straightforward cashback structure"],
    sourceUrl: "https://www.sc.bank.in/credit-cards/",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Monthly caps, excluded categories, minimum statement credit rules and fees apply."],
  },
  {
    id: "sc-easemytrip",
    issuer: "Standard Chartered India",
    name: "Standard Chartered EaseMyTrip Credit Card",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Reward Points and travel discounts",
    rewardSummary: "Issuer-listed EaseMyTrip hotel and flight discounts, plus accelerated rewards on eligible standalone airline and hotel spends.",
    highlights: ["EaseMyTrip travel discounts", "Domestic lounge benefit"],
    sourceUrl: "https://www.sc.bank.in/credit-cards/",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["Coupon availability, booking caps, eligible channels and reward exclusions apply."],
  },

  {
    id: "bobcard-cashback",
    issuer: "BOBCARD",
    name: "BOBCARD Cashback",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Cashback",
    rewardSummary: "5% cashback on eligible online spends and 1% on other eligible spends, automatically credited monthly.",
    highlights: ["Online cashback", "Automatic monthly credit"],
    sourceUrl: "https://www.bobcard.co.in/credit-card-types/bobcard-cashback",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["BOBCARD revised several product features and charges in July 2026; check the latest product terms and MITC."],
  },
  {
    id: "bobcard-select",
    issuer: "BOBCARD",
    name: "BOBCARD SELECT",
    availability: "accepting-applications",
    fees: { joiningInr: 0, annualInr: 750, note: "Annual fee applies from year two; issuer lists a spend-based waiver." },
    rewardCurrency: "Reward Points",
    rewardSummary: "5X Reward Points on eligible online and dining spends, with 1 Reward Point per eligible INR 100 base spend.",
    highlights: ["Online and dining acceleration", "Spend-based annual-fee waiver"],
    sourceUrl: "https://www.bobcard.co.in/credit-card-types/select",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["The cited page states terms effective 1 September 2026; exclusions, caps and point value apply."],
  },
  {
    id: "bobcard-snapdeal",
    issuer: "BOBCARD",
    name: "Snapdeal BOBCARD",
    availability: "accepting-applications",
    fees: { joiningInr: null, annualInr: null },
    rewardCurrency: "Cashback and Reward Points",
    rewardSummary: "Issuer advertises 5% cashback on eligible Snapdeal purchases, welcome shopping vouchers and rewards on other eligible spends.",
    highlights: ["Snapdeal cashback", "Welcome voucher benefit"],
    sourceUrl: "https://www.bobcard.co.in/credit-card-types/snapdeal-bobcard",
    verifiedAt: CREDIT_CARD_CATALOG_VERIFIED_AT,
    caveats: ["BOBCARD revised several product features and charges in July 2026; check the latest product terms and MITC."],
  },
] as const satisfies readonly CreditCardCatalogEntry[];


export type CreditCardCatalogCategory =
  | "cashback"
  | "co-branded"
  | "dining"
  | "fuel"
  | "premium"
  | "rewards"
  | "secured"
  | "travel"
  | "upi";

export type CreditCardRewardCoverage = "headline-summary";

export type CreditCardSeedAvailability =
  | "active"
  | "invite_only"
  | "secured"
  | "applications_paused"
  | "discontinued";

const CREDIT_CARD_CATEGORY_BY_ID = {
  "hdfc-millennia": "cashback",
  "hdfc-indianoil": "fuel",
  "hdfc-tata-neu-infinity": "co-branded",
  "icici-amazon-pay": "co-branded",
  "icici-coral": "rewards",
  "icici-sapphiro": "premium",
  "axis-select": "premium",
  "axis-indianoil": "fuel",
  "axis-airtel": "co-branded",
  "axis-flipkart": "co-branded",
  "sbi-cashback": "cashback",
  "sbi-simplyclick": "rewards",
  "sbi-tata-neu-infinity": "co-branded",
  "kotak-cashback-plus": "cashback",
  "kotak-indianoil": "fuel",
  "kotak-upi-rupay": "upi",
  "idfc-first-millennia": "rewards",
  "idfc-first-wow": "secured",
  "idfc-first-wealth": "premium",
  "indusind-platinum-rupay": "upi",
  "indusind-legend": "premium",
  "indusind-eazydiner-platinum": "dining",
  "au-spont": "cashback",
  "au-ixigo": "travel",
  "au-zenith-plus": "premium",
  "yes-marquee": "premium",
  "yes-reserv": "premium",
  "yes-ace": "rewards",
  "rbl-apex": "cashback",
  "rbl-world-safari": "travel",
  "rbl-cookies": "cashback",
  "amex-smartearn": "rewards",
  "amex-membership-rewards": "rewards",
  "amex-platinum-travel": "travel",
  "hsbc-live-plus": "cashback",
  "hsbc-travelone": "travel",
  "hsbc-rupay-cashback": "upi",
  "sc-rewards": "rewards",
  "sc-smart": "cashback",
  "sc-easemytrip": "travel",
  "bobcard-cashback": "cashback",
  "bobcard-select": "rewards",
  "bobcard-snapdeal": "co-branded",
} as const satisfies Record<
  (typeof CREDIT_CARD_CATALOG)[number]["id"],
  CreditCardCatalogCategory
>;

const CREDIT_CARD_ALIASES_BY_ID: Partial<
  Record<(typeof CREDIT_CARD_CATALOG)[number]["id"], readonly string[]>
> = {
  "hdfc-millennia": ["card-hdfc-millennia-cc"],
  "icici-amazon-pay": ["card-amazon-pay-icici"],
  "axis-flipkart": ["card-flipkart-axis"],
};

const CREDIT_CARD_SEED_AVAILABILITY = {
  "accepting-applications": "active",
  listed: "active",
  "invite-only": "invite_only",
  secured: "secured",
  "applications-paused": "applications_paused",
} as const satisfies Record<CreditCardAvailability, CreditCardSeedAvailability>;

/**
 * Seed-friendly projection with stable field names.
 * Reward coverage is intentionally a discovery headline, not a complete or
 * machine-calculable reward rule.
 */
export type CreditCardStarterCatalogEntry = {
  id: string;
  aliases: readonly string[];
  issuer: string;
  name: string;
  catalogCategory: CreditCardCatalogCategory;
  summary: string;
  officialUrl: string;
  verifiedAt: typeof CREDIT_CARD_CATALOG_VERIFIED_AT;
  availability: CreditCardSeedAvailability;
  rewardCoverage: CreditCardRewardCoverage;
};

export const CREDIT_CARD_STARTER_CATALOG: readonly CreditCardStarterCatalogEntry[] =
  CREDIT_CARD_CATALOG.map((card) => ({
    id: card.id,
    aliases: CREDIT_CARD_ALIASES_BY_ID[card.id] ?? [],
    issuer: card.issuer,
    name: card.name,
    catalogCategory: CREDIT_CARD_CATEGORY_BY_ID[card.id],
    summary: card.rewardSummary,
    officialUrl: card.sourceUrl,
    verifiedAt: card.verifiedAt,
    availability: CREDIT_CARD_SEED_AVAILABILITY[card.availability],
    rewardCoverage: "headline-summary",
  }));
