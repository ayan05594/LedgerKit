# End-to-end API tests

Exercises the whole write path against a running server: reward preview, saving,
adjustments, refunds clawing back rewards, quarterly cap exhaustion, partial
reimbursements, validation guards, transfers, derived account balances,
per-expense card conditions such as Amazon Prime, and recalculation after a rule
edit.

```bash
npm run build && npm start          # in one terminal
curl -X POST localhost:4400/api/reset   # start from an empty ledger
python3 tests/api.e2e.py
```

Expect `23 passed, 0 failed`.
