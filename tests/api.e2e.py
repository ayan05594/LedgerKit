import json, urllib.request, urllib.error
import os
BASE=os.environ.get("LEDGERKIT_URL","http://localhost:4400")
def call(path, method="GET", body=None):
    req=urllib.request.Request(BASE+path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type":"application/json"} if body is not None else {})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)
R=lambda x:int(round(x*100))
ok=0; bad=0
def check(label, got, want):
    global ok,bad
    if got==want: ok+=1; print(f"  ok   {label}")
    else: bad+=1; print(f"  FAIL {label}: got {got} want {want}")

print("1. Reward preview before saving")
p=call("/api/reward-preview","POST",{"instrumentId":"card-flipkart-axis","amountPaise":R(10000),
    "occurredAt":"2026-09-05","categorySlug":"fashion","merchantSlug":"myntra",
    "paymentAppSlug":"card-online","channel":"online"})["data"]
check("₹10,000 Myntra previews ₹750", p["valuePaise"], 75000)

print("\n2. Create the expense")
e1=call("/api/expenses","POST",{"occurredAt":"2026-09-05","amountPaise":R(10000),
    "categorySlug":"fashion","merchantSlug":"myntra","instrumentId":"card-flipkart-axis",
    "paymentAppSlug":"card-online","channel":"online","description":"Test order"})["data"]["id"]
row=call(f"/api/expenses/{e1}")["data"]
check("saved reward matches the preview", row["expense"]["rewardValuePaise"], 75000)

print("\n3. Add a coupon on top")
call(f"/api/expenses/{e1}/adjustments","POST",{"label":"MYNTRA500","kind":"coupon",
    "amountPaise":R(500),"immediate":True})
row=call(f"/api/expenses/{e1}")["data"]
check("out of pocket drops by the coupon", row["math"]["outOfPocketPaise"], R(9500))
check("effective cost = 10000 - 500 - 750", row["math"]["effectiveCostPaise"], R(8750))

print("\n4. Partial refund claws back reward")
call(f"/api/expenses/{e1}/refunds","POST",{"amountPaise":R(4000),
    "refundedAt":"2026-09-10","status":"received","reason":"Returned two items"})
row=call(f"/api/expenses/{e1}")["data"]
check("reward recalculated on ₹6,000", row["expense"]["rewardValuePaise"], 45000)
check("net spend now ₹5,500", row["math"]["netSpendPaise"], R(5500))

print("\n5. Cap exhaustion across expenses")
call("/api/expenses","POST",{"occurredAt":"2026-09-11","amountPaise":R(60000),
    "categorySlug":"fashion","merchantSlug":"myntra","instrumentId":"card-flipkart-axis",
    "paymentAppSlug":"card-online","channel":"online","description":"Sale haul"})
e3=call("/api/expenses","POST",{"occurredAt":"2026-09-20","amountPaise":R(5000),
    "categorySlug":"fashion","merchantSlug":"myntra","instrumentId":"card-flipkart-axis",
    "paymentAppSlug":"card-online","channel":"online","description":"After the cap"})["data"]["id"]
row=call(f"/api/expenses/{e3}")["data"]
check("third Myntra spend earns nothing", row["expense"]["rewardValuePaise"], 0)
print("       engine says:", row["expense"]["rewardExplain"])

print("\n6. Partial reimbursement")
e4=call("/api/expenses","POST",{"occurredAt":"2026-09-12","amountPaise":R(8000),
    "categorySlug":"dining-out","instrumentId":"card-hdfc-millennia-cc",
    "paymentAppSlug":"card-pos","channel":"offline","description":"Team dinner",
    "reimbursable":True,"reimbursementExpectedPaise":R(6000),"reimbursementFrom":"Rohan"})["data"]["id"]
call(f"/api/expenses/{e4}/reimbursement","POST",{"action":"record","amountPaise":R(2500)})
row=call(f"/api/expenses/{e4}")["data"]
check("status is partial", row["expense"]["reimbursementStatus"], "partial")
check("₹3,500 still outstanding", row["math"]["reimbursementOutstandingPaise"], R(3500))
check("net spend reduced by what came back", row["math"]["netSpendPaise"], R(5500))

print("\n7. Validation guards")
try:
    call("/api/expenses","POST",{"occurredAt":"2026-09-05","amountPaise":R(100),"categorySlug":"fashion"})
    check("rejects expense with no payment source", "accepted", "rejected")
except urllib.error.HTTPError as ex:
    check("rejects expense with no payment source", json.load(ex)["error"][:10], "Choose the")
try:
    call("/api/expenses","POST",{"occurredAt":"2026-09-05","amountPaise":R(100),
        "categorySlug":"fashion","accountId":"acct-bob","reimbursable":True,
        "reimbursementExpectedPaise":R(500)})
    check("rejects reimbursement above the expense", "accepted", "rejected")
except urllib.error.HTTPError as ex:
    check("rejects reimbursement above the expense", json.load(ex)["error"][:14], "Reimbursement ")

print("\n8. Transfers and people")
call("/api/transfers","POST",{"direction":"sent","personId":"per-1","amountPaise":R(3000),
    "occurredAt":"2026-09-08","accountId":"acct-hdfc","purpose":"loan"})
call("/api/transfers","POST",{"direction":"received","personId":"per-1","amountPaise":R(1200),
    "occurredAt":"2026-09-15","accountId":"acct-hdfc","purpose":"repayment"})
bal=[b for b in call("/api/people")["data"] if b["person"]["id"]=="per-1"][0]
check("Rohan owes ₹1,800", bal["netPaise"], R(1800))

print("\n9. Account balance derives from activity")
acct=[a for a in call("/api/accounts")["data"] if a["account"]["id"]=="acct-hdfc"][0]
check("balance = 126400 - 3000 + 1200", acct["balancePaise"], R(126400-3000+1200))

print("\n10. Pending rolls it up")
pend=call("/api/pending")["data"]
check("reimbursement outstanding", pend["reimbursementOutstandingPaise"], R(3500))
check("lending outstanding", pend["lendingOutstandingPaise"], R(1800))

print("\n11. Prime answered per expense")
prime=call("/api/reward-preview","POST",{"instrumentId":"card-amazon-pay-icici",
    "amountPaise":R(10000),"occurredAt":"2026-09-05","categorySlug":"electronics",
    "merchantSlug":"amazon","paymentAppSlug":"card-online","channel":"online",
    "flags":{"primeMember":True}})["data"]
noprime=call("/api/reward-preview","POST",{"instrumentId":"card-amazon-pay-icici",
    "amountPaise":R(10000),"occurredAt":"2026-09-05","categorySlug":"electronics",
    "merchantSlug":"amazon","paymentAppSlug":"card-online","channel":"online",
    "flags":{"primeMember":False}})["data"]
check("preview with Prime = ₹500", prime["valuePaise"], 50000)
check("preview without Prime = ₹300", noprime["valuePaise"], 30000)

a1=call("/api/expenses","POST",{"occurredAt":"2026-09-05","amountPaise":R(10000),
    "categorySlug":"electronics","merchantSlug":"amazon","instrumentId":"card-amazon-pay-icici",
    "paymentAppSlug":"card-online","channel":"online","description":"With Prime",
    "flags":{"primeMember":True}})["data"]["id"]
a2=call("/api/expenses","POST",{"occurredAt":"2026-09-06","amountPaise":R(10000),
    "categorySlug":"electronics","merchantSlug":"amazon","instrumentId":"card-amazon-pay-icici",
    "paymentAppSlug":"card-online","channel":"online","description":"Prime had lapsed",
    "flags":{"primeMember":False}})["data"]["id"]
check("saved with Prime earns ₹500", call(f"/api/expenses/{a1}")["data"]["expense"]["rewardValuePaise"], 50000)
check("saved without Prime earns ₹300", call(f"/api/expenses/{a2}")["data"]["expense"]["rewardValuePaise"], 30000)
check("each records its own rule",
      call(f"/api/expenses/{a2}")["data"]["expense"]["rewardRuleId"], "api-amazon-noprime")

# changing the card default must not rewrite what already happened
inst=call("/api/instruments/card-amazon-pay-icici")["data"]["instrument"]
opts=json.loads(inst["options"])
opts["flags"]=[{**f,"default":False} for f in opts["flags"]]
call("/api/instruments/card-amazon-pay-icici","PATCH",{"options":opts})
check("past Prime expense is untouched by the default flip",
      call(f"/api/expenses/{a1}")["data"]["expense"]["rewardValuePaise"], 50000)
call("/api/instruments/card-amazon-pay-icici","PATCH",
     {"options":{"flags":[{**f,"default":True} for f in opts["flags"]]}})

print("\n12. Editing a rule recalculates history")
call("/api/rules/fka-myntra","PATCH",body={"rateBps":1000})
row=call(f"/api/expenses/{e1}")["data"]
check("₹6,000 eligible at the new 10% = ₹600", row["expense"]["rewardValuePaise"], 60000)
call("/api/rules/fka-myntra","PATCH",body={"rateBps":750})

print(f"\n{ok} passed, {bad} failed")
