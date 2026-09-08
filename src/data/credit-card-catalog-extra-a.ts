/**
 * Officially listed consumer-card names which do not yet have a fully
 * structured benefit record. They remain selectable, but reward automation is
 * deliberately disabled until the product-level T&C is encoded.
 */
export interface CreditCardCatalogExtension {
  id: string;
  issuer: string;
  name: string;
  officialUrl: string;
  availability: "active" | "invite_only" | "secured" | "applications_paused" | "discontinued";
  category: string;
}

function slug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\+/g, " plus ")
    .replace(/[^a-zA-Z0-9& ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function category(name: string) {
  if (/fuel|petrol|indianoil|hpcl|bpcl|jio-bp/i.test(name)) return "fuel";
  if (/cashback|cash back/i.test(name)) return "cashback";
  if (/upi|rupay|phonepe|paytm|google pay/i.test(name)) return "upi";
  if (/travel|miles|air|indigo|vistara|spicejet|irctc|marriott|emirates|krisflyer|ixigo/i.test(name))
    return "travel";
  if (/private|premium|infinia|black|emeralde|sapphiro|magnus|reserve|wealth|zenith|mayura|ashva/i.test(name))
    return "premium";
  return "rewards";
}

function group(
  issuer: string,
  officialUrl: string,
  active: readonly string[],
  options: {
    invite?: readonly string[];
    secured?: readonly string[];
    discontinued?: readonly string[];
  } = {},
) {
  const rows: CreditCardCatalogExtension[] = [];
  const add = (
    names: readonly string[],
    availability: CreditCardCatalogExtension["availability"],
  ) => {
    for (const name of names) {
      rows.push({
        id: `extended-${slug(issuer)}-${slug(name)}`,
        issuer,
        name,
        officialUrl,
        availability,
        category: category(name),
      });
    }
  };
  add(active, "active");
  add(options.invite ?? [], "invite_only");
  add(options.secured ?? [], "secured");
  add(options.discontinued ?? [], "discontinued");
  return rows;
}

export const CREDIT_CARD_CATALOG_EXTRA_A: readonly CreditCardCatalogExtension[] = [
  ...group(
    "HDFC Bank",
    "https://www.hdfc.bank.in/credit-cards",
    [
      "HDFC Bank Millennia Credit Card", "HDFC Bank MoneyBack+ Credit Card",
      "HDFC Bank Freedom Credit Card", "PhonePe HDFC Bank Uno Credit Card",
      "PhonePe HDFC Bank Ultimo Credit Card", "HDFC Bank Diners Club Black Metal Edition Credit Card",
      "HDFC Bank PIXEL Play Credit Card", "HDFC Bank PIXEL Go Credit Card",
      "HDFC Bank UPI RuPay Credit Card", "HDFC Bank Regalia Gold Credit Card",
      "HDFC Bank Diners Club Privilege Credit Card", "Tata Neu Infinity HDFC Bank Credit Card",
      "Tata Neu Plus HDFC Bank Credit Card", "Swiggy HDFC Bank Credit Card",
      "Swiggy Ornge HDFC Bank Credit Card", "Swiggy BLCK HDFC Bank Credit Card",
      "Marriott Bonvoy HDFC Bank Credit Card", "IndianOil HDFC Bank Credit Card",
      "IRCTC HDFC Bank Credit Card",
    ],
    { invite: ["HDFC Bank INFINIA Metal Edition Credit Card"] },
  ),
  ...group(
    "Axis Bank",
    "https://www.axis.bank.in/cards/credit-card",
    [
      "Axis Bank Privilege Credit Card", "Axis Bank Neo Credit Card",
      "Flipkart Axis Bank Credit Card", "IndiGo Axis Bank Premium Credit Card",
      "Axis Bank MY ZONE Credit Card", "Axis Bank ACE Credit Card",
      "IndianOil Axis Bank Credit Card", "Axis Bank Rewards Credit Card",
      "Google Pay Flex Axis Bank Credit Card", "Airtel Axis Bank Credit Card",
      "Axis Bank HORIZON Credit Card", "Axis Bank SELECT Credit Card",
      "Axis Bank Cashback Credit Card", "Axis Bank Magnus Credit Card",
      "Axis Bank Reserve Credit Card", "Axis Bank MY ZONE Easy Credit Card",
      "IndianOil Axis Bank Easy Credit Card", "Axis Bank Privilege Easy Credit Card",
      "Axis Bank Atlas Credit Card", "Axis Bank AURA Credit Card",
      "IndianOil Axis Bank Premium Credit Card", "Axis Bank Pride Platinum Credit Card",
      "Axis Bank Pride Signature Credit Card", "SpiceJet Axis Bank Voyage Black Credit Card",
      "Fibe Axis Bank Credit Card", "Shoppers Stop Axis Bank Credit Card",
      "SpiceJet Axis Bank Voyage Credit Card", "Samsung Axis Bank Signature Credit Card",
      "Miles & More Axis Bank Credit Card", "LIC Axis Bank Signature Credit Card",
      "LIC Axis Bank Platinum Credit Card",
    ],
    {
      discontinued: [
        "Flipkart Axis Bank Super Elite Credit Card", "Samsung Axis Bank Infinite Credit Card",
        "Freecharge Axis Bank Credit Card", "Freecharge Plus Axis Bank Credit Card",
        "Vistara Axis Bank Signature Credit Card", "Vistara Axis Bank Credit Card",
        "Vistara Axis Bank Infinite Credit Card", "Kwik Axis Bank Credit Card",
      ],
    },
  ),
  ...group(
    "ICICI Bank",
    "https://www.icici.bank.in/personal-banking/cards/credit-card",
    [
      "Times Black ICICI Bank Credit Card", "ICICI Bank Emeralde Credit Card",
      "ICICI Bank Sapphiro Credit Card", "ICICI Bank Rubyx Credit Card",
      "ICICI Bank Coral Credit Card", "ICICI Bank Platinum Chip Credit Card",
      "Adani One ICICI Bank Signature Credit Card", "Adani One ICICI Bank Platinum Credit Card",
      "MakeMyTrip ICICI Bank Credit Card", "Emirates ICICI Bank Emeralde Credit Card",
      "Emirates ICICI Bank Sapphiro Credit Card", "HPCL Super Saver ICICI Bank Credit Card",
      "HPCL ICICI Bank Coral Credit Card", "ICICI Bank Expressions Credit Card",
      "Amazon Pay ICICI Bank Credit Card",
    ],
    {
      invite: ["ICICI Bank Emeralde Private Metal Credit Card"],
      discontinued: [
        "Emirates Skywards ICICI Bank Rubyx Credit Card",
        "MakeMyTrip ICICI Bank Signature Credit Card",
        "MakeMyTrip ICICI Bank Platinum Credit Card",
        "Chennai Super Kings ICICI Bank Credit Card",
        "ICICI Bank Parakram Select Credit Card", "ICICI Bank Parakram Credit Card",
      ],
    },
  ),
  ...group(
    "SBI Card",
    "https://www.sbicard.com/en/personal/sbi-credit-card.page",
    [
      "IndiGo SBI Card", "IndiGo SBI Card ELITE", "Flipkart SBI Card",
      "Apollo SBI Card SELECT", "Tata Neu Infinity SBI Card", "Tata Neu Plus SBI Card",
      "KrisFlyer SBI Card", "KrisFlyer SBI Card Apex", "SBI Card Miles Elite",
      "SBI Card MILES PRIME", "SBI Card MILES", "Titan SBI Card",
      "Reliance SBI Card", "Reliance SBI Card PRIME", "SBI Card PULSE",
      "CASHBACK SBI Card", "SimplyCLICK SBI Card", "BPCL SBI Card",
      "BPCL SBI Card OCTANE", "SBI Card ELITE", "SBI Card PRIME",
      "SimplySAVE SBI Card", "IRCTC SBI Card Premier", "IRCTC SBI Platinum Card",
      "Landmark Rewards SBI Card", "Landmark Rewards SBI Card SELECT",
      "Landmark Rewards SBI Card PRIME",
    ],
  ),
  ...group(
    "IDFC FIRST Bank",
    "https://www.idfcfirstbank.com/credit-card?cardType=Select",
    [
      "IDFC FIRST Classic Credit Card", "IDFC FIRST Millennia Credit Card",
      "IDFC FIRST Select Credit Card", "IDFC FIRST Wealth Credit Card",
      "IDFC FIRST Digital RuPay Credit Card", "IDFC FIRST EA₹N Credit Card",
      "IDFC FIRST Power Credit Card", "IDFC FIRST Power+ Credit Card",
      "IDFC FIRST SWYP Credit Card", "IDFC FIRST Ashva Credit Card",
      "IDFC FIRST Mayura Credit Card", "IndiGo IDFC FIRST Credit Card",
      "LIC Classic IDFC FIRST Credit Card", "LIC Select IDFC FIRST Credit Card",
    ],
    {
      invite: ["IDFC FIRST Private Credit Card"],
      secured: ["IDFC FIRST WOW! Credit Card"],
      discontinued: ["Club Vistara IDFC FIRST Bank Credit Card"],
    },
  ),
  ...group(
    "AU Small Finance Bank",
    "https://www.au.bank.in/personal-banking/credit-cards",
    [
      "AU Bank Zenith+ Credit Card", "AU Bank Ananta Credit Card",
      "AU Bank Laksya Credit Card", "AU Bank Tejas Credit Card",
      "AU Bank Prathama Credit Card", "AU Bank LIT Credit Card",
      "AU Bank CA Metal Credit Card", "AU Bank CS Credit Card",
      "AU Bank Vetta Credit Card", "AU Bank Spont Credit Card",
      "AU Bank NOMO Credit Card", "AU Bank Xcite Ultra Credit Card",
      "AU Bank Xcite Ace Credit Card", "AU Bank Xcite Credit Card",
      "AU Bank Traverse NRI Credit Card", "AU Bank InstaPay RuPay Credit Card",
      "AU Bank Kosmo Credit Card", "AU Bank Zaggle Credit Card",
      "CheQ AU Bank Credit Card", "Paytm AU Bank Credit Card",
      "ixigo AU Bank Credit Card", "AU Bank Zenith Credit Card",
      "AU Bank Altura Plus Credit Card", "AU Bank Altura Credit Card",
    ],
  ),
];
