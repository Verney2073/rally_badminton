/**
 * Badminton Order of Play Generator
 *
 * Greedy scheduling algorithm with backtracking, structured by the
 * round-robin circle method. Ported from badminton.py.
 */

function* combinationsOf(arr, r) {
  if (r === 0) { yield []; return; }
  for (let i = 0; i <= arr.length - r; i++) {
    for (const rest of combinationsOf(arr.slice(i + 1), r - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

function skey(iterable) {
  return [...iterable].sort().join('|');
}

function canonKey(p1, p2) {
  const a = skey(p1), b = skey(p2);
  return a < b ? a + '||' + b : b + '||' + a;
}

function setEq(a, b) {
  if (a.size !== b.size) { return false; }
  for (const x of a) { if (!b.has(x)) { return false; } }
  return true;
}

function pairingsFor(group) {
  const [a, b, c, d] = [...group].sort();
  return [
    [new Set([a, b]), new Set([c, d])],
    [new Set([a, c]), new Set([b, d])],
    [new Set([a, d]), new Set([b, c])],
  ];
}

function circleSuggested(players) {
  const n = players.length;
  if (n < 4) { return []; }
  const result = [];
  let rot, fixed, rounds;
  if (n % 2 === 0) {
    fixed = 0;
    rot = Array.from({length: n - 1}, (_, i) => i + 1);
    rounds = n - 1;
  } else {
    fixed = null;
    rot = Array.from({length: n}, (_, i) => i);
    rounds = n;
  }
  for (let r = 0; r < rounds; r++) {
    const circle = fixed !== null ? [fixed, ...rot] : [...rot];
    const len = circle.length;
    const pairs = Array.from(
      {length: Math.floor(len / 2)},
      (_, i) => [circle[i], circle[len - 1 - i]]
    );
    if (pairs.length >= 2) {
      result.push(new Set([
        players[pairs[0][0]], players[pairs[0][1]],
        players[pairs[1][0]], players[pairs[1][1]],
      ]));
    }
    rot = [rot[rot.length - 1], ...rot.slice(0, -1)];
  }
  return result;
}

class BadmintonScheduler {
  constructor(players) {
    this.players = players;
    this.n = players.length;
    this.allConfigs = [];
    for (const group of combinationsOf(players, 4)) {
      const gset = new Set(group);
      for (const [p1, p2] of pairingsFor(gset)) {
        this.allConfigs.push({group: gset, p1, p2, canon: canonKey(p1, p2)});
      }
    }
    this.circleSeq = circleSuggested(players);
    this.sitOutOrder = [...players].reverse();
    this._init();
  }

  _init() {
    this.schedule    = [];
    this.configCount = {};
    this.cyclePlayed = new Set();
    this.consecOn    = Object.fromEntries(this.players.map(p => [p, 0]));
    this.consecOff   = Object.fromEntries(this.players.map(p => [p, 0]));
    this.partnership = {};
    this.circlePos   = 0;
    this.rotPos      = 0;
  }

  _snap() {
    return {
      s:   this.schedule.map(e => ({nearIsP1: e.nearIsP1, p1: [...e.p1], p2: [...e.p2]})),
      cc:  {...this.configCount},
      cp:  new Set(this.cyclePlayed),
      on:  {...this.consecOn},
      off: {...this.consecOff},
      pa:  {...this.partnership},
      ci:  this.circlePos,
      rp:  this.rotPos,
    };
  }

  _restore(sn) {
    this.schedule    = sn.s.map(e => ({nearIsP1: e.nearIsP1, p1: new Set(e.p1), p2: new Set(e.p2)}));
    this.configCount = {...sn.cc};
    this.cyclePlayed = new Set(sn.cp);
    this.consecOn    = {...sn.on};
    this.consecOff   = {...sn.off};
    this.partnership = {...sn.pa};
    this.circlePos   = sn.ci;
    this.rotPos      = sn.rp;
  }

  _record({group, p1, p2, canon}) {
    const count = this.configCount[canon] || 0;
    this.schedule.push({nearIsP1: count % 2 === 0, p1, p2});
    this.configCount[canon] = count + 1;
    this.cyclePlayed.add(canon);
    if (this.cyclePlayed.size === this.allConfigs.length) { this.cyclePlayed.clear(); }
    for (const p of this.players) {
      if (group.has(p)) { this.consecOn[p]++;  this.consecOff[p] = 0; }
      else              { this.consecOff[p]++; this.consecOn[p]  = 0; }
    }
    this.partnership[skey(p1)] = (this.partnership[skey(p1)] || 0) + 1;
    this.partnership[skey(p2)] = (this.partnership[skey(p2)] || 0) + 1;
    this.circlePos++;
    this.rotPos += Math.max(this.n - 4, 0);
  }

  _expectedSitters() {
    const k = this.n - 4;
    if (k <= 0) { return null; }
    return new Set(Array.from({length: k}, (_, i) => this.sitOutOrder[(this.rotPos + i) % this.n]));
  }

  _score({group, p1, p2, canon}, rc, rs, rr) {
    const sitting = this.players.filter(p => !group.has(p));
    if (!rs && sitting.some(p => this.consecOff[p] >= 1)) { return null; }
    if (!rc && [...group].some(p => this.consecOn[p] >= 2)) { return null; }
    if (!rr) {
      const exp = this._expectedSitters();
      if (exp && !setEq(new Set(sitting), exp)) { return null; }
    }
    if (this.cyclePlayed.has(canon)) { return null; }
    let score = sitting.reduce((s, p) => s - this.consecOff[p] * 20, 0);
    score += (this.partnership[skey(p1)] || 0) * 3;
    score += (this.partnership[skey(p2)] || 0) * 3;
    score += (this.configCount[canon] || 0) * 8;
    if (this.circleSeq.length) {
      if (setEq(group, this.circleSeq[this.circlePos % this.circleSeq.length])) { score -= 12; }
    }
    return score;
  }

  _cands(rc, rs, rr) {
    const res = [];
    for (const cfg of this.allConfigs) {
      const s = this._score(cfg, rc, rs, rr);
      if (s !== null) { res.push({s, cfg}); }
    }
    return res.sort((a, b) => a.s - b.s);
  }

  _best() {
    for (const [rc, rs, rr] of [
      [0,0,0],[1,0,0],[0,1,0],[1,1,0],
      [0,0,1],[1,0,1],[0,1,1],[1,1,1],
    ]) {
      const c = this._cands(rc, rs, rr);
      if (c.length) { return c; }
    }
    return [];
  }

  /**
   * Schedule up to numGames games and return a result object:
   * {
   *   players: string[],
   *   games: Array<{ gameNumber, nearSide, farSide, sittingOut }>,
   *   summary: { scheduled, uniqueConfigsTotal, repeatedConfigs, playerStats }
   * }
   */
  generate(numGames) {
    const stack = [];
    let n = 0;

    while (n < numGames) {
      const cands = this._best();
      if (!cands.length) {
        if (!stack.length) { break; }
        const top = stack.pop();
        this._restore(top.snap);
        n--;
        const ni = top.idx + 1;
        if (ni < top.cands.length) {
          stack.push({snap: top.snap, cands: top.cands, idx: ni});
          this._record(top.cands[ni].cfg);
          n++;
        }
        continue;
      }
      const snap = this._snap();
      if (stack.length < 8) { stack.push({snap, cands, idx: 0}); }
      this._record(cands[0].cfg);
      n++;
    }

    const gp = Object.fromEntries(this.players.map(p => [p, 0]));
    const so = Object.fromEntries(this.players.map(p => [p, 0]));

    const games = this.schedule.map((entry, i) => {
      const {p1, p2, nearIsP1} = entry;
      const nearSide = [...(nearIsP1 ? p1 : p2)].sort();
      const farSide  = [...(nearIsP1 ? p2 : p1)].sort();
      const sitting  = this.players.filter(p => !p1.has(p) && !p2.has(p));
      [...p1, ...p2].forEach(p => { gp[p]++; });
      sitting.forEach(p => { so[p]++; });
      return {gameNumber: i + 1, nearSide, farSide, sittingOut: sitting};
    });

    return {
      players: this.players,
      games,
      summary: {
        scheduled:          games.length,
        uniqueConfigsTotal: this.allConfigs.length,
        repeatedConfigs:    Object.values(this.configCount).reduce((s, v) => s + Math.max(0, v - 1), 0),
        playerStats:        Object.fromEntries(
          this.players.map(p => [p, {gamesPlayed: gp[p], sitOuts: so[p]}])
        ),
      },
    };
  }
}
