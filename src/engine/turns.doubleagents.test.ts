import {
  addSpy,
  allBoardCards,
  cardValue,
  emptyBoard,
  placed,
  placeCard,
  rowTotal,
  sideTotal,
  type Board,
  type CardRef,
  type Player,
} from './board';
import { cardId, makeCard, type Card } from './cards';
import { newGame, type GameState } from './state';
import { applyMove, legalMoves, type Move } from './turns';

const C = (rank: Card['rank'], suit: Card['suit']) => makeCard(rank, suit);

function playing(hands: [Card[], Card[]], board: Board, turn: Player = 0): GameState {
  return { ...newGame(1), phase: 'playing', hands, deck: [C(9, 'clubs')], board, turn };
}

function ok(state: GameState, move: Move): GameState {
  const r = applyMove(state, move);
  if (!r.ok) throw new Error(`unexpected error ${r.error}`);
  return r.state;
}

function err(state: GameState, move: Move): string {
  const r = applyMove(state, move);
  if (r.ok) throw new Error('expected an error');
  return r.error;
}

type Row = 'clubs' | 'hearts' | 'diamonds';
const oppRef = (suit: Row, index = 0) => ({ player: 1 as const, suit, index });
const oppSide = (cards: Card[]) => cards.reduce((b, c) => placeCard(b, 1, placed(c)), emptyBoard());

describe('2 of Clubs, Hearts or Diamonds', () => {
  const spiedJack = () => addSpy(oppSide([C(11, 'hearts')]), oppRef('hearts'), C(5, 'spades'));
  const replaceJack: Move = {
    type: 'replace',
    player: 0,
    card: C(2, 'hearts'),
    target: oppRef('hearts'),
  };
  const start = () => playing([[C(2, 'hearts')], [C(3, 'clubs')]], spiedJack());

  it('replaces an opponent card of the same suit; the 2 starts with no spies', () => {
    const s = ok(start(), replaceJack);
    expect(s.board[1].hearts.map((p) => cardId(p.card))).toEqual(['2H']);
    expect(s.board[1].hearts[0].spies).toEqual([]);
    expect(s.hands[0]).toHaveLength(0);
    expect(s.turn).toBe(1);
  });

  it('moves the replaced card to your matching row, keeping its spies', () => {
    const s = ok(start(), replaceJack);
    expect(s.board[0].hearts.map((p) => cardId(p.card))).toEqual(['JH']);
    expect(s.board[0].hearts[0].spies.map(cardId)).toEqual(['5S']);
  });

  it('scores as the README says: opponent 1 for the 2, you the replaced current value', () => {
    const s = ok(start(), replaceJack);
    expect(rowTotal(s.board, 0, 'hearts')).toBe(1); // Jack 2 minus a 5 spy
    expect(rowTotal(s.board, 1, 'hearts')).toBe(1);
    const ace = playing([[C(2, 'clubs')], [C(3, 'hearts')]], oppSide([C(14, 'clubs')]));
    const after = ok(ace, { ...replaceJack, card: C(2, 'clubs'), target: oppRef('clubs') });
    expect(sideTotal(after.board, 0)).toBe(3);
    expect(sideTotal(after.board, 1)).toBe(1);
  });

  it('can replace an Ace and any card in a longer row, leaving the rest in place', () => {
    const board = oppSide([C(5, 'clubs'), C(14, 'clubs'), C(9, 'clubs')]);
    const s = ok(playing([[C(2, 'clubs')], [C(3, 'hearts')]], board), {
      ...replaceJack,
      card: C(2, 'clubs'),
      target: oppRef('clubs', 1),
    });
    expect(s.board[1].clubs.map((p) => cardId(p.card))).toEqual(['5C', '2C', '9C']);
    expect(cardId(s.board[0].clubs[0].card)).toBe('AC');
  });

  it('can replace an opponent 2 of the same suit', () => {
    const s = ok(
      playing([[C(2, 'hearts')], [C(3, 'clubs')]], oppSide([C(2, 'hearts')])),
      replaceJack,
    );
    expect(s.board[0].hearts).toHaveLength(1);
    expect(s.board[1].hearts).toHaveLength(1);
  });

  it('refuses a different suit, your own side, a missing card and a card that is not a 2', () => {
    const s = playing([[C(2, 'clubs'), C(5, 'hearts')], [C(3, 'hearts')]], spiedJack());
    const mv = (card: Card, target: CardRef): Move => ({
      type: 'replace',
      player: 0,
      card,
      target,
    });
    expect(err(s, mv(C(2, 'clubs'), oppRef('hearts')))).toBe('wrongSuit');
    expect(err(s, mv(C(2, 'clubs'), oppRef('clubs')))).toBe('invalidTarget');
    expect(err(s, mv(C(2, 'clubs'), { ...oppRef('clubs'), player: 0 }))).toBe('invalidTarget');
    expect(err(s, mv(C(5, 'hearts'), oppRef('hearts')))).toBe('notDoubleAgent');
  });

  it('is offered only for a matching suit, next to playing normally, and every option applies', () => {
    const s = playing(
      [[C(2, 'hearts')], [C(3, 'clubs')]],
      oppSide([C(11, 'hearts'), C(4, 'clubs')]),
    );
    const moves = legalMoves(s);
    expect(moves.filter((m) => m.type === 'replace')).toEqual([replaceJack]);
    expect(moves).toContainEqual({ type: 'play', player: 0, card: C(2, 'hearts') });
    for (const m of moves) expect(applyMove(s, m).ok).toBe(true);
  });

  it('has no replace option without an opponent card of that suit, but still plays normally', () => {
    const s = playing([[C(2, 'diamonds')], [C(3, 'clubs')]], oppSide([C(4, 'clubs')]));
    expect(legalMoves(s).some((m) => m.type === 'replace')).toBe(false);
    const after = ok(s, { type: 'play', player: 0, card: C(2, 'diamonds') });
    expect(rowTotal(after.board, 0, 'diamonds')).toBe(1);
  });
});

