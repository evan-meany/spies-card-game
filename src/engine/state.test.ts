import { cardId } from './cards';
import { DEAL_SIZE, DISCARD_SIZE, applyDiscard, newGame, viewFor, type GameState } from './state';

const idsOf = (cards: readonly Parameters<typeof cardId>[0][]) => cards.map(cardId);

function discardFirst(state: GameState, player: 0 | 1) {
  return applyDiscard(state, {
    type: 'discard',
    player,
    cards: state.hands[player].slice(0, DISCARD_SIZE),
  });
}

function expectOk(result: ReturnType<typeof applyDiscard>): GameState {
  if (!result.ok) throw new Error(`unexpected error ${result.error}`);
  return result.state;
}

describe('newGame', () => {
  it('deals 15 to each player and leaves 22 in the deck', () => {
    const g = newGame(1);
    expect(g.phase).toBe('setup');
    expect(g.hands[0]).toHaveLength(DEAL_SIZE);
    expect(g.hands[1]).toHaveLength(DEAL_SIZE);
    expect(g.deck).toHaveLength(22);
  });

  it('uses all 52 cards exactly once', () => {
    const g = newGame(2);
    const all = idsOf([...g.hands[0], ...g.hands[1], ...g.deck]);
    expect(new Set(all).size).toBe(52);
  });

  it('is deterministic for a seed and differs between seeds', () => {
    expect(newGame(7)).toEqual(newGame(7));
    expect(idsOf(newGame(7).hands[0])).not.toEqual(idsOf(newGame(8).hands[0]));
  });
});

describe('applyDiscard', () => {
  it('removes 5 cards from the hand and waits for the other player', () => {
    const s = expectOk(discardFirst(newGame(3), 0));
    expect(s.phase).toBe('setup');
    expect(s.hands[0]).toHaveLength(10);
    expect(s.hands[1]).toHaveLength(15);
    expect(s.deck).toHaveLength(22);
    expect(s.setupDiscards[0]).toHaveLength(5);
    expect(s.setupDiscards[1]).toBeNull();
  });

  it.each([
    [0, 1],
    [1, 0],
  ] as const)(
    'accepts either order (%i then %i): 10 cards each plus a flipped card, 30 in the deck',
    (a, b) => {
      const s = expectOk(discardFirst(expectOk(discardFirst(newGame(4), a)), b));
      expect(s.phase).toBe('playing');
      expect(s.hands[0].length + s.hands[1].length).toBe(22);
      expect(s.deck).toHaveLength(30);
      expect(s.setupDiscards).toEqual([null, null]);
    },
  );

  it('keeps all 52 cards after setup', () => {
    const s = expectOk(discardFirst(expectOk(discardFirst(newGame(5), 0)), 1));
    expect(new Set(idsOf([...s.hands[0], ...s.hands[1], ...s.deck])).size).toBe(52);
  });

  it('reshuffles the discards into the deck, not on top of it', () => {
    const start = newGame(6);
    const discards = idsOf([...start.hands[0].slice(0, 5), ...start.hands[1].slice(0, 5)]);
    const s = expectOk(discardFirst(expectOk(discardFirst(start, 0)), 1));
    expect(idsOf(s.deck).slice(0, 10)).not.toEqual(discards);
    const all = idsOf([...s.hands[0], ...s.hands[1], ...s.deck]);
    expect(discards.every((id) => all.includes(id))).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const run = () => expectOk(discardFirst(expectOk(discardFirst(newGame(9), 1)), 0));
    expect(run()).toEqual(run());
  });

  it('does not change the input state', () => {
    const g = newGame(10);
    const copy = JSON.stringify(g);
    discardFirst(g, 0);
    expect(JSON.stringify(g)).toBe(copy);
  });

  it('refuses a second discard from the same player', () => {
    const s = expectOk(discardFirst(newGame(11), 0));
    expect(discardFirst(s, 0)).toEqual({ ok: false, error: 'alreadyDiscarded' });
  });

  it('refuses the wrong number of cards', () => {
    const g = newGame(12);
    const r = applyDiscard(g, { type: 'discard', player: 0, cards: g.hands[0].slice(0, 4) });
    expect(r).toEqual({ ok: false, error: 'wrongDiscardCount' });
  });

  it('refuses cards not in the hand', () => {
    const g = newGame(13);
    const cards = [...g.hands[0].slice(0, 4), g.hands[1][0]];
    expect(applyDiscard(g, { type: 'discard', player: 0, cards })).toEqual({
      ok: false,
      error: 'cardNotInHand',
    });
  });

  it('refuses a repeated card', () => {
    const g = newGame(14);
    const c = g.hands[0][0];
    const cards = [c, c, ...g.hands[0].slice(1, 4)];
    expect(applyDiscard(g, { type: 'discard', player: 0, cards })).toEqual({
      ok: false,
      error: 'duplicateCard',
    });
  });

  it('refuses a discard once play has begun', () => {
    const s = expectOk(discardFirst(expectOk(discardFirst(newGame(15), 0)), 1));
    expect(discardFirst(s, 0)).toEqual({ ok: false, error: 'wrongPhase' });
  });
});

describe('viewFor', () => {
  it('shows own hand, opponent hand size and deck size', () => {
    const g = newGame(20);
    const v = viewFor(g, 1);
    expect(v.player).toBe(1);
    expect(v.hand).toEqual(g.hands[1]);
    expect(v.opponentHandSize).toBe(15);
    expect(v.deckSize).toBe(22);
  });

  it('does not contain the opponent hand or the deck cards', () => {
    const g = newGame(21);
    const text = JSON.stringify(viewFor(g, 0));
    for (const c of [...g.hands[1], ...g.deck]) {
      expect(text).not.toContain(`"rank":${c.rank},"suit":"${c.suit}"`);
    }
    expect(Object.keys(viewFor(g, 0)).sort()).toEqual(
      [
        'board',
        'deckSize',
        'hand',
        'hasDiscarded',
        'opponentHandSize',
        'opponentHasDiscarded',
        'passed',
        'phase',
        'player',
        'roundResults',
        'settings',
        'turn',
      ].sort(),
    );
  });

  it('shows that the opponent has discarded but not which cards', () => {
    const g = newGame(22);
    const s = expectOk(discardFirst(g, 1));
    const v = viewFor(s, 0);
    expect(v.opponentHasDiscarded).toBe(true);
    expect(v.hasDiscarded).toBe(false);
    expect(v.opponentHandSize).toBe(10);
    const text = JSON.stringify(v);
    for (const c of s.setupDiscards[1] ?? []) {
      expect(text).not.toContain(`"rank":${c.rank},"suit":"${c.suit}"`);
    }
  });
});
