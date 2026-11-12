# Code Style

TypeScript in strict mode; `npm run check` (typecheck, lint, Jest) must be clean.

- Follow the existing naming: `PascalCase` types, `camelCase` functions and values, `UPPER_SNAKE_CASE` constants (`ALL_SUITS`, `DEFAULT_RULES`). Prefer string-literal unions and discriminated unions over enums.
- Keep comments short; add a one-line doc comment to each exported identifier.
- Keep game rules in `src/engine/`, one file per concept (`cards.ts`, `deck.ts`, `board.ts`). The engine has no I/O, no global state and no React, React Native, Expo or Node imports; pass a seeded random function where randomness is needed.
- State is immutable: functions return new values and never mutate their arguments.
- Return typed errors for illegal moves instead of throwing; throw only for programmer errors.
- Tests are `*.test.ts` files next to the code, table-driven where it fits. Each rule in `README.md` gets at least one test, including its edge cases (values floor at 0, ties, auto-pass).
- Prefer the platform and installed packages. Add a dependency only when a task needs it, with `npx expo install`, and say why in the commit body.
