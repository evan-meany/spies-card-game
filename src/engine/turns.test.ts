import { cardValue, emptyBoard, placed, placeCard, type Board, type Player } from './board';
import { cardId, makeCard, type Card } from './cards';
import { DEFAULT_RULES, DISCARD_SIZE, newGame, viewFor, type GameState } from './state';
import { applyMove, bothPassed, legalMoves, type Move } from './turns';

const C = (rank: Card['rank'], suit: Card['suit']) => makeCard(rank, suit);

/** A playing-phase state with chosen hands, board and deck (turn: player 0 unless given). */
function playing(
  hands: [Card[], Card[]],
  opts: {
    board?: Board;
    deck?: Card[];
    turn?: Player;
    settings?: GameState['settings'];
  } = {},
): GameState {
  return {
    ...newGame(1, opts.settings),
    phase: 'playing',
    hands,
    deck: opts.deck ?? [C(9, 'clubs'), C(8, 'clubs'), C(7, 'clubs')],
    board: opts.board ?? emptyBoard(),
    turn: opts.turn ?? 0,
  };
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

const withOpponentJack = (): Board => placeCard(emptyBoard(), 1, placed(C(11, 'hearts')));

describe('playing a suit card', () => {
  it('places it on your own side in its suit row and passes the turn', () => {
    const s = ok(playing([[C(5, 'hearts'), C(6, 'clubs')], [C(3, 'clubs')]]), {
      type: 'play',
      player: 0,
      card: C(5, 'hearts'),
    });
    expect(s.board[0].hearts.map((p) => cardId(p.card))).toEqual(['5H']);
    expect(s.hands[0].map(cardId)).toEqual(['6C']);
    expect(s.turn).toBe(1);
  });

  it('refuses a card not in hand, a Spade, and moves out of turn', () => {
    const s = playing([[C(5, 'hearts'), C(6, 'spades')], [C(3, 'clubs')]]);
    expect(err(s, { type: 'play', player: 0, card: C(7, 'hearts') })).toBe('cardNotInHand');
    expect(err(s, { type: 'play', player: 0, card: C(6, 'spades') })).toBe('notSuitCard');
    expect(err(s, { type: 'play', player: 1, card: C(3, 'clubs') })).toBe('notYourTurn');
  });

  it('refuses play moves during setup', () => {
    const s = newGame(1);
    expect(err(s, { type: 'play', player: 0, card: s.hands[0][0] })).toBe('wrongPhase');
  });

  it('plays a 2 of a row suit normally (special plays come later)', () => {
    const s = ok(playing([[C(2, 'diamonds')], [C(3, 'clubs')]]), {
      type: 'play',
      player: 0,
      card: C(2, 'diamonds'),
    });
    expect(s.board[0].diamonds).toHaveLength(1);
  });
});

describe('playing a spy', () => {
  const start = () =>
    playing([[C(6, 'spades'), C(5, 'clubs')], [C(3, 'clubs')]], {
      board: withOpponentJack(),
    });
  const target = { player: 1 as const, suit: 'hearts' as const, index: 0 };

  it('stacks the spy on the opponent card and lowers its value', () => {
    const s = ok(start(), {
      type: 'spy',
      player: 0,
      card: C(6, 'spades'),
      target,
    });
    expect(cardValue(s.board[1].hearts[0])).toBe(1);
    expect(s.hands[0].map(cardId)).toEqual(['5C']);
    expect(s.turn).toBe(1);
  });

  it('refuses a target on your own side or with no card', () => {
    const own = placeCard(withOpponentJack(), 0, placed(C(4, 'clubs')));
    const s = playing([[C(6, 'spades')], [C(3, 'clubs')]], { board: own });
    const own0 = { player: 0 as const, suit: 'clubs' as const, index: 0 };
    expect(err(s, { type: 'spy', player: 0, card: C(6, 'spades'), target: own0 })).toBe(
      'invalidTarget',
    );
    const none = { player: 1 as const, suit: 'clubs' as const, index: 0 };
    expect(err(s, { type: 'spy', player: 0, card: C(6, 'spades'), target: none })).toBe(
      'invalidTarget',
    );
  });

  it('refuses a non-spy card as a spy', () => {
    expect(err(start(), { type: 'spy', player: 0, card: C(5, 'clubs'), target })).toBe('notSpy');
  });

  it('only targets suit cards, never another spy (proposed reading)', () => {
    const s = ok(start(), {
      type: 'spy',
      player: 0,
      card: C(6, 'spades'),
      target,
    });
    const next = {
      ...s,
      turn: 0 as const,
      hands: [[C(7, 'spades')], s.hands[1]] as GameState['hands'],
    };
    const targets = legalMoves(next).filter((m) => m.type === 'spy');
    expect(targets).toEqual([{ type: 'spy', player: 0, card: C(7, 'spades'), target }]);
  });

  it('lets several spies stack and floors the value at 0', () => {
    let s = playing(
      [
        [C(6, 'spades'), C(7, 'spades')],
        [C(3, 'clubs'), C(4, 'clubs')],
      ],
      { board: withOpponentJack() },
    );
    s = ok(s, { type: 'spy', player: 0, card: C(6, 'spades'), target });
    s = ok(s, { type: 'pass', player: 1 });
    s = ok(s, { type: 'spy', player: 0, card: C(7, 'spades'), target });
    expect(s.board[1].hearts[0].spies).toHaveLength(2);
    expect(cardValue(s.board[1].hearts[0])).toBe(0);
  });
});

describe('trading a spy', () => {
  const start = (deck: Card[] = [C(9, 'clubs'), C(8, 'clubs')]) =>
    playing([[C(6, 'spades'), C(5, 'clubs')], [C(3, 'clubs')]], { deck });

  it('discards the spy, draws one card and uses the turn', () => {
    const s = ok(start(), { type: 'trade', player: 0, card: C(6, 'spades') });
    expect(s.hands[0].map(cardId)).toEqual(['5C', '9C']);
    expect(s.deck.map(cardId)).toEqual(['8C']);
    expect(s.turn).toBe(1);
  });

  it('refuses to trade a card that is not a spy', () => {
    expect(err(start(), { type: 'trade', player: 0, card: C(5, 'clubs') })).toBe('notSpy');
  });

  it('still discards the spy and draws nothing on an empty deck (proposed reading)', () => {
    const s = ok(start([]), { type: 'trade', player: 0, card: C(6, 'spades') });
    expect(s.hands[0].map(cardId)).toEqual(['5C']);
    expect(s.deck).toHaveLength(0);
  });

  it('is always offered while holding a spy, even with no targets', () => {
    const trades = legalMoves(start()).filter((m) => m.type === 'trade');
    expect(trades).toEqual([{ type: 'trade', player: 0, card: C(6, 'spades') }]);
  });

  it('honours tradesPerTurn: a second trade in a row only when the setting allows it', () => {
    const settings = { ...DEFAULT_RULES, tradesPerTurn: 2 };
    const two = playing([[C(6, 'spades'), C(7, 'spades')], [C(3, 'clubs')]], {
      settings,
    });
    const first = ok(two, { type: 'trade', player: 0, card: C(6, 'spades') });
    expect(first.turn).toBe(0);
    const second = ok(first, {
      type: 'trade',
      player: 0,
      card: C(7, 'spades'),
    });
    expect(second.turn).toBe(1);
    expect(second.tradesThisTurn).toBe(0);
  });

  it('uses the whole turn with the default of one trade', () => {
    const s = ok(start(), { type: 'trade', player: 0, card: C(6, 'spades') });
    expect(s.turn).toBe(1);
  });
});

describe('passing', () => {
  it('is final for the round and the opponent keeps taking turns', () => {
    let s = playing([[C(5, 'clubs')], [C(3, 'clubs'), C(4, 'clubs'), C(6, 'hearts')]]);
    s = ok(s, { type: 'pass', player: 0 });
    expect(s.turn).toBe(1);
    s = ok(s, { type: 'play', player: 1, card: C(3, 'clubs') });
    expect(s.turn).toBe(1);
    expect(err(s, { type: 'play', player: 0, card: C(5, 'clubs') })).toBe('alreadyPassed');
    s = { ...s, turn: 0 };
    expect(err(s, { type: 'pass', player: 0 })).toBe('alreadyPassed');
    expect(err(s, { type: 'play', player: 0, card: C(5, 'clubs') })).toBe('alreadyPassed');
  });

  it('ends the round when both have passed', () => {
    let s = playing([[C(5, 'clubs')], [C(3, 'clubs')]]);
    s = ok(s, { type: 'pass', player: 0 });
    s = ok(s, { type: 'pass', player: 1 });
    expect(bothPassed(s)).toBe(true);
    expect(legalMoves(s)).toEqual([]);
    expect(err(s, { type: 'play', player: 1, card: C(3, 'clubs') })).toBe('roundOver');
  });

  it('is always a legal move while playing', () => {
    expect(legalMoves(playing([[C(5, 'clubs')], [C(3, 'clubs')]]))).toContainEqual({
      type: 'pass',
      player: 0,
    });
  });
});

describe('auto-pass', () => {
  it('passes a player whose hand empties and leaves the opponent to continue', () => {
    let s = playing([[C(5, 'clubs')], [C(3, 'clubs'), C(4, 'clubs'), C(6, 'hearts')]]);
    s = ok(s, { type: 'play', player: 0, card: C(5, 'clubs') });
    s = ok(s, { type: 'play', player: 1, card: C(3, 'clubs') });
    expect(s.passed).toEqual([true, false]);
    expect(s.turn).toBe(1);
  });

  it('ends the round when both hands run out', () => {
    let s = playing([[C(5, 'clubs')], [C(3, 'clubs')]]);
    s = ok(s, { type: 'play', player: 0, card: C(5, 'clubs') });
    s = ok(s, { type: 'play', player: 1, card: C(3, 'clubs') });
    expect(bothPassed(s)).toBe(true);
  });

  it('does not pass a player who still holds a spy', () => {
    const s = playing([[C(6, 'spades')], [C(3, 'clubs'), C(4, 'clubs')]]);
    expect(legalMoves(s).some((m) => m.type === 'trade')).toBe(true);
    const after = ok(s, { type: 'trade', player: 0, card: C(6, 'spades') });
    expect(after.passed[0]).toBe(false);
  });

  it('passes a player left with no cards after trading away their only spy on an empty deck', () => {
    const s = ok(playing([[C(6, 'spades')], [C(3, 'clubs'), C(4, 'clubs')]], { deck: [] }), {
      type: 'trade',
      player: 0,
      card: C(6, 'spades'),
    });
    expect(s.passed).toEqual([true, false]);
    expect(s.turn).toBe(1);
  });
});

describe('legalMoves', () => {
  it('is empty during setup', () => {
    expect(legalMoves(newGame(1))).toEqual([]);
  });

  it('only lists the player to move, and every listed move applies', () => {
    const s = playing(
      [
        [C(5, 'clubs'), C(6, 'spades')],
        [C(3, 'clubs'), C(7, 'spades')],
      ],
      { board: withOpponentJack() },
    );
    const moves = legalMoves(s);
    expect(moves.every((m) => m.player === 0)).toBe(true);
    expect(moves.map((m) => m.type).sort()).toEqual(['pass', 'play', 'spy', 'trade']);
    for (const m of moves) expect(applyMove(s, m).ok).toBe(true);
  });
});

describe('setup through to play', () => {
  it('accepts discards via applyMove and starts with player 0 to move', () => {
    let s = newGame(9);
    for (const player of [0, 1] as const) {
      s = ok(s, {
        type: 'discard',
        player,
        cards: s.hands[player].slice(0, DISCARD_SIZE),
      });
    }
    expect(s.phase).toBe('playing');
    expect(s.turn).toBe(0);
    expect(legalMoves(s).length).toBeGreaterThan(1);
  });
});

describe('viewFor', () => {
  it('shows turn and passes but no opponent hand or deck order', () => {
    const s = playing([[C(5, 'clubs')], [C(3, 'clubs')]]);
    const view = viewFor(s, 0);
    expect(view.turn).toBe(0);
    expect(view.passed).toEqual([false, false]);
    expect(view.opponentHandSize).toBe(1);
    expect(JSON.stringify(view)).not.toContain('"deck":[');
    expect(Object.keys(view)).not.toContain('hands');
  });
});
