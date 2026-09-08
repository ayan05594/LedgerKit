import type { CreditCardCatalogExtension } from "./credit-card-catalog-extra-a";

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
  if (/travel|miles|air|indigo|vistara|spicejet|irctc|safari|easemytrip/i.test(name))
    return "travel";
  if (/private|premium|marquee|reserve|reserv|black|signature|pinnacle|indulge|heritage|legacy|crest|celesta|solitaire/i.test(name))
    return "premium";
  if (/eazydiner|dining/i.test(name)) return "dining";
  return "rewards";
}

function group(
  issuer: string,
  officialUrl: string,
  active: readonly string[],
  options: {
    invite?: readonly string[];
    discontinued?: readonly string[];
    paused?: readonly string[];
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
  add(options.discontinued ?? [], "discontinued");
  add(options.paused ?? [], "applications_paused");
  return rows;
}

export const CREDIT_CARD_CATALOG_EXTRA_B: readonly CreditCardCatalogExtension[] = [
  ...group(
    "IndusInd Bank",
    "https://www.indusind.bank.in/in/en/personal/cards/credit-card.html",
    [
      "IndusInd Bank Platinum RuPay Credit Card", "IndusInd Bank EazyDiner Platinum Credit Card",
      "IndusInd Bank Legend Credit Card", "IndusInd Bank EazyDiner Signature Credit Card",
      "IndusInd Bank Platinum Aura Edge Credit Card", "IndusInd Bank Platinum Credit Card",
      "IndusInd Bank Pinnacle Credit Card", "IndusInd Bank Avios Visa Infinite Credit Card",
      "IndusInd Bank Nexxt Credit Card", "IndusInd Bank Tiger Credit Card",
      "IndusInd Bank Samman Credit Card", "IndusInd Bank Jio-bp Mobility+ Credit Card",
      "IndusInd Bank CRED RuPay Credit Card", "IndusInd Bank ePay Amex Credit Card",
      "IndusInd Bank Solitaire Credit Card", "IndusInd Bank Pioneer Private Credit Card",
      "IndusInd Bank Indulge Credit Card", "IndusInd Bank Pioneer Heritage Credit Card",
      "IndusInd Bank Pioneer Legacy Credit Card", "IndusInd Bank Crest Credit Card",
      "IndusInd Bank Celesta Credit Card",
    ],
    {
      discontinued: [
        "IndusInd Bank Platinum Aura Credit Card", "IndusInd Bank Platinum Select Credit Card",
        "IndusInd Bank Iconia Credit Card", "InterMiles IndusInd Bank Odyssey Credit Card",
        "InterMiles IndusInd Bank Voyage Credit Card",
        "IndusInd Bank Platinum Aura Edge Government Credit Card",
        "IndusInd Bank Poonawalla eLITE Credit Card",
        "Club Vistara IndusInd Bank Explorer Credit Card",
      ],
    },
  ),
  ...group(
    "Standard Chartered India",
    "https://www.sc.bank.in/credit-cards/",
    [
      "Standard Chartered Rewards Credit Card", "Standard Chartered EaseMyTrip Credit Card",
      "Standard Chartered Smart Credit Card", "Standard Chartered Ultimate Credit Card",
      "Standard Chartered Platinum Rewards Credit Card",
    ],
    {
      discontinued: [
        "Standard Chartered Super Value Titanium Credit Card",
        "Standard Chartered Manhattan Platinum Credit Card",
        "Standard Chartered Priority Visa Infinite Credit Card",
        "Standard Chartered DigiSmart Credit Card", "Standard Chartered Beyond Credit Card",
      ],
    },
  ),
  ...group(
    "Kotak Mahindra Bank",
    "https://www.kotak.com/en/personal-banking/cards/credit-cards.html",
    [
      "IndianOil Kotak Credit Card", "Kotak Zen Signature Credit Card",
      "Kotak Air+ Credit Card", "Kotak League Platinum Credit Card",
      "Kotak PVR INOX Credit Card", "Kotak White Credit Card",
      "Kotak 811 Credit Card", "Kotak PVR INOX Platinum Credit Card",
      "IndiGo Kotak Credit Card XL", "IndiGo Kotak Credit Card",
      "Kotak Cashback+ Credit Card", "Kotak 811 #DreamDifferent Credit Card",
      "Kotak PVR INOX Gold Credit Card", "Kotak UPI RuPay Credit Card",
      "Kotak White Reserve Credit Card",
    ],
    { invite: ["Kotak Solitaire Credit Card", "Kotak Infinite Credit Card"] },
  ),
  ...group(
    "YES BANK",
    "https://www.yes.bank.in/personal-banking/yes-individual/cards/credit-cards",
    [
      "YES MARQUEE Credit Card", "YES RESERV Credit Card", "YES ELITE+ Credit Card",
      "YES ACE Credit Card", "YES SELECT Credit Card", "YES FinBooster Credit Card",
      "YES RuPay Credit Card", "YES EMI Credit Card", "YES Wellness Credit Card",
      "YES Wellness Plus Credit Card", "YES BYOC Credit Card",
      "Paisabazaar PaisaSave YES BANK Credit Card",
      "Paisabazaar PaisaSave RuPay Credit Card", "POP-CLUB YES BANK Credit Card",
      "ANQ Phi YES BANK Credit Card", "UNI YES BANK Credit Card",
      "Zagg YES BANK Credit Card", "Klick YES BANK Credit Card",
    ],
    { invite: ["YES PRIVATE Credit Card"] },
  ),
  ...group(
    "RBL Bank",
    "https://www.rbl.bank.in/personal-banking/cards/credit-cards/category",
    [
      "RBL Bank NOVA Credit Card", "IRCTC RBL Bank Credit Card",
      "Shoppers Stop RBL Bank Gold Credit Card", "Shoppers Stop RBL Bank Platinum Credit Card",
      "Shoppers Stop RBL Bank Black Credit Card", "IndianOil XTRA RBL Bank Credit Card",
      "IndianOil RBL Bank Credit Card", "RBL Bank Apex Credit Card",
      "RBL Bank Icon Credit Card", "RBL Bank World Safari Credit Card",
      "RBL Bank World Safari Lite Credit Card", "RBL Bank Platinum Maxima Plus Credit Card",
      "RBL Bank Platinum Delight Credit Card", "RBL Bank ShopRite Credit Card",
      "RBL Bank Cookies Credit Card", "RBL Bank Play Credit Card",
      "Patanjali RBL Bank Vishisht Credit Card", "Patanjali RBL Bank Swarn Credit Card",
    ],
    {
      invite: ["RBL Bank LUMIÈRE Credit Card"],
      discontinued: [
        "RBL Bank Fun+ Credit Card", "RBL Bank QuickPay Credit Card",
        "RBL Bank iGlobe Credit Card", "RBL Bank Platinum Maxima Credit Card",
        "RBL Bank SalarySe Up Credit Card", "TVS RBL Bank Credit Card",
        "DMI RBL Bank Credit Card", "RBL Bank SaveMax Credit Card",
        "MoneyTap RBL Bank Credit Card", "Paisabazaar Duet RBL Bank Credit Card",
        "Paisabazaar Plus RBL Bank Credit Card", "RBL Bank Insignia Credit Card",
        "RBL Bank Monthly Treats Credit Card", "RBL Bank Popcorn Credit Card",
        "RBL Bank Movies and More Credit Card", "RBL Bank Blockbuster Credit Card",
        "RBL Bank Titanium Delight Credit Card", "RBL Bank MoCash Credit Card",
      ],
    },
  ),
  ...group(
    "BOBCARD",
    "https://www.bobcard.co.in/credit-card-types",
    [
      "BOBCARD ETERNA Credit Card", "BOBCARD PREMIER Credit Card",
      "BOBCARD TIARA Credit Card", "BOBCARD Cashback Credit Card",
      "BOBCARD EASY Credit Card", "BOBCARD SELECT Credit Card",
      "SNAPDEAL BOBCARD Credit Card", "HPCL ENERGIE BOBCARD Credit Card",
      "IRCTC BOBCARD Credit Card", "BOBCARD PRIME Credit Card",
      "BOBCARD PM SVANidhi Credit Card",
    ],
  ),
  ...group(
    "Federal Bank",
    "https://www.federal.bank.in/credit-cards",
    [
      "Federal Bank Visa Celesta Credit Card", "Federal Bank Visa Imperio Credit Card",
      "Federal Bank Visa Signet Credit Card", "Federal Bank Mastercard Celesta Credit Card",
      "Federal Bank Mastercard Imperio Credit Card", "Federal Bank Mastercard Signet Credit Card",
      "Federal Bank RuPay Signet Credit Card", "Federal Bank RuPay Wave Credit Card",
      "Scapia Federal Bank Credit Card",
    ],
  ),
  ...group(
    "HSBC India",
    "https://www.hsbc.bank.in/credit-cards/",
    [
      "HSBC Premier Credit Card", "HSBC Live+ Credit Card", "HSBC Taj Credit Card",
      "HSBC TravelOne Credit Card", "HSBC Visa Platinum Credit Card",
      "HSBC RuPay Platinum Credit Card", "HSBC RuPay Cashback Credit Card",
    ],
  ),
  ...group(
    "American Express India",
    "https://www.americanexpress.com/in/credit-cards/all-cards/",
    [],
    {
      paused: [
        "American Express Platinum Card", "American Express Platinum Reserve Credit Card",
        "American Express Platinum Travel Credit Card", "American Express Gold Card",
        "American Express Membership Rewards Credit Card",
        "American Express SmartEarn Credit Card",
      ],
    },
  ),
];
