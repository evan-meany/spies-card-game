// Engine hardening: seeded random full games checking invariants, plus the README cross-check.
//
// README rules checklist (rule -> where it is tested):
//  Overview
//   - 52-card deck, 2 players ............................. deck.test.ts (newDeck), playout (52 distinct)
//   - 3 rounds, most round wins takes the game, ties ........ rounds.test.ts (the whole game, gameWinner)
//   - Hands carry over; board cards leave play each round ... rounds.test.ts (round end), playout
//  The Board
//   - Two sides, three rows (Clubs, Hearts, Diamonds) ........ board.test.ts
//  The Cards
//   - Values (A 3, 10-K 2, 3-9 1, 2 is 1) ................... cards.test.ts (cardPoints)
//   - Clubs/Hearts/Diamonds on own side, matching row ........ turns.test.ts (playing a suit card)
//   - Spy on an opponent card, subtracts its value, stacks,
//     stays, floors at 0, example Jack and 6 of Spades ....... turns.test.ts (playing a spy), board.test.ts
//   - Trade a Spy: discard, draw one, uses the turn,
//     one per turn ........................................... turns.test.ts (trading a spy)
//   - 2 of Clubs/Hearts/Diamonds: replace or play normally ... turns.doubleagents.test.ts
//   - 2 of Spades: replace a Spy or play as a Spy ............ turns.doubleagents.test.ts
//  Game Play
//   - Deal 15, discard 5, reshuffle into the deck ............ state.test.ts (newGame, applyDiscard)
//   - Round start flip, re-flip on a tie, higher goes first .. rounds.test.ts (startRound flip)
//   - Turn: play, trade or pass ............................... turns.test.ts, this file (legal moves)
//   - Pass is final; opponent keeps playing ................... turns.test.ts (passing)
//   - A Spy holder is never auto-passed ....................... turns.test.ts (auto-pass), this file
//   - Empty hand passes automatically ......................... turns.test.ts (auto-pass), rounds.test.ts
//   - Round ends when both pass; board removed ................ rounds.test.ts (round end)
//   - Row winners, ties, 0-0 ties ............................. rounds.test.ts (scoreRound)
//   - Round winner by rows, then total points, else tie ....... rounds.test.ts (scoreRound)
//   - Game winner, tied rounds ignored, round 3 skipped
//     after a 2-0 lead ....................................... rounds.test.ts (gameWinner, the whole game)

import { allBoardCards, cardValue, emptyBoard, opponentOf, placed, placeCard } from './board';
import { cardId, makeCard, type Card } from './cards';
import { createRng, shuffle, type Rng } from './deck';
import { gameWinner } from './rounds';
import { DISCARD_SIZE, newGame, viewFor, type GameState } from './state';
import { applyMove, legalMoves, type Move } from './turns';

const GAMES = 400;
const MAX_MOVES = 3000;

function allCards(s: GameState): Card[] {
  const setup = s.setupDiscards.flatMap((d) => d ?? []);
  return [
    ...s.hands[0],
    ...s.hands[1],
    ...s.deck,
    ...setup,
    ...allBoardCards(s.board),
    ...s.outOfPlay,
  ];
}

function checkInvariants(s: GameState): void {
  const ids = allCards(s).map(cardId);
  if (ids.length !== 52 || new Set(ids).size !== 52) throw new Error('cards lost or duplicated');
  for (const side of s.board) {
    for (const row of [side.clubs, side.hearts, side.diamonds]) {
      for (const p of row) {
        if (cardValue(p) < 0) throw new Error('negative card value');
        if (p.card.suit === 'spades') throw new Error('a spade in a row');
      }
    }
  }
  if (s.phase === 'playing') {
    for (const p of [0, 1] as const) {
      if (s.hands[p].length === 0 && !s.passed[p]) throw new Error('empty hand not passed');
    }
    if (s.passed[s.turn]) throw new Error('turn on a passed player');
    if (s.passed[0] && s.passed[1]) throw new Error('round over but still playing');
  }
  if (s.roundResults.length > 3) throw new Error('too many rounds');
}

