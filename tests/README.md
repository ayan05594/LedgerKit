# Engine tests

The reward engine is pure and has no database dependency, so it is tested directly:

```bash
npm run test
```

The runner copies `money.ts`, `periods.ts` and `engine.ts` into a temp folder with
explicit `.ts` extensions (Node's ESM loader needs them) and executes the suite
with Node's built-in type stripping. No test framework required.
