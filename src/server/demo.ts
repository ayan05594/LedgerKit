import "server-only";
import {
  addAdjustment,
  addRefund,
  createExpense,
  createTransfer,
  getSetting,
  recordReimbursement,
  setSetting,
} from "./mutations";
import { recomputeAll } from "@/lib/rewards/recompute";

const R = (rupees: number) => Math.round(rupees * 100);

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Row {
  d: number;
  amt: number;
  desc: string;
  cat: string;
  card?: string;
  acct?: string;
  app?: string;
  merch?: string;
  ch?: "online" | "offline" | "upi";
  label?: string;
}

const ROWS: Row[] = [
  // ---- Flipkart Axis: big Myntra + Flipkart quarter
  { d: 3, amt: 4890, desc: "Winter jackets", cat: "fashion", card: "card-flipkart-axis", merch: "myntra", app: "card-online", ch: "online" },
  { d: 11, amt: 12400, desc: "Running shoes and gym wear", cat: "fashion", card: "card-flipkart-axis", merch: "myntra", app: "card-online", ch: "online" },
  { d: 26, amt: 31500, desc: "Sale haul", cat: "fashion", card: "card-flipkart-axis", merch: "myntra", app: "card-online", ch: "online" },
  { d: 41, amt: 22000, desc: "Washing machine", cat: "home-goods", card: "card-flipkart-axis", merch: "flipkart", app: "card-online", ch: "online" },
  { d: 18, amt: 2350, desc: "Kitchen storage", cat: "home-goods", card: "card-flipkart-axis", merch: "flipkart", app: "card-online", ch: "online" },
  { d: 6, amt: 1180, desc: "Dinner", cat: "food-delivery", card: "card-flipkart-axis", merch: "swiggy", app: "card-online", ch: "online" },
  { d: 14, amt: 640, desc: "Airport drop", cat: "cab-ride", card: "card-flipkart-axis", merch: "uber", app: "card-online", ch: "online" },
  { d: 33, amt: 9800, desc: "Goa flight", cat: "flights", card: "card-flipkart-axis", merch: "cleartrip", app: "card-online", ch: "online" },
  { d: 22, amt: 2400, desc: "Petrol", cat: "fuel", card: "card-flipkart-axis", app: "card-pos", ch: "offline" },

  // ---- Millennia CC: hits the 5% cap
  { d: 2, amt: 8600, desc: "Groceries and household", cat: "quick-commerce", card: "card-hdfc-millennia-cc", merch: "amazon", app: "card-online", ch: "online" },
  { d: 9, amt: 14200, desc: "Noise-cancelling headphones", cat: "electronics", card: "card-hdfc-millennia-cc", merch: "amazon", app: "card-online", ch: "online" },
  { d: 16, amt: 3100, desc: "Weekend takeaway", cat: "food-delivery", card: "card-hdfc-millennia-cc", merch: "zomato", app: "card-online", ch: "online" },
  { d: 21, amt: 900, desc: "Movie tickets", cat: "movies", card: "card-hdfc-millennia-cc", merch: "bookmyshow", app: "card-online", ch: "online" },
  { d: 28, amt: 6400, desc: "Amazon order via SmartBuy voucher", cat: "online-shopping", card: "card-hdfc-millennia-cc", merch: "amazon", app: "smartbuy", ch: "online" },
  { d: 12, amt: 1850, desc: "Restaurant with friends", cat: "dining-out", card: "card-hdfc-millennia-cc", app: "card-pos", ch: "offline" },
  { d: 35, amt: 2600, desc: "Pharmacy run", cat: "pharmacy", card: "card-hdfc-millennia-cc", merch: "apollo-pharmacy", app: "card-pos", ch: "offline" },
  { d: 44, amt: 4700, desc: "Gym annual top-up", cat: "fitness", card: "card-hdfc-millennia-cc", merch: "cultfit", app: "card-online", ch: "online" },

  // ---- Amazon Pay ICICI
  { d: 1, amt: 2299, desc: "Books and stationery", cat: "online-shopping", card: "card-amazon-pay-icici", merch: "amazon", app: "card-online", ch: "online" },
  { d: 8, amt: 18990, desc: "Tablet", cat: "electronics", card: "card-amazon-pay-icici", merch: "amazon", app: "card-online", ch: "online" },
  { d: 15, amt: 799, desc: "Electricity bill", cat: "electricity", card: "card-amazon-pay-icici", app: "amazon-pay", ch: "online" },
  { d: 19, amt: 599, desc: "Mobile recharge", cat: "mobile-recharge", card: "card-amazon-pay-icici", merch: "airtel", app: "amazon-pay", ch: "online" },
  { d: 30, amt: 3400, desc: "Home essentials", cat: "groceries", card: "card-amazon-pay-icici", merch: "amazon", app: "card-online", ch: "online" },
  { d: 37, amt: 1499, desc: "Prime membership", cat: "subscriptions", card: "card-amazon-pay-icici", merch: "amazon", app: "card-online", ch: "online" },
  { d: 47, amt: 6200, desc: "Gift for Diwali", cat: "gifts-given", card: "card-amazon-pay-icici", merch: "amazon", app: "card-online", ch: "online" },

  // ---- slice: everyday UPI
  { d: 0, amt: 260, desc: "Morning coffee", cat: "cafe", card: "card-slice-rupay", app: "gpay", ch: "upi" },
  { d: 1, amt: 145, desc: "Auto to office", cat: "cab-ride", card: "card-slice-rupay", app: "phonepe", ch: "upi" },
  { d: 2, amt: 820, desc: "Vegetables and fruit", cat: "groceries", card: "card-slice-rupay", app: "gpay", ch: "upi" },
  { d: 4, amt: 380, desc: "Lunch", cat: "dining-out", card: "card-slice-rupay", app: "gpay", ch: "upi" },
  { d: 5, amt: 1240, desc: "Chemist", cat: "pharmacy", card: "card-slice-rupay", app: "phonepe", ch: "upi" },
  { d: 7, amt: 210, desc: "Chai and snacks", cat: "cafe", card: "card-slice-rupay", app: "gpay", ch: "upi" },
  { d: 10, amt: 660, desc: "Haircut", cat: "salon", card: "card-slice-rupay", app: "phonepe", ch: "upi" },
  { d: 13, amt: 1580, desc: "Weekly groceries", cat: "groceries", card: "card-slice-rupay", app: "gpay", ch: "upi" },
  { d: 17, amt: 95, desc: "Metro top-up", cat: "public-transport", card: "card-slice-rupay", app: "phonepe", ch: "upi" },
  { d: 20, amt: 445, desc: "Laundry", cat: "laundry", card: "card-slice-rupay", app: "gpay", ch: "upi" },
  { d: 24, amt: 1120, desc: "Dinner out", cat: "dining-out", card: "card-slice-rupay", app: "gpay", ch: "upi" },
  { d: 29, amt: 300, desc: "Parking", cat: "tolls-parking", card: "card-slice-rupay", app: "phonepe", ch: "upi" },
  { d: 32, amt: 2100, desc: "Cricket kit repair", cat: "miscellaneous", card: "card-slice-rupay", app: "gpay", ch: "upi", label: "Sports gear servicing" },

  // ---- Millennia DC
  { d: 3, amt: 16000, desc: "Amazon gift voucher on SmartBuy", cat: "gift-cards", card: "card-hdfc-millennia-dc", app: "smartbuy", ch: "online" },
  { d: 12, amt: 5400, desc: "Online order", cat: "online-shopping", card: "card-hdfc-millennia-dc", merch: "ajio", app: "card-online", ch: "online" },
  { d: 23, amt: 1200, desc: "Supermarket", cat: "groceries", card: "card-hdfc-millennia-dc", merch: "dmart", app: "card-pos", ch: "offline" },
  { d: 40, amt: 3000, desc: "Wallet top-up", cat: "wallet-load", card: "card-hdfc-millennia-dc", app: "paytm", ch: "online" },

  // ---- BOB debit / UPI straight from the account
  { d: 6, amt: 540, desc: "Milk and eggs", cat: "groceries", acct: "acct-bob", app: "gpay", ch: "upi" },
  { d: 18, amt: 2200, desc: "Society maintenance", cat: "maintenance", acct: "acct-bob", app: "netbanking", ch: "online" },
  { d: 25, amt: 899, desc: "Broadband bill", cat: "broadband", acct: "acct-bob", merch: "act-fibernet", app: "autopay", ch: "online" },
  { d: 31, amt: 1450, desc: "Doctor consultation", cat: "doctor", acct: "acct-bob", app: "gpay", ch: "upi" },
  { d: 5, amt: 18000, desc: "Rent", cat: "rent", acct: "acct-hdfc", app: "netbanking", ch: "online" },
  { d: 27, amt: 12500, desc: "SIP investment", cat: "investments", acct: "acct-hdfc", merch: "zerodha", app: "netbanking", ch: "online" },
  { d: 9, amt: 700, desc: "Street food and market", cat: "other", acct: "acct-cash", app: "cash", ch: "offline", label: "Weekend market" },
];

