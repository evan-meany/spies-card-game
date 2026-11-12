# Code Style

- Format with `gofmt`; `go vet` must be clean.
- Follow the existing naming: exported types and constructors (`Card`, `NewDeck`), `String()` methods for printable enums, `All<Things>` arrays for iteration.
- Every exported identifier gets a one-line doc comment. Keep comments to a single line.
- Keep game rules in `src/game/`, one file per concept (`deck.go`, `board.go`, `round.go`). No I/O or global state in `src/game/`; pass a seeded `*rand.Rand` where randomness is needed.
- Return errors for illegal moves (`ErrIllegalMove`-style sentinel errors) instead of panicking.
- Tests are table-driven `_test.go` files next to the code they test. Each rule in `README.md` gets at least one test, including its edge cases (values floor at 0, ties, auto-pass).
- Prefer the standard library. Add a dependency only when a task needs it and say why in the commit body.
