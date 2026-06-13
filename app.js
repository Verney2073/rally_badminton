let players = ['', '', '', ''];
let lastResult = null;
let completedGames = new Set();

const DRAG_HANDLE_SVG = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="6" r="1.3"/><circle cx="7" cy="6" r="1.3"/><circle cx="3" cy="10" r="1.3"/><circle cx="7" cy="10" r="1.3"/></svg>';

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
      lastResult = new BadmintonScheduler(names).generate(numGames);
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

function renderSchedule(result, opts = {}) {
  const output = document.getElementById('schedule-output');
  const {players: ps, games, summary} = result;
  const hasSitouts = ps.length > 4;

  const gamesHtml = games.map(g => `
    <div class="game-row">
      <div class="game-drag-handle" title="Drag to reorder">${DRAG_HANDLE_SVG}</div>
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

  const gamesList = output.querySelector('.games-list');
  initGamesDragDrop(gamesList, result);

  output.classList.remove('hidden');
  if (!opts.skipScroll) {
    output.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
}

// ── Drag-to-reorder ───────────────────────────────────────────────────────

function reorderGames(fromIdx, toIdx) {
  if (fromIdx === toIdx || toIdx === fromIdx + 1) return;
  const games = lastResult.games;
  const [item] = games.splice(fromIdx, 1);
  games.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, item);
  localStorage.setItem('badsched_result', JSON.stringify(lastResult));
  renderSchedule(lastResult, { skipScroll: true });
}

function initGamesDragDrop(gamesList, result) {
  const rows = [...gamesList.querySelectorAll('.game-row')];
  let dragIdx = null;

  // ── HTML5 Drag and Drop (mouse) ──────────────────────────────────────
  rows.forEach((row, i) => {
    const handle = row.querySelector('.game-drag-handle');
    let dragFromHandle = false;

    handle.addEventListener('click', e => e.stopPropagation());
    handle.addEventListener('mousedown', () => { dragFromHandle = true; });

    row.setAttribute('draggable', 'true');

    row.addEventListener('dragstart', e => {
      if (!dragFromHandle) { e.preventDefault(); return; }
      dragFromHandle = false;
      dragIdx = i;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
    });

    row.addEventListener('dragend', () => {
      dragFromHandle = false;
      rows.forEach(r => r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
      dragIdx = null;
    });

    row.addEventListener('dragover', e => {
      if (dragIdx === null || dragIdx === i) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const { top, height } = row.getBoundingClientRect();
      rows.forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
      row.classList.add(e.clientY < top + height / 2 ? 'drag-over-top' : 'drag-over-bottom');
    });

    row.addEventListener('drop', e => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === i) return;
      const { top, height } = row.getBoundingClientRect();
      reorderGames(dragIdx, e.clientY < top + height / 2 ? i : i + 1);
    });

    // ── Touch drag ───────────────────────────────────────────────────
    handle.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      const touchStartY = touch.clientY;
      const touchStartX = touch.clientX;
      const rowRect = row.getBoundingClientRect();
      let touchDragActive = false;
      let clone = null;
      dragIdx = i;

      function onTouchMove(ev) {
        const t = ev.touches[0];
        const dy = t.clientY - touchStartY;
        const dx = t.clientX - touchStartX;

        if (!touchDragActive && Math.hypot(dy, dx) > 6) {
          touchDragActive = true;
          row.classList.add('dragging');
          clone = row.cloneNode(true);
          Object.assign(clone.style, {
            position: 'fixed',
            left: rowRect.left + 'px',
            top: rowRect.top + 'px',
            width: rowRect.width + 'px',
            opacity: '0.88',
            pointerEvents: 'none',
            zIndex: '1000',
            background: 'var(--surface)',
            boxShadow: '0 6px 20px rgba(0,0,0,.18)',
            borderRadius: 'var(--r)',
          });
          document.body.appendChild(clone);
        }

        if (!touchDragActive) return;
        ev.preventDefault();
        clone.style.top = (rowRect.top + dy) + 'px';

        clone.style.visibility = 'hidden';
        const el = document.elementFromPoint(t.clientX, t.clientY);
        clone.style.visibility = '';
        const targetRow = el && el.closest('.game-row');
        rows.forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
        if (targetRow && targetRow !== row) {
          const { top, height } = targetRow.getBoundingClientRect();
          targetRow.classList.add(t.clientY < top + height / 2 ? 'drag-over-top' : 'drag-over-bottom');
        }
      }

      function onTouchEnd(ev) {
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        if (clone) { clone.remove(); clone = null; }
        rows.forEach(r => r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
        dragIdx = null;
        if (!touchDragActive) return;

        const t = ev.changedTouches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const targetRow = el && el.closest('.game-row');
        if (targetRow && targetRow !== row) {
          const targetIdx = rows.indexOf(targetRow);
          if (targetIdx !== -1) {
            const { top, height } = targetRow.getBoundingClientRect();
            reorderGames(i, t.clientY < top + height / 2 ? targetIdx : targetIdx + 1);
          }
        }
      }

      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
    }, { passive: true });
  });
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
