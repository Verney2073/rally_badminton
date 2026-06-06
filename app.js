let players = ['', '', '', ''];
let lastResult = null;
let completedGames = new Set();

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Player list ───────────────────────────────────────────────────────────

function renderPlayers() {
  const list = document.getElementById('player-list');
  list.innerHTML = '';
  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <span class="player-num">${i + 1}</span>
      <input
        type="text"
        class="player-input"
        value="${escHtml(name)}"
        placeholder="Player name"
        data-idx="${i}"
      >
      <div class="player-arrows">
        <button class="player-arrow" data-move="${i}:-1" title="Move up" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="player-arrow" data-move="${i}:1"  title="Move down" ${i === players.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <button class="player-remove" data-remove="${i}" title="Remove">×</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.player-input').forEach(input => {
    input.addEventListener('input', e => {
      players[parseInt(e.target.dataset.idx)] = e.target.value;
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { addPlayer(); }
    });
  });

  list.querySelectorAll('.player-arrow').forEach(btn => {
    btn.addEventListener('click', () => {
      const [i, dir] = btn.dataset.move.split(':').map(Number);
      movePlayer(i, dir);
    });
  });

  list.querySelectorAll('.player-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      removePlayer(parseInt(btn.dataset.remove));
    });
  });
}

function addPlayer() {
  if (players.length >= 12) {
    alert('Maximum 12 players per session.');
    return;
  }
  players.push('');
  renderPlayers();
  const inputs = document.querySelectorAll('.player-input');
  if (inputs.length) { inputs[inputs.length - 1].focus(); }
}

function removePlayer(i) {
  players.splice(i, 1);
  renderPlayers();
}

function movePlayer(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= players.length) { return; }
  [players[i], players[j]] = [players[j], players[i]];
  renderPlayers();
  const inputs = document.querySelectorAll('.player-input');
  if (inputs[j]) { inputs[j].focus(); }
}

function clearAll() {
  players = [];
  lastResult = null;
  completedGames = new Set();
  localStorage.removeItem('badsched_players');
  localStorage.removeItem('badsched_result');
  localStorage.removeItem('badsched_done');
  renderPlayers();
  document.getElementById('schedule-output').classList.add('hidden');
}

// ── Schedule generation ───────────────────────────────────────────────────

