import { makeCard } from './cards';
import {
  addSpy,
  allBoardCards,
  cardCount,
  cardValue,
  emptyBoard,
  getPlaced,
  moveCard,
  opponentOf,
  placeCard,
  placed,
  removeSpy,
  replacePlaced,
  replaceSpy,
  rowTotal,
  sideTotal,
  type CardRef,
} from './board';

const jackH = makeCard(11, 'hearts');
const aceH = makeCard(14, 'hearts');
const sixS = makeCard(6, 'spades');
const twoS = makeCard(2, 'spades');
const fiveC = makeCard(5, 'clubs');
const ref = (player: 0 | 1, suit: CardRef['suit'], index = 0): CardRef => ({ player, suit, index });

describe('empty board', () => {
  it('has no cards and zero totals', () => {
    const b = emptyBoard();
    expect(cardCount(b, 0)).toBe(0);
    expect(sideTotal(b, 1)).toBe(0);
    expect(rowTotal(b, 0, 'clubs')).toBe(0);
  });
});

describe('opponentOf', () => {
  it('flips the player', () => {
    expect(opponentOf(0)).toBe(1);
    expect(opponentOf(1)).toBe(0);
  });
});

describe('placeCard', () => {
  it('puts cards in the matching row on the right side, leaving the input alone', () => {
    const b0 = emptyBoard();
    const b1 = placeCard(b0, 0, placed(jackH));
    expect(b0[0].hearts).toHaveLength(0);
    expect(b1[0].hearts).toHaveLength(1);
    expect(b1[1].hearts).toHaveLength(0);
    expect(b1[0].clubs).toHaveLength(0);
  });

  it('keeps play order within a row', () => {
    let b = placeCard(emptyBoard(), 1, placed(jackH));
    b = placeCard(b, 1, placed(aceH));
    expect(b[1].hearts.map((p) => p.card)).toEqual([jackH, aceH]);
  });

  it('rejects spades', () => {
    expect(() => placeCard(emptyBoard(), 0, placed(sixS))).toThrow();
  });
});

describe('cardValue', () => {
  const cases: [string, ReturnType<typeof placed>, number][] = [
    ['unspied Jack', placed(jackH), 2],
    ['unspied Ace', placed(aceH), 3],
    ['Jack under a 6 spy', { card: jackH, spies: [sixS] }, 1],
    ['Jack under two spies hits 0', { card: jackH, spies: [sixS, sixS] }, 0],
    ['Jack under three spies stays at 0', { card: jackH, spies: [sixS, sixS, twoS] }, 0],
    ['Ace under three 1-point spies', { card: aceH, spies: [sixS, sixS, twoS] }, 0],
    ['Ace under one spy', { card: aceH, spies: [twoS] }, 2],
    ['5 under a 2 of spades', { card: fiveC, spies: [twoS] }, 0],
  ];
  it.each(cases)('%s', (_name, p, expected) => {
    expect(cardValue(p)).toBe(expected);
  });

  it('subtracts a high spy at its full value, floored at 0', () => {
    const kingS = makeCard(13, 'spades');
    expect(cardValue({ card: aceH, spies: [kingS] })).toBe(1);
    expect(cardValue({ card: jackH, spies: [kingS, kingS] })).toBe(0);
  });
});

describe('totals', () => {
  it('sums row values with spies and floors each card, not the row', () => {
    let b = placeCard(emptyBoard(), 0, placed(jackH));
    b = placeCard(b, 0, placed(aceH));
    b = addSpy(b, ref(0, 'hearts', 0), sixS);
    b = addSpy(b, ref(0, 'hearts', 0), sixS);
    b = addSpy(b, ref(0, 'hearts', 0), sixS);
    expect(rowTotal(b, 0, 'hearts')).toBe(3);
    expect(rowTotal(b, 1, 'hearts')).toBe(0);
  });

  it('adds the three rows for a side total', () => {
    let b = placeCard(emptyBoard(), 1, placed(jackH));
    b = placeCard(b, 1, placed(fiveC));
    b = placeCard(b, 1, placed(makeCard(14, 'diamonds')));
    expect(sideTotal(b, 1)).toBe(2 + 1 + 3);
    expect(cardCount(b, 1)).toBe(3);
  });
});

