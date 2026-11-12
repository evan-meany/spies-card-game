import { emptyBoard, placed, placeCard, addSpy, type Board, type Player } from './board';
import { cardId, makeCard, type Card } from './cards';
import { gameWinner, isGameOver, scoreRound, startRound } from './rounds';
import {
  DEFAULT_RULES,
  DISCARD_SIZE,
  newGame,
  viewFor,
  type GameState,
  type RoundResult,
} from './state';
import { applyMove, legalMoves, type Move } from './turns';

const C = (rank: Card['rank'], suit: Card['suit']) => makeCard(rank, suit);
const ids = (cards: readonly Card[]) => cards.map(cardId);

function boardOf(mine: Card[], theirs: Card[]): Board {
  let b = emptyBoard();
  for (const c of mine) b = placeCard(b, 0, placed(c));
  for (const c of theirs) b = placeCard(b, 1, placed(c));
  return b;
}

function ok(state: GameState, move: Move): GameState {
  const r = applyMove(state, move);
  if (!r.ok) throw new Error(`unexpected error ${r.error}`);
  return r.state;
}

function playing(overrides: Partial<GameState> = {}): GameState {
  return {
    ...newGame(1),
    phase: 'playing',
    hands: [[C(5, 'clubs')], [C(6, 'clubs')]],
    deck: [C(9, 'clubs'), C(3, 'hearts'), C(4, 'hearts'), C(7, 'hearts')],
    ...overrides,
  };
}

/** Put a board down and have both players pass, which closes the round. */
function finishRound(state: GameState, board: Board): GameState {
  const before = state.roundResults.length;
  let s: GameState = { ...state, board };
  while (s.phase === 'playing' && s.roundResults.length === before) {
    s = ok(s, { type: 'pass', player: s.turn });
  }
  return s;
}

const roundResult = (winner: Player | null): RoundResult => ({
  rows: [],
  rowWins: [0, 0],
  totals: [0, 0],
  winner,
});

describe('scoreRound', () => {
  it('gives each row to the higher total', () => {
    const r = scoreRound(boardOf([C(14, 'clubs')], [C(3, 'clubs')]), DEFAULT_RULES);
    expect(r.rows[0]).toMatchObject({ suit: 'clubs', totals: [3, 1], winner: 0 });
    expect(r.rowWins).toEqual([1, 0]);
    expect(r.winner).toBe(0);
  });

  it('ties a row with equal points', () => {
    const r = scoreRound(boardOf([C(5, 'hearts')], [C(6, 'hearts')]), DEFAULT_RULES);
    expect(r.rows[1].winner).toBeNull();
    expect(r.rowWins).toEqual([0, 0]);
  });

  it('ties a row where neither player has points, including spied-out cards', () => {
    const board = addSpy(
      boardOf([], [C(11, 'diamonds')]),
      { player: 1, suit: 'diamonds', index: 0 },
      C(13, 'spades'),
    );
    const r = scoreRound(board, DEFAULT_RULES);
    expect(r.rows[2]).toMatchObject({ totals: [0, 0], winner: null });
    expect(r.rows[0].winner).toBeNull();
  });

  it('is a tie on an empty board', () => {
    const r = scoreRound(emptyBoard(), DEFAULT_RULES);
    expect(r.winner).toBeNull();
    expect(r.rowWins).toEqual([0, 0]);
  });

  it('wins on rows over a bigger total', () => {
    const board = boardOf(
      [C(3, 'clubs'), C(3, 'hearts')],
      [C(14, 'diamonds'), C(13, 'diamonds'), C(2, 'clubs')],
    );
    // clubs: 1 vs 1 tie; hearts: 1 vs 0 for player 0; diamonds: 0 vs 5 for player 1.
    expect(scoreRound(board, DEFAULT_RULES).rowWins).toEqual([1, 1]);
    const lopsided = boardOf(
      [C(3, 'clubs'), C(3, 'hearts')],
      [C(14, 'diamonds'), C(13, 'diamonds')],
    );
    const r = scoreRound(lopsided, DEFAULT_RULES);
    expect(r.rowWins).toEqual([2, 1]);
    expect(r.totals).toEqual([2, 5]);
    expect(r.winner).toBe(0);
  });

  it('breaks a tie on rows with total points', () => {
    const board = boardOf([C(13, 'clubs'), C(3, 'hearts')], [C(3, 'clubs'), C(14, 'hearts')]);
    const r = scoreRound(board, DEFAULT_RULES);
    expect(r.rowWins).toEqual([1, 1]);
    expect(r.totals).toEqual([3, 4]);
    expect(r.winner).toBe(1);
  });

  it('is a tie when rows and total points are both equal', () => {
    const board = boardOf([C(14, 'clubs'), C(3, 'hearts')], [C(3, 'clubs'), C(14, 'hearts')]);
    const r = scoreRound(board, DEFAULT_RULES);
    expect(r.rowWins).toEqual([1, 1]);
    expect(r.totals).toEqual([4, 4]);
    expect(r.winner).toBeNull();
  });

  it('leaves equal row wins tied when the total-points tiebreak is switched off', () => {
    const board = boardOf([C(13, 'clubs'), C(3, 'hearts')], [C(3, 'clubs'), C(14, 'hearts')]);
    const r = scoreRound(board, { ...DEFAULT_RULES, tiebreakByTotalPoints: false });
    expect(r.winner).toBeNull();
  });

  it('counts spies against card values', () => {
    const board = addSpy(
      boardOf([C(3, 'clubs')], [C(13, 'clubs')]),
      { player: 1, suit: 'clubs', index: 0 },
      C(9, 'spades'),
    );
    expect(scoreRound(board, DEFAULT_RULES).rows[0]).toMatchObject({
      totals: [1, 1],
      winner: null,
    });
  });
});

