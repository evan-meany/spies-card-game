# Spies Roadmap

Goal: a playable online version of Spies, the two-player card game in `README.md`. First a tested rules engine, then a server that runs matches, then a client to play in.

## Guiding decisions
- **`README.md` is the spec.** Rules are implemented as written; ambiguities are settled under *Decisions* below.
- **Pure engine, thin edges.** `src/game/` is deterministic and I/O-free; the server and clients only send moves and render state.
- **Each phase ends runnable** and passes `scripts/check.sh`.

## Phases
Each phase is one branch and one PR (see `docs/process/git_guidelines.md`). Later phases stay one line until started.

1. **Rules engine** (`minor`): branch `phase-1-rules-engine`
    - [ ] **Fix the module build**: track `go.mod` (remove `*.mod` from `.gitignore`), name the module `spies` to match the imports, require `gorilla/websocket`, and make `scripts/check.sh` pass
    - [ ] **Card points and spies**: point values (Ace 3, 10–King 2, 2–9 1), `IsSpy`, `IsDoubleAgent`, tests
    - [ ] **Deck draw and shuffle**: seeded shuffle, draw, add cards back, tests
    - [ ] **Board**: two sides with Clubs, Hearts and Diamonds rows, spies stacked on cards, card value floored at 0, row totals
    - [ ] **Game setup**: deal 15, each player discards 5, discards reshuffled into the deck
    - [ ] **Turns**: play a suit card to its row, play a spy on an opponent card, trade one spy per turn, pass, auto-pass with no legal moves
    - [ ] **Double agents**: 2 of Clubs, Hearts or Diamonds replace or play normally; 2 of Spades replaces a spy or plays as a spy
    - [ ] **Rounds and game**: round start flip and first player, round end, row and round winners with ties, three rounds with hands carried over, skip round three after a 2–0 lead
    - [ ] **CLI game**: `src/main.go` plays a hot-seat game in the terminal over the engine
    - [ ] **Exit checks**: `scripts/check.sh` passes, every `README.md` rule has a test, a full CLI game played to the end, README and docs match the code
2. **Match server** (`minor`): grow `test/server.go` into a server package that runs engine matches over WebSocket, with per-player hidden hands
3. **Client** (`minor`): a browser client to join, see the board and play

## Decisions
- (none yet)

## Notes for agents
- Check off items here as you finish them. Record decisions and known limitations under *Decisions*.
- Prefer finishing a runnable slice over broad unfinished scaffolding.
