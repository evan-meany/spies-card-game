// Turns: the move union, the legal moves and applying a move during play.
// When a turn ends the round (both passed), the round is scored and the next one starts.

import {
  addSpy,
  getPlaced,
  removeSpy,
  replacePlaced,
  replaceSpy,
  opponentOf,
  placeCard,
  placed,
  type CardRef,
  type Player,
  type RowSuit,
} from './board';
import { cardId, isDoubleAgent, isSpy, type Card } from './cards';
import { draw } from './deck';
import { bothPassed, closeRounds } from './rounds';
import { applyDiscard, type DiscardMove, type GameState, type MoveResult } from './state';

/** Play a Club, Heart or Diamond onto your own matching row. */
export type PlayMove = {
  readonly type: 'play';
  readonly player: Player;
  readonly card: Card;
};

/** Play a Spy on one of the opponent's cards. */
export type SpyMove = {
  readonly type: 'spy';
  readonly player: Player;
  readonly card: Card;
  readonly target: CardRef;
};

/** Discard a Spy from your hand and draw a card. */
export type TradeMove = {
  readonly type: 'trade';
  readonly player: Player;
  readonly card: Card;
};

/** Stop playing for the rest of the round. */
export type PassMove = { readonly type: 'pass'; readonly player: Player };

/** Play a 2 of Clubs, Hearts or Diamonds in place of an opponent card of the same suit. */
export type ReplaceMove = {
  readonly type: 'replace';
  readonly player: Player;
  readonly card: Card;
  readonly target: CardRef;
};

/** Play the 2 of Spades in place of a Spy on one of your own cards, moving that Spy onto an opponent card. */
export type ReplaceSpyMove = {
  readonly type: 'replaceSpy';
  readonly player: Player;
  readonly card: Card;
  /** The card of yours that carries the Spy, and the Spy's position on it. */
  readonly own: CardRef;
  readonly spyIndex: number;
  /** The opponent card that receives the removed Spy. */
  readonly target: CardRef;
};

/** Every move a player can make. */
export type Move =
  DiscardMove | PlayMove | SpyMove | TradeMove | PassMove | ReplaceMove | ReplaceSpyMove;

const ROWS: readonly RowSuit[] = ['clubs', 'hearts', 'diamonds'];

function withHand(state: GameState, player: Player, hand: readonly Card[]): GameState {
  return {
    ...state,
    hands: player === 0 ? [hand, state.hands[1]] : [state.hands[0], hand],
  };
}

function withPassed(state: GameState, player: Player): GameState {
  return {
    ...state,
    passed: player === 0 ? [true, state.passed[1]] : [state.passed[0], true],
  };
}

/** Auto-pass every empty-handed player, then hand the turn on from `turn`, skipping passed players. */
function settleTurn(start: GameState, turn: Player): GameState {
  let state = start;
  for (const p of [0, 1] as const) {
    if (!state.passed[p] && state.hands[p].length === 0) state = withPassed(state, p);
  }
  if (bothPassed(state)) return closeRounds(state);
  return { ...state, turn: state.passed[turn] ? opponentOf(turn) : turn };
}

function endTurn(state: GameState, player: Player): MoveResult {
  return {
    ok: true,
    state: settleTurn({ ...state, tradesThisTurn: 0 }, opponentOf(player)),
  };
}

function removeFromHand(hand: readonly Card[], card: Card): readonly Card[] | null {
  const id = cardId(card);
  const index = hand.findIndex((c) => cardId(c) === id);
  return index < 0 ? null : hand.filter((_, i) => i !== index);
}

function opponentTargets(state: GameState, player: Player): CardRef[] {
  const opponent = opponentOf(player);
  return ROWS.flatMap((suit) =>
    state.board[opponent][suit].map((_, index) => ({
      player: opponent,
      suit,
      index,
    })),
  );
}

function ownSpies(state: GameState, player: Player): { own: CardRef; spyIndex: number }[] {
  return ROWS.flatMap((suit) =>
    state.board[player][suit].flatMap((p, index) =>
      p.spies.map((_, spyIndex) => ({ own: { player, suit, index }, spyIndex })),
    ),
  );
}