describe('gameWinner', () => {
  it.each([
    [[0, 0], true, 0],
    [[1, 1], true, 1],
    [[0, 1], false, null],
    [[0, null], false, null],
    [[null, null], false, null],
    [[0, 1, null], true, 'tie'],
    [[null, null, null], true, 'tie'],
    [[0, 1, 0], true, 0],
    [[1, null, 1], true, 1],
    [[0, null, null], true, 0],
    [[null, 0, null], true, 0],
    [[0, 1, 1], true, 1],
  ] as const)('results %j: over %s, winner %s', (winners, over, winner) => {
    const results = winners.map((w) => roundResult(w));
    expect(isGameOver(results)).toBe(over);
    expect(gameWinner(results)).toBe(winner);
  });

  it('skips round three only after a 2-0 lead, not after a win and a tie (proposed reading)', () => {
    expect(isGameOver([roundResult(0), roundResult(0)])).toBe(true);
    expect(isGameOver([roundResult(0), roundResult(null)])).toBe(false);
  });
});

describe('startRound flip', () => {
  const at = (deck: Card[], overrides: Partial<GameState> = {}) =>
    startRound(playing({ deck, hands: [[C(5, 'clubs')], [C(6, 'clubs')]], ...overrides }));

  it('gives the first turn to the higher rank, ignoring suit, and each player keeps their flip', () => {
    const s = at([C(13, 'clubs'), C(5, 'hearts'), C(9, 'clubs')]);
    expect(s.turn).toBe(0);
    expect(ids(s.hands[0])).toEqual(['5C', 'KC']);
    expect(ids(s.hands[1])).toEqual(['6C', '5H']);
    expect(ids(s.deck)).toEqual(['9C']);
    expect(s.lastFirst).toBe(0);
  });

  it('treats the Ace as high and lets player 1 go first with the higher card', () => {
    const s = at([C(13, 'clubs'), C(14, 'spades'), C(9, 'clubs')]);
    expect(s.turn).toBe(1);
    expect(s.lastFirst).toBe(1);
  });

  it('flips again after equal ranks, sending both tied cards to the bottom', () => {
    const s = at([C(5, 'clubs'), C(5, 'hearts'), C(9, 'diamonds'), C(3, 'spades'), C(7, 'clubs')]);
    expect(s.turn).toBe(0);
    expect(ids(s.hands[0])).toEqual(['5C', '9D']);
    expect(ids(s.hands[1])).toEqual(['6C', '3S']);
    expect(ids(s.deck)).toEqual(['7C', '5C', '5H']);
  });

  it('adds no card when the deck has fewer than 2 cards; the other player starts (proposed reading)', () => {
    for (const deck of [[], [C(9, 'clubs')]]) {
      const s = at(deck, { lastFirst: 0 });
      expect(s.turn).toBe(1);
      expect(s.hands).toEqual([[C(5, 'clubs')], [C(6, 'clubs')]]);
      expect(s.deck).toEqual(deck);
    }
    expect(at([], { lastFirst: 1 }).turn).toBe(0);
  });

  it('starts with player 0 in round one when no flip is possible', () => {
    expect(at([], { lastFirst: null }).turn).toBe(0);
  });

  it('gives up when only tied flips remain instead of looping forever', () => {
    const s = at([C(5, 'diamonds'), C(5, 'spades')], { lastFirst: 1 });
    expect(s.turn).toBe(0);
    expect(s.hands).toEqual([[C(5, 'clubs')], [C(6, 'clubs')]]);
    expect(s.deck).toHaveLength(2);
  });

  it('auto-passes a player left without cards', () => {
    const s = at([], { hands: [[], [C(6, 'clubs')]], lastFirst: 1 });
    expect(s.passed).toEqual([true, false]);
    expect(s.turn).toBe(1);
  });
});