describe('spy helpers', () => {
  const base = addSpy(placeCard(emptyBoard(), 0, placed(jackH)), ref(0, 'hearts'), sixS);

  it('addSpy stacks spies in order and leaves the input alone', () => {
    const b2 = addSpy(base, ref(0, 'hearts'), twoS);
    expect(getPlaced(b2, ref(0, 'hearts'))?.spies).toEqual([sixS, twoS]);
    expect(getPlaced(base, ref(0, 'hearts'))?.spies).toEqual([sixS]);
  });

  it('removeSpy returns the spy and the board without it', () => {
    const { board, spy } = removeSpy(base, ref(0, 'hearts'), 0);
    expect(spy).toEqual(sixS);
    expect(getPlaced(board, ref(0, 'hearts'))?.spies).toEqual([]);
  });

  it('replaceSpy swaps one spy in place', () => {
    const b = replaceSpy(base, ref(0, 'hearts'), 0, twoS);
    expect(getPlaced(b, ref(0, 'hearts'))?.spies).toEqual([twoS]);
  });

  it('rejects bad positions', () => {
    expect(() => addSpy(base, ref(1, 'hearts'), sixS)).toThrow();
    expect(() => removeSpy(base, ref(0, 'hearts'), 3)).toThrow();
    expect(() => replaceSpy(base, ref(0, 'hearts'), 5, twoS)).toThrow();
  });
});

describe('replacePlaced', () => {
  it('swaps the card in its slot, dropping the old spies', () => {
    const b = addSpy(placeCard(emptyBoard(), 1, placed(aceH)), ref(1, 'hearts'), sixS);
    const b2 = replacePlaced(b, ref(1, 'hearts'), placed(makeCard(2, 'hearts')));
    expect(getPlaced(b2, ref(1, 'hearts'))).toEqual(placed(makeCard(2, 'hearts')));
    expect(rowTotal(b2, 1, 'hearts')).toBe(1);
  });
});

describe('moveCard', () => {
  it('moves a card with its spies to the other side, same row', () => {
    let b = placeCard(emptyBoard(), 1, placed(aceH));
    b = addSpy(b, ref(1, 'hearts'), sixS);
    const moved = moveCard(b, ref(1, 'hearts'), 0);
    expect(moved[1].hearts).toHaveLength(0);
    expect(moved[0].hearts).toEqual([{ card: aceH, spies: [sixS] }]);
    expect(rowTotal(moved, 0, 'hearts')).toBe(2);
  });

  it('appends after cards already in the destination row', () => {
    let b = placeCard(emptyBoard(), 0, placed(jackH));
    b = placeCard(b, 1, placed(aceH));
    const moved = moveCard(b, ref(1, 'hearts'), 0);
    expect(moved[0].hearts.map((p) => p.card)).toEqual([jackH, aceH]);
  });

  it('keeps the other cards in the source row in order', () => {
    let b = placeCard(emptyBoard(), 1, placed(jackH));
    b = placeCard(b, 1, placed(aceH));
    const moved = moveCard(b, ref(1, 'hearts', 0), 0);
    expect(moved[1].hearts.map((p) => p.card)).toEqual([aceH]);
  });

  it('loses no card', () => {
    let b = placeCard(emptyBoard(), 1, placed(aceH));
    b = addSpy(b, ref(1, 'hearts'), sixS);
    expect(allBoardCards(moveCard(b, ref(1, 'hearts'), 0))).toHaveLength(2);
  });

  it('rejects a missing card', () => {
    expect(() => moveCard(emptyBoard(), ref(0, 'clubs'), 1)).toThrow();
  });
});
