import {
  ALL_RANKS,
  ALL_SUITS,
  ROW_SUITS,
  cardId,
  cardPoints,
  cardToString,
  compareRank,
  isDoubleAgent,
  isSpy,
  makeCard,
  type Rank,
  type Suit,
} from './cards';

const allCards = ALL_SUITS.flatMap((suit) => ALL_RANKS.map((rank) => makeCard(rank, suit)));

describe('card sets', () => {
  it('has 4 suits, 13 ranks and 52 distinct cards', () => {
    expect(ALL_SUITS).toHaveLength(4);
    expect(ALL_RANKS).toHaveLength(13);
    expect(new Set(allCards.map(cardId)).size).toBe(52);
  });

  it('lists ranks lowest to highest with Ace high', () => {
    expect(ALL_RANKS[0]).toBe(2);
    expect(ALL_RANKS[12]).toBe(14);
  });

  it('has the three row suits and no spades', () => {
    expect([...ROW_SUITS]).toEqual(['clubs', 'hearts', 'diamonds']);
  });
});

describe('cardPoints', () => {
  const cases: [Rank, number][] = [
    [14, 3],
    [13, 2],
    [12, 2],
    [11, 2],
    [10, 2],
    [9, 1],
    [5, 1],
    [3, 1],
    [2, 1],
  ];
  it.each(cases)('rank %i is worth %i', (rank, points) => {
    expect(cardPoints(makeCard(rank, 'hearts'))).toBe(points);
  });

  it('does not depend on suit', () => {
    for (const suit of ALL_SUITS) expect(cardPoints(makeCard(14, suit))).toBe(3);
  });

  it('totals 4 * (3 + 4 * 2 + 8 * 1) points for a deck', () => {
    expect(allCards.reduce((sum, c) => sum + cardPoints(c), 0)).toBe(4 * (3 + 8 + 8));
  });
});

describe('compareRank', () => {
  it('puts Ace above King and 2 below 3', () => {
    expect(compareRank(makeCard(14, 'clubs'), makeCard(13, 'clubs'))).toBeGreaterThan(0);
    expect(compareRank(makeCard(2, 'clubs'), makeCard(3, 'clubs'))).toBeLessThan(0);
  });

  it('ignores suit, so equal ranks tie', () => {
    expect(compareRank(makeCard(7, 'spades'), makeCard(7, 'hearts'))).toBe(0);
  });
});

describe('isSpy and isDoubleAgent', () => {
  const suits: [Suit, boolean][] = [
    ['spades', true],
    ['clubs', false],
    ['hearts', false],
    ['diamonds', false],
  ];
  it.each(suits)('isSpy(%s) is %s', (suit, expected) => {
    expect(isSpy(makeCard(9, suit))).toBe(expected);
  });

  it('flags every 2, and only 2s, as double agents', () => {
    for (const card of allCards) expect(isDoubleAgent(card)).toBe(card.rank === 2);
  });

  it('treats the 2 of Spades as both a spy and a double agent', () => {
    const card = makeCard(2, 'spades');
    expect(isSpy(card) && isDoubleAgent(card)).toBe(true);
  });
});

describe('names', () => {
  it('builds ids', () => {
    expect(cardId(makeCard(14, 'spades'))).toBe('AS');
    expect(cardId(makeCard(10, 'hearts'))).toBe('10H');
    expect(cardId(makeCard(2, 'clubs'))).toBe('2C');
  });

  it('builds readable names', () => {
    expect(cardToString(makeCard(11, 'spades'))).toBe('Jack of Spades');
    expect(cardToString(makeCard(14, 'diamonds'))).toBe('Ace of Diamonds');
    expect(cardToString(makeCard(2, 'clubs'))).toBe('Two of Clubs');
  });
});
