'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// The reorder splice logic from app.js reorderGames(), without browser side-effects
// (localStorage write and renderSchedule call are omitted — they don't affect the
// array mutation being tested here).
function applyReorder(games, fromIdx, toIdx) {
  if (fromIdx === toIdx || toIdx === fromIdx + 1) return;
  const [item] = games.splice(fromIdx, 1);
  games.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, item);
}

function makeSampleGames() {
  return [
    { gameNumber: 1, nearSide: ['Alice', 'Bob'],   farSide: ['Carol', 'Dave'], sittingOut: [] },
    { gameNumber: 2, nearSide: ['Alice', 'Carol'],  farSide: ['Bob',   'Dave'], sittingOut: [] },
    { gameNumber: 3, nearSide: ['Alice', 'Dave'],   farSide: ['Bob',  'Carol'], sittingOut: [] },
    { gameNumber: 4, nearSide: ['Bob',   'Carol'],  farSide: ['Alice', 'Dave'], sittingOut: [] },
  ];
}

// Snapshot players keyed by gameNumber so assertions survive reordering
function snapshotPlayers(games) {
  return Object.fromEntries(games.map(g => [
    g.gameNumber,
    { nearSide: [...g.nearSide], farSide: [...g.farSide] },
  ]));
}

describe('drag reorder — order changes, player assignments unchanged', () => {

  test('dragging a game to an earlier slot', () => {
    const games = makeSampleGames();
    const before = snapshotPlayers(games);

    // simulate dragging game at index 2 (G3) up to slot 0
    applyReorder(games, 2, 0);

    assert.deepEqual(
      games.map(g => g.gameNumber),
      [3, 1, 2, 4],
      'game order should reflect the drag',
    );

    for (const game of games) {
      assert.deepEqual(game.nearSide, before[game.gameNumber].nearSide, `game ${game.gameNumber} nearSide changed`);
      assert.deepEqual(game.farSide,  before[game.gameNumber].farSide,  `game ${game.gameNumber} farSide changed`);
    }
  });

  test('dragging a game to a later slot', () => {
    const games = makeSampleGames();
    const before = snapshotPlayers(games);

    // simulate dragging game at index 0 (G1) down to after slot 2 (toIdx = 3)
    applyReorder(games, 0, 3);

    assert.deepEqual(
      games.map(g => g.gameNumber),
      [2, 3, 1, 4],
      'game order should reflect the drag',
    );

    for (const game of games) {
      assert.deepEqual(game.nearSide, before[game.gameNumber].nearSide, `game ${game.gameNumber} nearSide changed`);
      assert.deepEqual(game.farSide,  before[game.gameNumber].farSide,  `game ${game.gameNumber} farSide changed`);
    }
  });

  test('dropping onto the same row is a no-op', () => {
    const games = makeSampleGames();
    const orderBefore = games.map(g => g.gameNumber);

    applyReorder(games, 1, 1); // same index — no move
    applyReorder(games, 1, 2); // adjacent below — no move

    assert.deepEqual(games.map(g => g.gameNumber), orderBefore);
  });

  test('dragging the last game to first slot', () => {
    const games = makeSampleGames();
    const before = snapshotPlayers(games);

    applyReorder(games, 3, 0);

    assert.deepEqual(games.map(g => g.gameNumber), [4, 1, 2, 3]);

    for (const game of games) {
      assert.deepEqual(game.nearSide, before[game.gameNumber].nearSide, `game ${game.gameNumber} nearSide changed`);
      assert.deepEqual(game.farSide,  before[game.gameNumber].farSide,  `game ${game.gameNumber} farSide changed`);
    }
  });

});