export async function loadDemoData(): Promise<{ created: number }> {
  if ((await getSetting("demo_loaded")) === "yes") return { created: 0 };

  const ids: Record<string, string> = {};

  for (const [i, row] of ROWS.entries()) {
    const expenseId = await createExpense({
      occurredAt: daysAgo(row.d),
      amountPaise: R(row.amt),
      description: row.desc,
      instrumentId: row.card ?? null,
      accountId: row.acct ?? null,
      paymentAppSlug: row.app ?? null,
      categorySlug: row.cat,
      customLabel: row.label ?? "",
      merchantSlug: row.merch ?? null,
      merchantName: row.merch ? "" : row.desc,
      channel: row.ch ?? "online",
    });
    ids[`r${i}`] = expenseId;
  }

  // A few extra discounts on top of the card's own rewards.
  await addAdjustment(ids.r2, {
    label: "Myntra coupon MYNTRA300",
    kind: "coupon",
    amountPaise: R(300),
    immediate: true,
  });
  await addAdjustment(ids.r3, {
    label: "Bank offer — ₹1,500 instant discount",
    kind: "bank_offer",
    amountPaise: R(1500),
    immediate: true,
  });
  await addAdjustment(ids.r19, {
    label: "Exchange bonus",
    kind: "instant_discount",
    amountPaise: R(2000),
    immediate: true,
  });
  await addAdjustment(ids.r8, {
    label: "Fuel surcharge",
    kind: "surcharge",
    amountPaise: R(24),
    immediate: true,
  });
  await addAdjustment(ids.r13, {
    label: "SmartBuy 5% platform cashback",
    kind: "cashback",
    amountPaise: R(320),
    immediate: false,
    status: "expected",
  });

  // Returns.
  await addRefund(ids.r1, {
    amountPaise: R(3200),
    reason: "Size exchange — returned one pair",
    refundedAt: daysAgo(4),
    status: "received",
  });
  await addRefund(ids.r18, {
    amountPaise: R(2299),
    reason: "Damaged on arrival, return picked up",
    refundedAt: daysAgo(2),
    status: "pending",
  });

  // Reimbursements: one full, one partial.
  const teamDinner = await createExpense({
    occurredAt: daysAgo(10),
    amountPaise: R(7800),
    description: "Team dinner — paid for everyone",
    instrumentId: "card-hdfc-millennia-cc",
    paymentAppSlug: "card-pos",
    categorySlug: "dining-out",
    channel: "offline",
    merchantName: "Toit",
    reimbursable: true,
    reimbursementExpectedPaise: R(6200),
    reimbursementFrom: "Rohan, Ananya and two others",
    reimbursementDueDate: daysAgo(-5),
    reimbursementNote: "Split six ways, my share is ₹1,600",
  });
  await recordReimbursement(teamDinner, R(3100), "Rohan and Ananya settled");

  const clientTravel = await createExpense({
    occurredAt: daysAgo(20),
    amountPaise: R(14500),
    description: "Client visit — flight and cab",
    instrumentId: "card-amazon-pay-icici",
    paymentAppSlug: "card-online",
    categorySlug: "flights",
    channel: "online",
    merchantName: "IndiGo",
    reimbursable: true,
    reimbursementExpectedPaise: R(14500),
    reimbursementFrom: "Work — expense report #4471",
    reimbursementDueDate: daysAgo(-12),
  });

  // Money moving between people.
  await createTransfer({ direction: "sent", personId: "per-1", amountPaise: R(2500), occurredAt: daysAgo(15), accountId: "acct-hdfc", paymentAppSlug: "gpay", purpose: "loan", note: "Covered his share of the trip booking" });
  await createTransfer({ direction: "received", personId: "per-1", amountPaise: R(1000), occurredAt: daysAgo(6), accountId: "acct-hdfc", paymentAppSlug: "gpay", purpose: "repayment", note: "Part payment" });
  await createTransfer({ direction: "sent", personId: "per-2", amountPaise: R(1800), occurredAt: daysAgo(9), accountId: "acct-bob", paymentAppSlug: "phonepe", purpose: "split", countsAsSpend: true, note: "My half of the concert tickets" });
  await createTransfer({ direction: "received", personId: "per-3", amountPaise: R(20000), occurredAt: daysAgo(28), accountId: "acct-hdfc", paymentAppSlug: "netbanking", purpose: "other", note: "Monthly transfer from home" });
  await createTransfer({ direction: "sent", personId: "per-3", amountPaise: R(5000), occurredAt: daysAgo(12), accountId: "acct-hdfc", paymentAppSlug: "gpay", purpose: "gift", countsAsSpend: true, note: "Anniversary gift" });

  await recomputeAll();
  await recomputeAll(new Date().getFullYear() - 1);
  await setSetting("demo_loaded", "yes");
  return { created: ROWS.length + 2 };
}
