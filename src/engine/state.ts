// Game state and setup: dealing, the face-down discard step and the per-player view.

import { emptyBoard, type Board, type Player } from './board';
import { cardId, type Card } from './cards';
import { createRng, draw, newDeck, shuffle, type Deck } from './deck';

/** Cards dealt to each player at the start. */
export const DEAL_SIZE = 15;

/** Cards each player discards during setup. */
export const DISCARD_SIZE = 5;

/** Where the game is: choosing discards, or playing (later items add round and game end). */
export type Phase = 'setup' | 'playing';

/** The whole game, including hidden information; never send this to a client. */
export type GameState = {
  readonly phase: Phase;
  /** The seed the game was created with; later reshuffles derive from it. */
  readonly seed: number;
  /** Each player's hand. */
  readonly hands: readonly [readonly Card[], readonly Card[]];
  /** The draw pile, top first. */
  readonly deck: Deck;
  readonly board: Board;
  /** Face-down setup discards per player; null until that player has discarded. */
  readonly setupDiscards: readonly [readonly Card[] | null, readonly Card[] | null];
};

/** Choose the cards to discard during setup (the Turns task folds this into `Move`). */
export type DiscardMove = {
  readonly type: 'discard';
  readonly player: Player;
  readonly cards: readonly Card[];
};

/** Why a move was refused. */
export type MoveError =
  | 'wrongPhase'
  | 'alreadyDiscarded'
  | 'wrongDiscardCount'
  | 'cardNotInHand'
  | 'duplicateCard';

/** The outcome of a move: the new state, or a typed error (never a throw). */
export type MoveResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: MoveError };

/** What one player may see: own hand, opponent's hand size, deck size and the board. */
export type PlayerView = {
  readonly phase: Phase;
  readonly player: Player;
  readonly hand: readonly Card[];
  readonly opponentHandSize: number;
  readonly deckSize: number;
  readonly board: Board;
  /** Whether this player has made the setup discard. */
  readonly hasDiscarded: boolean;
  /** Whether the opponent has made the setup discard (the cards stay hidden). */
  readonly opponentHasDiscarded: boolean;
};

/** Shuffle a fresh deck with the seed, deal 15 to each player and start the setup phase. */
export function newGame(seed: number): GameState {
  const deck = shuffle(newDeck(), createRng(seed));
  const first = draw(deck, DEAL_SIZE);
  const second = draw(first.deck, DEAL_SIZE);
  return {
    phase: 'setup',
    seed,
    hands: [first.drawn, second.drawn],
    deck: second.deck,
    board: emptyBoard(),
    setupDiscards: [null, null],
  };
}

/**
 * Apply a setup discard. Players may discard in either order; once both have, the
 * discards are shuffled back into the deck (using the seed) and play begins.
 */
export function applyDiscard(state: GameState, move: DiscardMove): MoveResult {
  if (state.phase !== 'setup') return { ok: false, error: 'wrongPhase' };
  const { player, cards } = move;
  if (state.setupDiscards[player] !== null) return { ok: false, error: 'alreadyDiscarded' };
  if (cards.length !== DISCARD_SIZE) return { ok: false, error: 'wrongDiscardCount' };

  const ids = cards.map(cardId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'duplicateCard' };
  const handIds = new Set(state.hands[player].map(cardId));
  if (!ids.every((id) => handIds.has(id))) return { ok: false, error: 'cardNotInHand' };

  const discarded = new Set(ids);
  const hand = state.hands[player].filter((c) => !discarded.has(cardId(c)));
  const hands: [readonly Card[], readonly Card[]] =
    player === 0 ? [hand, state.hands[1]] : [state.hands[0], hand];
  const setupDiscards: [readonly Card[] | null, readonly Card[] | null] =
    player === 0 ? [cards, state.setupDiscards[1]] : [state.setupDiscards[0], cards];

  const [d0, d1] = setupDiscards;
  if (d0 === null || d1 === null) {
    return { ok: true, state: { ...state, hands, setupDiscards } };
  }
  const deck = shuffle([...state.deck, ...d0, ...d1], createRng(state.seed ^ 0x5eed));
  return {
    ok: true,
    state: { ...state, phase: 'playing', hands, deck, setupDiscards: [null, null] },
  };
}

/** The view for one player; reveals nothing hidden about the opponent, the deck order or discards. */
export function viewFor(state: GameState, player: Player): PlayerView {
  const other: Player = player === 0 ? 1 : 0;
  return {
    phase: state.phase,
    player,
    hand: state.hands[player],
    opponentHandSize: state.hands[other].length,
    deckSize: state.deck.length,
    board: state.board,
    hasDiscarded: state.setupDiscards[player] !== null,
    opponentHasDiscarded: state.setupDiscards[other] !== null,
  };
}
