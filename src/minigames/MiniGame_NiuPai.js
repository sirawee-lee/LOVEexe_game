'use strict';

/**
 * MiniGame_NiuPai — "Niu Pai's Grid Stealth"
 * Grid-based stealth: WASD to move, avoid the AI dog using A* pathfinding.
 * Place sausage decoys (up to 3) with Space to distract Niu Pai.
 */
const MiniGame_NiuPai = (() => {

  const COLS = 14, ROWS = 10;
  const CELL = 50;
  const TIME_LIMIT = 90;

  let grid, player, dog, decoys, sausages;
  let timeLeft, score, gameActive, timerInterval, animFrame;
  let keys = {};

  // Cell types
  const EMPTY = 0, WALL = 1, EXIT = 2, SAUSAGE = 3;

  function buildGrid() {
    const g = [];
    for (let r = 0; r < ROWS; r++) {
      g.push(new Array(COLS).fill(EMPTY));
    }
    // Borders
    for (let c = 0; c < COLS; c++) { g[0][c] = WALL; g[ROWS-1][c] = WALL; }
    for (let r = 0; r < ROWS; r++) { g[r][0] = WALL; g[r][COLS-1] = WALL; }
    // Inner walls
    const walls = [
      [2,2],[2,3],[2,4],[3,7],[4,7],[5,7],[6,2],[6,3],[7,5],[7,6],[8,9],[9,2],[9,3]
    ];
    walls.forEach(([r,c]) => { if (g[r] && g[r][c] !== undefined) g[r][c] = WALL; });
    // Exit
    g[ROWS-2][COLS-2] = EXIT;
    return g;
  }

  function start() {
    gameActive = true;
    timeLeft = TIME_LIMIT;
    score = 0;
    sausages = 3;
    decoys = [];
    keys = {};

    grid   = buildGrid();
    player = { r: 1, c: 1 };
    dog    = { r: ROWS-3, c: COLS-3, path: [] };

    HUDController.setMiniGameTitle("NIU PAI'S GRID STEALTH", 'Reach the exit! Use [Space] to drop sausage decoys.');
    HUDController.updateMiniGameHUD(`Sausages: ${sausages}`, `Score: ${score}`, `Time: ${timeLeft}s`);

    timerInterval = setInterval(tick, 1000);
    animFrame = requestAnimationFrame(loop);

    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
  }

  function stop() {
    gameActive = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animFrame);
    document.removeEventListener('keydown', onKey);
  }

  let moveTimer = 0;
  let dogTimer  = 0;

  function loop() {
    if (!gameActive) return;
    moveTimer++;
    dogTimer++;

    if (moveTimer >= 8) { movePlayer(); moveTimer = 0; }
    if (dogTimer  >= 18) { moveDog();   dogTimer  = 0; }

    render();
    animFrame = requestAnimationFrame(loop);
  }

  function tick() {
    if (!gameActive) return;
    timeLeft--;
    HUDController.updateMiniGameHUD(`Sausages: ${sausages}`, `Score: ${score}`, `Time: ${timeLeft}s`);
    if (timeLeft <= 0) loseGame('Time ran out!');
  }

  function onKey(e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ' || e.key === 'e') dropDecoy();
  }

  function movePlayer() {
    if (!gameActive) return;
    let dr = 0, dc = 0;
    if (keys['w'] || keys['arrowup'])    dr = -1;
    if (keys['s'] || keys['arrowdown'])  dr =  1;
    if (keys['a'] || keys['arrowleft'])  dc = -1;
    if (keys['d'] || keys['arrowright']) dc =  1;

    const nr = player.r + dr, nc = player.c + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    if (grid[nr][nc] === WALL) return;

    player.r = nr; player.c = nc;

    // Check exit
    if (grid[nr][nc] === EXIT) winGame();
    // Check caught
    if (nr === dog.r && nc === dog.c) loseGame('Caught by Niu Pai!');
  }

  function dropDecoy() {
    if (!gameActive || sausages <= 0) return;
    const dup = decoys.find(d => d.r === player.r && d.c === player.c);
    if (dup) return;
    decoys.push({ r: player.r, c: player.c, ttl: 20 });
    sausages--;

    // Easter egg: feed count
    GameManager.feedNiupai();
    HUDController.updateMiniGameHUD(`Sausages: ${sausages}`, `Score: ${score}`, `Time: ${timeLeft}s`);
  }

  // ── A* pathfinding ────────────────────────────────────────
  function astar(sr, sc, er, ec) {
    const key = (r, c) => r * COLS + c;
    const h   = (r, c) => Math.abs(r - er) + Math.abs(c - ec);
    const open = [{ r: sr, c: sc, g: 0, f: h(sr, sc), parent: null }];
    const closed = new Set();

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (cur.r === er && cur.c === ec) {
        const path = [];
        let node = cur;
        while (node.parent) { path.unshift({ r: node.r, c: node.c }); node = node.parent; }
        return path;
      }
      closed.add(key(cur.r, cur.c));
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (grid[nr][nc] === WALL) continue;
        if (closed.has(key(nr, nc))) continue;
        const g = cur.g + 1;
        const existing = open.find(n => n.r === nr && n.c === nc);
        if (existing && existing.g <= g) continue;
        if (existing) open.splice(open.indexOf(existing), 1);
        open.push({ r: nr, c: nc, g, f: g + h(nr, nc), parent: cur });
      }
    }
    return [];
  }

  function moveDog() {
    if (!gameActive) return;
    // Decay decoys
    decoys = decoys.filter(d => { d.ttl--; return d.ttl > 0; });

    // Target: nearest decoy or player
    let target = { r: player.r, c: player.c };
    if (decoys.length) {
      decoys.sort((a, b) =>
        (Math.abs(a.r - dog.r) + Math.abs(a.c - dog.c)) -
        (Math.abs(b.r - dog.r) + Math.abs(b.c - dog.c))
      );
      target = decoys[0];
    }

    const path = astar(dog.r, dog.c, target.r, target.c);
    if (path.length) {
      dog.r = path[0].r;
      dog.c = path[0].c;
    }

    // Caught?
    if (dog.r === player.r && dog.c === player.c) loseGame('Caught by Niu Pai! 🐕');
  }

  // ── Win / Lose ────────────────────────────────────────────
  function winGame() {
    stop();
    const bonus = decoys.length ? decoys.length * 10 : 0;
    score = 50 + timeLeft * 5 + bonus;
    GameManager.completeMiniGame('niupai');
    GameManager.addCoins(score);
    HUDController.showMiniGameResult(true, 'ESCAPED!',
      `Score: ${score}\nYou slipped past Niu Pai! 🎉`,
      () => DialogueSystem.start('niupai_post_win', checkAllDone)
    );
  }

  function loseGame(reason) {
    stop();
    HUDController.showMiniGameResult(false, 'CAUGHT!',
      `${reason}\nNiu Pai wins this round. 🐕`,
      null
    );
  }

  function checkAllDone() {
    const s = GameManager.getState();
    if (s.professorDone && s.niupaiDone && s.fatherDone) EndingManager.resolve();
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const canvas = document.getElementById('minigame-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 700, 400);

    const OX = (700 - COLS * CELL) / 2;
    const OY = (400 - ROWS * CELL) / 2;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = OX + c * CELL, y = OY + r * CELL;
        if (grid[r][c] === WALL) {
          ctx.fillStyle = '#334';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.strokeStyle = '#556';
          ctx.strokeRect(x, y, CELL, CELL);
        } else if (grid[r][c] === EXIT) {
          ctx.fillStyle = '#2a5a2a';
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = '#88ff88';
          ctx.font = '22px serif';
          ctx.textAlign = 'center';
          ctx.fillText('🚪', x + CELL/2, y + CELL/2 + 8);
        } else {
          ctx.fillStyle = r % 2 === c % 2 ? '#1a1a2e' : '#16162a';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }

    // Decoys
    decoys.forEach(d => {
      const x = OX + d.c * CELL, y = OY + d.r * CELL;
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌭', x + CELL/2, y + CELL/2 + 8);
    });

    // Dog
    const dx = OX + dog.c * CELL, dy = OY + dog.r * CELL;
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐕', dx + CELL/2, dy + CELL/2 + 10);

    // Player
    const px = OX + player.c * CELL, py = OY + player.r * CELL;
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(px + 6, py + 6, CELL - 12, CELL - 12);
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(px + 10, py + 4, CELL - 20, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', px + CELL/2, py + CELL - 6);
  }

  return { start, stop };
})();

window.MiniGame_NiuPai = MiniGame_NiuPai;
