// Deck: a seeded random number generator, a 52-card deck, shuffle, draw and add.
// Decks are plain arrays that are never mutated; the top of the deck is index 0.

import { ALL_RANKS, ALL_SUITS, makeCard, type Card } from './cards';

/** A random number source returning floats in [0, 1). */
export type Rng = () => number;

/** A deck: cards in order, top first. */
export type Deck = readonly Card[];

/** A small seeded generator (mulberry32); the same seed gives the same sequence. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh, ordered 52-card deck. */
export function newDeck(): Deck {
  return ALL_SUITS.flatMap((suit) => ALL_RANKS.map((rank) => makeCard(rank, suit)));
}

/** A shuffled copy of the cards (Fisher-Yates); the input is left unchanged. */
export function shuffle(cards: readonly Card[], rng: Rng): Card[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Take up to `count` cards from the top; an empty or short deck yields fewer, never an error. */
export function draw(deck: Deck, count = 1): { drawn: Card[]; deck: Deck } {
  const n = Math.max(0, Math.min(count, deck.length));
  return { drawn: deck.slice(0, n), deck: deck.slice(n) };
}

/** A new deck with the cards added at the bottom, in order. */
export function addCards(deck: Deck, cards: readonly Card[]): Deck {
  return [...deck, ...cards];
}