/** Play one game with random legal moves; returns the move log and the final state. */
function playout(seed: number, checkAllLegal: boolean): { log: string[]; final: GameState } {
  const rng: Rng = createRng(seed * 7919 + 13);
  let s = newGame(seed);
  const log: string[] = [];
  for (const player of [0, 1] as const) {
    const cards = shuffle(s.hands[player], rng).slice(0, DISCARD_SIZE);
    const r = applyMove(s, { type: 'discard', player, cards });
    if (!r.ok) throw new Error(`discard rejected: ${r.error}`);
    s = r.state;
    checkInvariants(s);
  }
  for (let n = 0; s.phase === 'playing'; n++) {
    if (n > MAX_MOVES) throw new Error(`game ${seed} did not terminate`);
    const moves = legalMoves(s);
    if (moves.length === 0) throw new Error('playing but no legal moves');
    if (checkAllLegal) {
      for (const m of moves) {
        const r = applyMove(s, m);
        if (!r.ok) throw new Error(`legal move rejected: ${JSON.stringify(m)} -> ${r.error}`);
      }
    }
    const move: Move = moves[Math.floor(rng() * moves.length)];
    const r = applyMove(s, move);
    if (!r.ok) throw new Error(`legal move rejected: ${JSON.stringify(move)} -> ${r.error}`);
    log.push(JSON.stringify(move));
    s = r.state;
    checkInvariants(s);
    const view = viewFor(s, 0);
    if (view.opponentHandSize !== s.hands[1].length) throw new Error('bad view');
  }
  return { log, final: s };
}

describe('randomized playouts', () => {
  it(`finish ${GAMES} full games keeping every invariant and accepting every legal move`, () => {
    for (let seed = 1; seed <= GAMES; seed++) {
      const { final } = playout(seed, true);
      expect(final.phase).toBe('gameOver');
      expect(final.roundResults.length).toBeGreaterThanOrEqual(2);
      expect(gameWinner(final.roundResults)).not.toBeNull();
      expect(allCards(final)).toHaveLength(52);
    }
  });

  it('gives the same game for the same seed and different games for different seeds', () => {
    const a = playout(42, false);
    const b = playout(42, false);
    expect(a.log).toEqual(b.log);
    expect(a.final).toEqual(b.final);
    expect(playout(43, false).log).not.toEqual(a.log);
  });

  it('reaches every move type across the games', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      for (const line of playout(seed, false).log) seen.add(JSON.parse(line).type);
    }
    expect([...seen].sort()).toEqual(['pass', 'play', 'replace', 'replaceSpy', 'spy', 'trade']);
  });
});

describe('README cross-check gaps', () => {
  const playing = (hands: [Card[], Card[]], board = emptyBoard()): GameState => ({
    ...newGame(1),
    phase: 'playing',
    hands,
    deck: [makeCard(9, 'clubs'), makeCard(8, 'clubs'), makeCard(7, 'clubs')],
    board,
  });

  it('offers no spy plays when the opponent has no cards, but a spy holder can still trade', () => {
    const moves = legalMoves(playing([[makeCard(6, 'spades')], [makeCard(3, 'clubs')]]));
    expect(moves.some((m) => m.type === 'spy')).toBe(false);
    expect(moves.some((m) => m.type === 'trade')).toBe(true);
  });

  it('refuses a trade once the player has passed', () => {
    let s = playing([
      [makeCard(6, 'spades'), makeCard(5, 'clubs')],
      [makeCard(3, 'clubs'), makeCard(4, 'clubs')],
    ]);
    const passed = applyMove(s, { type: 'pass', player: 0 });
    if (!passed.ok) throw new Error('pass failed');
    s = { ...passed.state, turn: 0 };
    const r = applyMove(s, { type: 'trade', player: 0, card: makeCard(6, 'spades') });
    expect(r).toEqual({ ok: false, error: 'alreadyPassed' });
  });

  it('never lets a Spade be played into a row, even as the 2 of Spades', () => {
    const s = playing([[makeCard(2, 'spades')], [makeCard(3, 'clubs')]]);
    const r = applyMove(s, { type: 'play', player: 0, card: makeCard(2, 'spades') });
    expect(r).toEqual({ ok: false, error: 'notSuitCard' });
  });

  it('keeps a spy stack on the card it was played on through a replace of a neighbour', () => {
    const board = placeCard(
      placeCard(emptyBoard(), 1, placed(makeCard(11, 'hearts'))),
      1,
      placed(makeCard(5, 'hearts')),
    );
    const s = playing(
      [[makeCard(6, 'spades'), makeCard(5, 'clubs')], [makeCard(3, 'clubs')]],
      board,
    );
    const r = applyMove(s, {
      type: 'spy',
      player: 0,
      card: makeCard(6, 'spades'),
      target: { player: 1, suit: 'hearts', index: 0 },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.board[1].hearts[0].spies).toHaveLength(1);
    expect(r.state.board[1].hearts[1].spies).toHaveLength(0);
    expect(opponentOf(0)).toBe(1);
  });
});
