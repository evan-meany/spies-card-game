// Rounds and game: the round-start flip, round scoring, clearing the board and the game result.
// Card accounting: every card is in a hand, the deck, the board or `outOfPlay` (cleared board
// cards and traded Spies). Flipped cards go to a hand; tied flips go to the bottom of the deck.

import {
  allBoardCards,
  emptyBoard,
  opponentOf,
  rowTotal,
  sideTotal,
  type Board,
  type RowSuit,
} from './board';
import { ROW_SUITS, compareRank, type Card } from './cards';
import type { GameState, RoundResult, RuleSettings } from './state';

/** Rounds in a full game. */
export const ROUNDS = 3;

const ROWS = ROW_SUITS as readonly RowSuit[];

/** True once both players have passed (the round is over). */
export function bothPassed(state: GameState): boolean {
  return state.passed[0] && state.passed[1];
}

/** Score a board: each row is won by the higher total (equal, including 0-0, is tied). */
export function scoreRound(board: Board, settings: RuleSettings): RoundResult {
  const rows = ROWS.map((suit) => {
    const totals: [number, number] = [rowTotal(board, 0, suit), rowTotal(board, 1, suit)];
    const winner = totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1;
    return { suit, totals, winner } as const;
  });
  const rowWins: [number, number] = [
    rows.filter((r) => r.winner === 0).length,
    rows.filter((r) => r.winner === 1).length,
  ];
  const totals: [number, number] = [sideTotal(board, 0), sideTotal(board, 1)];
  let winner: 0 | 1 | null = null;
  if (rowWins[0] !== rowWins[1]) {
    winner = rowWins[0] > rowWins[1] ? 0 : 1;
  } else if (settings.tiebreakByTotalPoints && totals[0] !== totals[1]) {
    winner = totals[0] > totals[1] ? 0 : 1;
  }
  return { rows, rowWins, totals, winner };
}

function roundWins(results: readonly RoundResult[]): [number, number] {
  return [
    results.filter((r) => r.winner === 0).length,
    results.filter((r) => r.winner === 1).length,
  ];
}

/** True when the game has no more rounds: three played, or one player won the first two. */
export function isGameOver(results: readonly RoundResult[]): boolean {
  const [a, b] = roundWins(results);
  return results.length >= ROUNDS || (results.length === 2 && (a === 2 || b === 2));
}

/** The game winner, 'tie', or null while the game is still going. */
export function gameWinner(results: readonly RoundResult[]): 0 | 1 | 'tie' | null {
  if (!isGameOver(results)) return null;
  const [a, b] = roundWins(results);
  return a === b ? 'tie' : a > b ? 0 : 1;
}

/**
 * Flip for the round start: both players flip the top card, the higher rank goes first, and each
 * adds their flipped card to their hand. Equal ranks go to the bottom of the deck and both flip
 * again. When no flip can decide (fewer than 2 cards, or only ties), no card is added and the
 * player who did not go first last round starts (player 0 in round one).
 */
export function startRound(state: GameState): GameState {
  let deck: readonly Card[] = state.deck;
  let first: 0 | 1 = state.lastFirst === null ? 0 : opponentOf(state.lastFirst);
  let hands = state.hands;
  for (let tries = 0; deck.length >= 2 && tries < deck.length; tries++) {
    const [a, b, ...rest] = deck;
    if (compareRank(a, b) !== 0) {
      first = compareRank(a, b) > 0 ? 0 : 1;
      hands = [
        [...hands[0], a],
        [...hands[1], b],
      ];
      deck = rest;
      break;
    }
    deck = [...rest, a, b];
  }
  let started: GameState = {
    ...state,
    deck,
    hands,
    turn: first,
    lastFirst: first,
    passed: [false, false],
    tradesThisTurn: 0,
  };
  // An empty-handed player passes automatically.
  for (const p of [0, 1] as const) {
    if (started.hands[p].length === 0) {
      started = {
        ...started,
        passed: p === 0 ? [true, started.passed[1]] : [started.passed[0], true],
      };
    }
  }
  if (started.passed[started.turn] && !bothPassed(started)) {
    started = { ...started, turn: opponentOf(started.turn) };
  }
  return started;
}

/**
 * While both players have passed: score the round, move the board's cards out of play and start
 * the next round, or end the game. Does nothing unless the round is over.
 */
export function closeRounds(state: GameState): GameState {
  let s = state;
  while (s.phase === 'playing' && bothPassed(s)) {
    const roundResults = [...s.roundResults, scoreRound(s.board, s.settings)];
    const cleared: GameState = {
      ...s,
      roundResults,
      outOfPlay: [...s.outOfPlay, ...allBoardCards(s.board)],
      board: emptyBoard(),
    };
    s = isGameOver(roundResults)
      ? { ...cleared, phase: 'gameOver', passed: [false, false] }
      : startRound(cleared);
  }
  return s;
}
