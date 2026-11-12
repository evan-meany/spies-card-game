// Cards: suits, ranks, point values and names. Pure data and functions; no I/O.

/** A card suit; spades are spies. */
export type Suit = 'clubs' | 'hearts' | 'diamonds' | 'spades';

/** A card rank as a number: 2 to 10, Jack 11, Queen 12, King 13, Ace 14 (high). */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** A playing card. */
export type Card = { readonly suit: Suit; readonly rank: Rank };

/** Every suit. */
export const ALL_SUITS: readonly Suit[] = ['clubs', 'hearts', 'diamonds', 'spades'];

/** Every rank, lowest to highest (Ace high). */
export const ALL_RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** The suits that go on a player's own board rows (everything but spades). */
export const ROW_SUITS: readonly Suit[] = ['clubs', 'hearts', 'diamonds'];

const RANK_NAMES: Record<Rank, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};

const RANK_SYMBOLS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: 'C',
  hearts: 'H',
  diamonds: 'D',
  spades: 'S',
};

/** Build a card. */
export function makeCard(rank: Rank, suit: Suit): Card {
  return { suit, rank };
}

/** Compare ranks for the round-start flip: negative, zero or positive (Ace high, suit ignored). */
export function compareRank(a: Card, b: Card): number {
  return a.rank - b.rank;
}

/** Base point value: Ace 3, 10 to King 2, 2 to 9 1. */
export function cardPoints(card: Card): number {
  if (card.rank === 14) return 3;
  if (card.rank >= 10) return 2;
  return 1;
}

/** True for any Spade (a Spy). */
export function isSpy(card: Card): boolean {
  return card.suit === 'spades';
}

/** True for any 2 (a Double Agent), including the 2 of Spades. */
export function isDoubleAgent(card: Card): boolean {
  return card.rank === 2;
}

/** A stable unique id such as "AS" or "10H". */
export function cardId(card: Card): string {
  return RANK_SYMBOLS[card.rank] + SUIT_SYMBOLS[card.suit];
}

/** A readable name such as "Ace of Spades". */
export function cardToString(card: Card): string {
  const suit = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
  return `${RANK_NAMES[card.rank]} of ${suit}`;
}