describe('round end', () => {
  it('scores the round, clears the board out of play and starts the next round with a flip', () => {
    const board = boardOf([C(14, 'clubs')], [C(3, 'clubs'), C(4, 'hearts')]);
    const s = finishRound(playing(), board);
    expect(s.roundResults).toHaveLength(1);
    expect(s.roundResults[0].winner).toBe(0);
    expect(s.board).toEqual(emptyBoard());
    expect(ids(s.outOfPlay).sort()).toEqual(['3C', '4H', 'AC']);
    expect(s.passed).toEqual([false, false]);
    expect(s.phase).toBe('playing');
    // Round two began: the flip took 9C and 3H from the deck into the hands.
    expect(ids(s.hands[0])).toContain('5C');
    expect(ids(s.hands[0]).concat(ids(s.hands[1]))).toEqual(expect.arrayContaining(['9C', '3H']));
    expect(s.deck).toHaveLength(2);
    expect(s.turn).toBe(0);
  });

  it('carries unplayed hands over between rounds', () => {
    const s = finishRound(playing(), emptyBoard());
    expect(ids(s.hands[0])).toContain('5C');
    expect(ids(s.hands[1])).toContain('6C');
  });

  it('keeps all 52 cards across hands, deck, board and out of play from setup through round end', () => {
    let s = newGame(11);
    for (const player of [0, 1] as const) {
      s = ok(s, { type: 'discard', player, cards: s.hands[player].slice(0, DISCARD_SIZE) });
    }
    s = finishRound(s, s.board);
    const all = [...s.hands[0], ...s.hands[1], ...s.deck, ...s.outOfPlay];
    expect(new Set(ids(all)).size).toBe(52);
    expect(all).toHaveLength(52);
  });

  it('sends a traded spy out of play', () => {
    const s = ok(playing({ hands: [[C(6, 'spades'), C(5, 'clubs')], [C(6, 'clubs')]] }), {
      type: 'trade',
      player: 0,
      card: C(6, 'spades'),
    });
    expect(ids(s.outOfPlay)).toEqual(['6S']);
  });

  it('ends the round when both players run out of cards', () => {
    let s = playing({ hands: [[C(5, 'clubs')], [C(6, 'clubs')]], deck: [] });
    s = ok(s, { type: 'play', player: 0, card: C(5, 'clubs') });
    s = ok(s, { type: 'play', player: 1, card: C(6, 'clubs') });
    // Nobody can flip or play in later rounds either, so every remaining round ends at once.
    expect(s.roundResults[0].totals).toEqual([1, 1]);
    expect(s.roundResults).toHaveLength(3);
    expect(s.phase).toBe('gameOver');
    expect(gameWinner(s.roundResults)).toBe('tie');
  });
});

describe('the whole game', () => {
  const win = (p: Player): Board =>
    p === 0 ? boardOf([C(14, 'clubs')], []) : boardOf([], [C(14, 'clubs')]);
  const deck = () => [
    C(9, 'clubs'),
    C(3, 'hearts'),
    C(4, 'hearts'),
    C(7, 'hearts'),
    C(8, 'hearts'),
    C(10, 'hearts'),
    C(11, 'hearts'),
    C(12, 'hearts'),
  ];

  it('ends after round two when one player wins both rounds', () => {
    let s = playing({ deck: deck() });
    s = finishRound(s, win(0));
    expect(s.phase).toBe('playing');
    s = finishRound(s, win(0));
    expect(s.phase).toBe('gameOver');
    expect(s.roundResults).toHaveLength(2);
    expect(gameWinner(s.roundResults)).toBe(0);
  });

  it('plays round three after a win and a loss, and the third decides the game', () => {
    let s = playing({ deck: deck() });
    s = finishRound(s, win(0));
    s = finishRound(s, win(1));
    expect(s.phase).toBe('playing');
    s = finishRound(s, win(1));
    expect(s.phase).toBe('gameOver');
    expect(gameWinner(s.roundResults)).toBe(1);
  });

  it('plays round three after a win and a tied round (proposed reading)', () => {
    let s = playing({ deck: deck() });
    s = finishRound(s, win(0));
    s = finishRound(s, emptyBoard());
    expect(s.phase).toBe('playing');
    s = finishRound(s, emptyBoard());
    expect(s.phase).toBe('gameOver');
    expect(gameWinner(s.roundResults)).toBe(0);
  });

  it('ties the game when rounds are split or all tied', () => {
    let split = playing({ deck: deck() });
    split = finishRound(split, win(0));
    split = finishRound(split, win(1));
    split = finishRound(split, emptyBoard());
    expect(split.phase).toBe('gameOver');
    expect(gameWinner(split.roundResults)).toBe('tie');

    let drawn = playing({ deck: deck() });
    for (let i = 0; i < 3; i++) drawn = finishRound(drawn, emptyBoard());
    expect(drawn.phase).toBe('gameOver');
    expect(gameWinner(drawn.roundResults)).toBe('tie');
  });

  it('accepts no moves once the game is over', () => {
    let s = playing({ deck: deck() });
    s = finishRound(s, win(0));
    s = finishRound(s, win(0));
    expect(legalMoves(s)).toEqual([]);
    expect(applyMove(s, { type: 'pass', player: 0 })).toEqual({ ok: false, error: 'wrongPhase' });
  });

  it('shows finished round results in both views without exposing hands', () => {
    let s = playing({ deck: deck() });
    s = finishRound(s, win(0));
    const view = viewFor(s, 1);
    expect(view.roundResults).toEqual(s.roundResults);
    expect(Object.keys(view)).not.toContain('hands');
    expect(Object.keys(view)).not.toContain('outOfPlay');
  });
});