describe('2 of Spades', () => {
  /** My jack of hearts carrying a 6 of spades, and an opponent king of clubs. */
  const board = (): Board => {
    const mine = placeCard(emptyBoard(), 0, placed(C(11, 'hearts')));
    const spied = addSpy(mine, own, C(6, 'spades'));
    return placeCard(spied, 1, placed(C(13, 'clubs')));
  };
  const own = { player: 0 as const, suit: 'hearts' as const, index: 0 };
  const target = oppRef('clubs');
  const swap: Move = {
    type: 'replaceSpy',
    player: 0,
    card: C(2, 'spades'),
    own,
    spyIndex: 0,
    target,
  };
  const start = () => playing([[C(2, 'spades')], [C(3, 'clubs')]], board());

  it('takes the spy place on my card (1 point) and puts the removed spy on an opponent card', () => {
    const s = ok(start(), swap);
    expect(s.board[0].hearts[0].spies.map(cardId)).toEqual(['2S']);
    expect(cardValue(s.board[0].hearts[0])).toBe(1);
    expect(s.board[1].clubs[0].spies.map(cardId)).toEqual(['6S']);
    expect(cardValue(s.board[1].clubs[0])).toBe(1);
    expect(s.hands[0]).toHaveLength(0);
    expect(s.turn).toBe(1);
  });

  it('loses no card: the board holds what it did plus the 2', () => {
    const s = ok(start(), swap);
    expect(allBoardCards(s.board).map(cardId).sort()).toEqual(
      [...allBoardCards(board()).map(cardId), '2S'].sort(),
    );
  });

  it('is not allowed when the opponent has no cards', () => {
    const mine = addSpy(placeCard(emptyBoard(), 0, placed(C(11, 'hearts'))), own, C(6, 'spades'));
    const s = playing([[C(2, 'spades')], [C(3, 'clubs')]], mine);
    expect(legalMoves(s).some((m) => m.type === 'replaceSpy')).toBe(false);
    expect(err(s, swap)).toBe('invalidTarget');
  });

  it('is not allowed without a spy on one of my cards', () => {
    const bare = placeCard(
      placeCard(emptyBoard(), 0, placed(C(11, 'hearts'))),
      1,
      placed(C(13, 'clubs')),
    );
    const s = playing([[C(2, 'spades')], [C(3, 'clubs')]], bare);
    expect(legalMoves(s).some((m) => m.type === 'replaceSpy')).toBe(false);
    expect(err(s, swap)).toBe('invalidSpy');
  });

  it('refuses a bad spy index, a spy on the opponent side, a bad target and a card that is not the 2', () => {
    const s = start();
    expect(err(s, { ...swap, spyIndex: 1 } as Move)).toBe('invalidSpy');
    expect(err(s, { ...swap, own: { ...own, player: 1 } } as Move)).toBe('invalidSpy');
    expect(err(s, { ...swap, target: own } as Move)).toBe('invalidTarget');
    const sixes = playing([[C(6, 'spades')], [C(3, 'clubs')]], board());
    expect(err(sixes, { ...swap, card: C(6, 'spades') } as Move)).toBe('notDoubleAgent');
  });

  it('plays as a normal 1-point spy on an opponent card', () => {
    const s = ok(start(), { type: 'spy', player: 0, card: C(2, 'spades'), target });
    expect(cardValue(s.board[1].clubs[0])).toBe(1);
  });

  it('is offered once per own spy and opponent target, and every option applies', () => {
    const s = start();
    const moves = legalMoves(s);
    expect(moves.filter((m) => m.type === 'replaceSpy')).toEqual([swap]);
    expect(moves.map((m) => m.type).sort()).toEqual(['pass', 'replaceSpy', 'spy', 'trade']);
    for (const m of moves) expect(applyMove(s, m).ok).toBe(true);
  });
});
