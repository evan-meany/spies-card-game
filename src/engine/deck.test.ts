import { cardId } from './cards';
import { addCards, createRng, draw, newDeck, shuffle } from './deck';

const ids = (cards: readonly { suit: string; rank: number }[]) =>
  cards.map((c) => cardId(c as Parameters<typeof cardId>[0]));

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 10 }, a)).toEqual(Array.from({ length: 10 }, b));
  });

  it('gives different sequences for different seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('newDeck', () => {
  it('has 52 distinct cards', () => {
    const deck = newDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(ids(deck)).size).toBe(52);
  });
});

describe('shuffle', () => {
  it('is deterministic for a seed', () => {
    expect(shuffle(newDeck(), createRng(5))).toEqual(shuffle(newDeck(), createRng(5)));
  });

  it('differs between seeds', () => {
    expect(ids(shuffle(newDeck(), createRng(5)))).not.toEqual(ids(shuffle(newDeck(), createRng(6))));
  });

  it('loses and duplicates no card, and actually reorders', () => {
    const original = newDeck();
    const shuffled = shuffle(original, createRng(99));
    expect(ids(shuffled).sort()).toEqual(ids(original).sort());
    expect(ids(shuffled)).not.toEqual(ids(original));
  });

  it('returns a new array and leaves the input alone', () => {
    const original = newDeck();
    const copy = [...original];
    const shuffled = shuffle(original, createRng(3));
    expect(shuffled).not.toBe(original);
    expect(original).toEqual(copy);
  });

  it('handles empty and single-card input', () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    expect(shuffle(newDeck().slice(0, 1), createRng(1))).toHaveLength(1);
  });
});

describe('draw', () => {
  it('takes one card from the top by default', () => {
    const deck = newDeck();
    const { drawn, deck: rest } = draw(deck);
    expect(drawn).toEqual([deck[0]]);
    expect(rest).toHaveLength(51);
    expect(deck).toHaveLength(52);
  });

  it('takes several cards in order', () => {
    const deck = newDeck();
    const { drawn, deck: rest } = draw(deck, 15);
    expect(drawn).toEqual(deck.slice(0, 15));
    expect(rest).toEqual(deck.slice(15));
  });

  it('yields nothing from an empty deck', () => {
    expect(draw([])).toEqual({ drawn: [], deck: [] });
  });

  it('yields what is left when asked for more than the deck holds', () => {
    const deck = newDeck().slice(0, 2);
    const { drawn, deck: rest } = draw(deck, 5);
    expect(drawn).toHaveLength(2);
    expect(rest).toEqual([]);
  });

  it('draws nothing for a count of 0 or less', () => {
    const deck = newDeck();
    expect(draw(deck, 0).drawn).toEqual([]);
    expect(draw(deck, -3).deck).toEqual(deck);
  });
});

describe('addCards', () => {
  it('adds to the bottom without changing the input', () => {
    const deck = newDeck();
    const { drawn, deck: rest } = draw(deck, 3);
    const back = addCards(rest, drawn);
    expect(back).toHaveLength(52);
    expect(back.slice(-3)).toEqual(drawn);
    expect(rest).toHaveLength(49);
  });
});