/** Every legal move for the player to move; empty during setup (discards are chosen) and after the round. */
export function legalMoves(state: GameState): Move[] {
  if (state.phase !== 'playing') return [];
  const player = state.turn;
  const moves: Move[] = [{ type: 'pass', player }];
  const targets = opponentTargets(state, player);
  for (const card of state.hands[player]) {
    if (!isSpy(card)) {
      moves.push({ type: 'play', player, card });
      if (isDoubleAgent(card)) {
        for (const target of targets.filter((t) => t.suit === card.suit)) {
          moves.push({ type: 'replace', player, card, target });
        }
      }
      continue;
    }
    for (const target of targets) moves.push({ type: 'spy', player, card, target });
    if (isDoubleAgent(card)) {
      for (const { own, spyIndex } of ownSpies(state, player)) {
        for (const target of targets) {
          moves.push({ type: 'replaceSpy', player, card, own, spyIndex, target });
        }
      }
    }
    if (state.tradesThisTurn < state.settings.tradesPerTurn) {
      moves.push({ type: 'trade', player, card });
    }
  }
  return moves;
}

/** Apply any move: the new state, or a typed error (illegal moves never throw). */
export function applyMove(state: GameState, move: Move): MoveResult {
  if (move.type === 'discard') return applyDiscard(state, move);
  if (state.phase !== 'playing') return { ok: false, error: 'wrongPhase' };
  if (state.passed[move.player]) return { ok: false, error: 'alreadyPassed' };
  if (move.player !== state.turn) return { ok: false, error: 'notYourTurn' };

  const { player } = move;
  if (move.type === 'pass') {
    return {
      ok: true,
      state: settleTurn(withPassed(state, player), opponentOf(player)),
    };
  }

  const hand = removeFromHand(state.hands[player], move.card);
  if (hand === null) return { ok: false, error: 'cardNotInHand' };

  switch (move.type) {
    case 'play': {
      if (isSpy(move.card)) return { ok: false, error: 'notSuitCard' };
      const board = placeCard(state.board, player, placed(move.card));
      return endTurn({ ...withHand(state, player, hand), board }, player);
    }
    case 'spy': {
      if (!isSpy(move.card)) return { ok: false, error: 'notSpy' };
      const { target } = move;
      if (target.player === player || !getPlaced(state.board, target)) {
        return { ok: false, error: 'invalidTarget' };
      }
      const board = addSpy(state.board, target, move.card);
      return endTurn({ ...withHand(state, player, hand), board }, player);
    }
    case 'replace': {
      if (!isDoubleAgent(move.card) || isSpy(move.card)) {
        return { ok: false, error: 'notDoubleAgent' };
      }
      const { target } = move;
      const victim = getPlaced(state.board, target);
      if (target.player === player || !victim) return { ok: false, error: 'invalidTarget' };
      if (target.suit !== move.card.suit) return { ok: false, error: 'wrongSuit' };
      // The 2 takes the slot with no spies; the old card joins your row keeping its spies.
      const swapped = replacePlaced(state.board, target, placed(move.card));
      const board = placeCard(swapped, player, victim);
      return endTurn({ ...withHand(state, player, hand), board }, player);
    }
    case 'replaceSpy': {
      if (move.card.suit !== 'spades' || !isDoubleAgent(move.card)) {
        return { ok: false, error: 'notDoubleAgent' };
      }
      const { own, spyIndex, target } = move;
      if (target.player === player || !getPlaced(state.board, target)) {
        return { ok: false, error: 'invalidTarget' };
      }
      if (own.player !== player || !getPlaced(state.board, own)?.spies[spyIndex]) {
        return { ok: false, error: 'invalidSpy' };
      }
      const { spy } = removeSpy(state.board, own, spyIndex);
      const swapped = replaceSpy(state.board, own, spyIndex, move.card);
      const board = addSpy(swapped, target, spy);
      return endTurn({ ...withHand(state, player, hand), board }, player);
    }
    case 'trade': {
      if (!isSpy(move.card)) return { ok: false, error: 'notSpy' };
      if (state.tradesThisTurn >= state.settings.tradesPerTurn) {
        return { ok: false, error: 'tradeLimitReached' };
      }
      // An empty deck still discards the Spy and draws nothing.
      const { drawn, deck } = draw(state.deck, 1);
      const traded: GameState = {
        ...withHand(state, player, [...hand, ...drawn]),
        deck,
        outOfPlay: [...state.outOfPlay, move.card],
        tradesThisTurn: state.tradesThisTurn + 1,
      };
      if (traded.tradesThisTurn < state.settings.tradesPerTurn) {
        return { ok: true, state: settleTurn(traded, player) };
      }
      return endTurn(traded, player);
    }
  }
}