function generateSchedule() {
  const names = players.map(p => p.trim()).filter(Boolean);

  if (names.length < 4) {
    alert('Need at least 4 players for doubles.');
    return;
  }

  if (new Set(names).size !== names.length) {
    alert('Player names must be unique.');
    return;
  }

  const numGames = Math.max(1, parseInt(document.getElementById('num-games').value) || 12);

  if (numGames > 100) {
    alert('Maximum 100 games per session.');
    return;
  }

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = 'Generating…';

  setTimeout(() => {
    try {
      const scheduler = new BadmintonScheduler(names);
      lastResult = scheduler.generate(numGames);
      completedGames = new Set();
      localStorage.removeItem('badsched_done');
      renderSchedule(lastResult);
      localStorage.setItem('badsched_players', JSON.stringify(names));
      localStorage.setItem('badsched_result', JSON.stringify(lastResult));
    } catch (e) {
      alert('Error generating schedule: ' + e.message);
      console.error(e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Generate schedule <span class="arrow">→</span>';
    }
  }, 10);
}

function renderSchedule(result) {
  const output = document.getElementById('schedule-output');
  const {players: ps, games, summary} = result;
  const hasSitouts = ps.length > 4;

  const gamesHtml = games.map(g => `
    <div class="game-row">
      <div class="game-num">Game&nbsp;${g.gameNumber}</div>
      <div class="game-side near">
        <div class="players">${escHtml(g.nearSide.join(' + '))}</div>
        <div class="side-label">Near side</div>
      </div>
      <div class="game-vs">vs</div>
      <div class="game-side far">
        <div class="players">${escHtml(g.farSide.join(' + '))}</div>
        <div class="side-label">Far side</div>
      </div>
      <div class="game-sitting">
        ${g.sittingOut.length ? escHtml(g.sittingOut.join(', ')) : (hasSitouts ? '—' : '')}
      </div>
    </div>
  `).join('');

  const statsHtml = ps.map(p => {
    const st = summary.playerStats[p];
    return `
      <div class="stats-row">
        <div class="player-name">${escHtml(p)}</div>
        <div class="r">${st.gamesPlayed}</div>
        <div class="r">${st.sitOuts}</div>
      </div>
    `;
  }).join('');

  const pairCount = {};
  games.forEach(g => {
    [[...g.nearSide], [...g.farSide]].forEach(pair => {
      if (pair.length === 2) {
        const key = [...pair].sort().join('\0');
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    });
  });
  const getPairCount = (a, b) => pairCount[[a, b].sort().join('\0')] || 0;

  const partnerRowsHtml = ps.map(rowP => `
    <tr>
      <th class="partner-row-head">${escHtml(rowP)}</th>
      ${ps.map(colP => {
        if (rowP === colP) return `<td class="partner-self">—</td>`;
        const n = getPairCount(rowP, colP);
        return `<td class="partner-cell${n === 0 ? ' partner-zero' : ''}">${n}</td>`;
      }).join('')}
    </tr>
  `).join('');

  const partnerMatrixHtml = `
    <div>
      <div class="section-h"><h2>Partnerships</h2></div>
      <div class="partner-wrap">
        <table class="partner-grid">
          <thead><tr>
            <th class="partner-corner"></th>
            ${ps.map(p => `<th class="partner-col-head">${escHtml(p)}</th>`).join('')}
          </tr></thead>
          <tbody>${partnerRowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;

  output.innerHTML = `
    <div class="session-strip">
      <span class="pill">Session</span>
      <div class="session-meta">
        <span class="title">Order of Play</span>
        <span class="detail">${summary.scheduled} games</span>
        <span class="detail">${ps.length} players</span>
        ${summary.repeatedConfigs > 0 ? `<span class="detail">${summary.repeatedConfigs} repeated pairings</span>` : ''}
      </div>
    </div>

    <div class="games-list">
      <div class="games-list-head">
        <div></div>
        <div>Near side</div>
        <div class="vs-col"></div>
        <div>Far side</div>
        <div class="sit-col">${hasSitouts ? 'Sitting out' : ''}</div>
      </div>
      ${gamesHtml}
    </div>

    <div>
      <div class="section-h"><h2>Player Stats</h2></div>
      <div class="stats-table">
        <div class="stats-head">
          <div>Player</div>
          <div class="r">Games played</div>
          <div class="r">Sit-outs</div>
        </div>
        ${statsHtml}
      </div>
    </div>

    ${partnerMatrixHtml}
  `;

  output.querySelectorAll('.game-row').forEach((row, idx) => {
    const gameNum = result.games[idx].gameNumber;
    if (completedGames.has(gameNum)) {
      row.classList.add('done');
    }
    row.addEventListener('click', () => {
      row.classList.toggle('done');
      if (row.classList.contains('done')) {
        completedGames.add(gameNum);
      } else {
        completedGames.delete(gameNum);
      }
      localStorage.setItem('badsched_done', JSON.stringify([...completedGames]));
    });
  });

  output.classList.remove('hidden');
  output.scrollIntoView({behavior: 'smooth', block: 'start'});
}

// ── Init ──────────────────────────────────────────────────────────────────
(function () {
  try {
    const sp = localStorage.getItem('badsched_players');
    const sr = localStorage.getItem('badsched_result');
    const sd = localStorage.getItem('badsched_done');
    if (sp) { players = JSON.parse(sp); }
    if (sd) { completedGames = new Set(JSON.parse(sd)); }
    renderPlayers();
    if (sr) {
      lastResult = JSON.parse(sr);
      renderSchedule(lastResult);
    }
  } catch (_) {
    renderPlayers();
  }
}());
