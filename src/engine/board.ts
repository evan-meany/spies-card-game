// Board: two sides, each with Clubs, Hearts and Diamonds rows. Spies sit on cards.
// Boards are immutable; every helper returns a new board.

import { ROW_SUITS, cardPoints, type Card, type Suit } from './cards';

/** Which player: 0 is player 1, 1 is player 2. */
export type Player = 0 | 1;

/** A suit that has a row (every suit except spades). */
export type RowSuit = 'clubs' | 'hearts' | 'diamonds';

/** A card on the board with the spies stacked on it, oldest first. */
export type PlacedCard = { readonly card: Card; readonly spies: readonly Card[] };

/** One row: the cards placed in it, in play order. */
export type Row = readonly PlacedCard[];

/** One player's side: a row per row suit. */
export type Side = { readonly [S in RowSuit]: Row };

/** Both sides, indexed by player. */
export type Board = readonly [Side, Side];

/** Where a card lives: a player, a row and a position in it. */
export type CardRef = { readonly player: Player; readonly suit: RowSuit; readonly index: number };

/** True for a suit that has a board row. */
export function isRowSuit(suit: Suit): suit is RowSuit {
  return suit !== 'spades';
}

/** The other player. */
export function opponentOf(player: Player): Player {
  return player === 0 ? 1 : 0;
}

/** A board with no cards. */
export function emptyBoard(): Board {
  const side: Side = { clubs: [], hearts: [], diamonds: [] };
  return [side, side];
}

/** A placed card with no spies on it. */
export function placed(card: Card): PlacedCard {
  return { card, spies: [] };
}

/** A placed card's value: its points minus its spies' points, never below 0. */
export function cardValue(p: PlacedCard): number {
  const spied = p.spies.reduce((sum, spy) => sum + cardPoints(spy), 0);
  return Math.max(0, cardPoints(p.card) - spied);
}

/** The placed card at a reference, or undefined if there is none. */
export function getPlaced(board: Board, ref: CardRef): PlacedCard | undefined {
  return board[ref.player][ref.suit][ref.index];
}

/** Total value of one row. */
export function rowTotal(board: Board, player: Player, suit: RowSuit): number {
  return board[player][suit].reduce((sum, p) => sum + cardValue(p), 0);
}

/** Total value of a player's three rows. */
export function sideTotal(board: Board, player: Player): number {
  return ROW_SUITS.reduce((sum, suit) => sum + rowTotal(board, player, suit as RowSuit), 0);
}

/** How many cards (not counting spies) a player has on the board. */
export function cardCount(board: Board, player: Player): number {
  return ROW_SUITS.reduce((n, suit) => n + board[player][suit as RowSuit].length, 0);
}

/** Every card on the board, spies included, for checking that none are lost. */
export function allBoardCards(board: Board): Card[] {
  return ([0, 1] as const).flatMap((player) =>
    ROW_SUITS.flatMap((suit) =>
      board[player][suit as RowSuit].flatMap((p) => [p.card, ...p.spies]),
    ),
  );
}

function withRow(board: Board, player: Player, suit: RowSuit, row: Row): Board {
  const side: Side = { ...board[player], [suit]: row };
  return player === 0 ? [side, board[1]] : [board[0], side];
}

/** Put a card on a player's side at the end of its suit row. Spades have no row and throw. */
export function placeCard(board: Board, player: Player, p: PlacedCard): Board {
  const suit = p.card.suit;
  if (!isRowSuit(suit)) throw new Error('Spades cannot be placed in a row');
  return withRow(board, player, suit, [...board[player][suit], p]);
}

/** Stack a spy on the card at `ref`. */
export function addSpy(board: Board, ref: CardRef, spy: Card): Board {
  const target = getPlaced(board, ref);
  if (!target) throw new Error('No card at that position');
  return replacePlaced(board, ref, { ...target, spies: [...target.spies, spy] });
}

/** Remove the spy at `spyIndex` from the card at `ref`; returns the new board and the spy. */
export function removeSpy(
  board: Board,
  ref: CardRef,
  spyIndex: number,
): { board: Board; spy: Card } {
  const target = getPlaced(board, ref);
  const spy = target?.spies[spyIndex];
  if (!target || !spy) throw new Error('No spy at that position');
  const spies = target.spies.filter((_, i) => i !== spyIndex);
  return { board: replacePlaced(board, ref, { ...target, spies }), spy };
}

/** Swap the spy at `spyIndex` on the card at `ref` for another spy in the same place. */
export function replaceSpy(board: Board, ref: CardRef, spyIndex: number, spy: Card): Board {
  const target = getPlaced(board, ref);
  if (!target || spyIndex < 0 || spyIndex >= target.spies.length) {
    throw new Error('No spy at that position');
  }
  const spies = target.spies.map((s, i) => (i === spyIndex ? spy : s));
  return replacePlaced(board, ref, { ...target, spies });
}

/** Put a different placed card in the slot at `ref`. */
export function replacePlaced(board: Board, ref: CardRef, p: PlacedCard): Board {
  if (!getPlaced(board, ref)) throw new Error('No card at that position');
  const row = board[ref.player][ref.suit].map((old, i) => (i === ref.index ? p : old));
  return withRow(board, ref.player, ref.suit, row);
}

/** Move the card at `ref`, spies and all, to the end of the same suit row on `toPlayer`'s side. */
export function moveCard(board: Board, ref: CardRef, toPlayer: Player): Board {
  const target = getPlaced(board, ref);
  if (!target) throw new Error('No card at that position');
  const row = board[ref.player][ref.suit].filter((_, i) => i !== ref.index);
  const removed = withRow(board, ref.player, ref.suit, row);
  return withRow(removed, toPlayer, ref.suit, [...removed[toPlayer][ref.suit], target]);
}

