'use strict';

/**
 * MiniGame_Professor — "Circuit Pulse"
 * Logic-gate puzzle: choose the correct gate (AND/OR/NOT/NAND/XOR) to match output.
 * Win: solve 3 circuits in 60 seconds.
 * Fix: options are objects {label, rect} so clicks work correctly.
 */
const MiniGame_Professor = (() => {

  const TOTAL_ROUNDS = 3;
  const TIME_LIMIT   = 60;

  let round, score, timeLeft, failed, timerInterval, animFrame;
  let puzzle = null;
  let gameActive = false;
  let clickHandler = null;

  const ALL_GATES = ['AND', 'OR', 'NOT', 'NAND', 'XOR'];

  function genPuzzle() {
    const gateType = ALL_GATES[Math.floor(Math.random() * ALL_GATES.length)];
    const a = Math.round(Math.random());
    const b = Math.round(Math.random());
    let expected;
    if      (gateType === 'AND')  expected = a & b;
    else if (gateType === 'OR')   expected = a | b;
    else if (gateType === 'NOT')  expected = a ? 0 : 1;
    else if (gateType === 'NAND') expected = (a & b) ? 0 : 1;
    else                          expected = a ^ b;  // XOR

    // Build 4 options: correct + 3 random wrong, shuffled
    const wrong = ALL_GATES.filter(g => g !== gateType).sort(() => Math.random() - 0.5).slice(0, 3);
    const opts  = [gateType, ...wrong].sort(() => Math.random() - 0.5);

    // options are objects so we can attach rect without mutating strings
    return {
      gateType, a, b, expected,
      options: opts.map(label => ({ label, rect: null })),
    };
  }

  // ── Public API ────────────────────────────────────────────
  function start() {
    round = 0; score = 0; timeLeft = TIME_LIMIT; failed = 0;
    gameActive = true;
    puzzle = genPuzzle();

    HUDController.setMiniGameTitle('CIRCUIT PULSE', 'Click the correct logic gate to match the output!');
    HUDController.updateMiniGameHUD(`Round: 1/${TOTAL_ROUNDS}`, `Score: ${score}`, `⏱ ${timeLeft}s`);

    timerInterval = setInterval(tick, 1000);
    animFrame = requestAnimationFrame(render);

    const canvas = document.getElementById('minigame-canvas');
    clickHandler = handleClick.bind(null);
    canvas.addEventListener('click', clickHandler);
  }

  function stop() {
    gameActive = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animFrame);
    const canvas = document.getElementById('minigame-canvas');
    if (canvas && clickHandler) canvas.removeEventListener('click', clickHandler);
    clickHandler = null;
  }

  function tick() {
    if (!gameActive) return;
    timeLeft--;
    HUDController.updateMiniGameHUD(`Round: ${round+1}/${TOTAL_ROUNDS}`, `Score: ${score}`, `⏱ ${timeLeft}s`);
    if (timeLeft <= 0) loseGame("Time's up!");
  }

  function handleClick(e) {
    if (!gameActive || !puzzle) return;
    const canvas = document.getElementById('minigame-canvas');
    const rect   = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (700 / rect.width);
    const my = (e.clientY - rect.top)  * (400 / rect.height);

    for (const opt of puzzle.options) {
      if (!opt.rect) continue;
      const r = opt.rect;
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        pickGate(opt.label);
        return;
      }
    }
  }

  function pickGate(label) {
    if (!gameActive) return;
    const correct = label === puzzle.gateType;
    if (correct) {
      const bonus = timeLeft > TIME_LIMIT - 8 ? 10 : 0;
      score += 20 + bonus;
      HUDController.showToast(bonus ? '⚡ FAST! +30 pts' : '✓ Correct! +20 pts');
      round++;
      if (round >= TOTAL_ROUNDS) {
        winGame();
      } else {
        puzzle = genPuzzle();
        HUDController.updateMiniGameHUD(`Round: ${round+1}/${TOTAL_ROUNDS}`, `Score: ${score}`, `⏱ ${timeLeft}s`);
      }
    } else {
      failed++;
      HUDController.showToast(`✗ Wrong! (${3 - failed} tries left)`);
      if (failed >= 3) loseGame('3 wrong answers!');
    }
  }

  function winGame() {
    stop();
    AudioManager.playSFX('correct');
    AudioManager.onMiniGameEnd();
    GameManager.completeMiniGame('professor');
    GameManager.addCoins(score);
    HUDController.showMiniGameResult(true, 'MISSION COMPLETE!',
      `Score: ${score}\nProfessor Chen is impressed!`,
      () => HUDController.showHeartFragment('Professor Chen', () => {
        DialogueSystem.start('professor_post_win', () => {
          CutsceneManager.show('professor_win', checkAllDone);
        });
      })
    );
  }

  function loseGame(reason) {
    stop();
    AudioManager.playSFX('wrong');
    AudioManager.onMiniGameEnd();
    GameManager.loseHP();
    HUDController.showMiniGameResult(false, 'FAILED',
      `${reason}\nProfessor Chen shakes his head...`,
      () => DialogueSystem.start('professor_post_lose', () => {
        CutsceneManager.show('professor_lose', null);
      })
    );
  }

  function checkAllDone() {
    const s = GameManager.getState();
    if (s.professorDone && s.niupaiDone && s.fatherDone && s.girlDone) EndingManager.resolve();
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    if (!gameActive) return;
    const canvas = document.getElementById('minigame-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 700, H = 400;
    ctx.clearRect(0, 0, W, H);

    // Dark circuit-board BG
    ctx.fillStyle = '#060d1a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0a2a0a44';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }

    if (!puzzle) { animFrame = requestAnimationFrame(render); return; }

    const isNOT = puzzle.gateType === 'NOT';

    // ── Inputs ──
    const inAY = isNOT ? 170 : 150;
    const inBY = 200;
    const gateX = 260, gateY = 130, gateW = 130, gateH = 90;
    const outX  = gateX + gateW;
    const outY  = gateY + gateH / 2;

    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'right';

    // Input A
    ctx.fillStyle = '#44ff88';
    ctx.fillText(`A = ${puzzle.a}`, 110, inAY + 5);
    drawWire(ctx, 110, inAY, gateX, gateY + gateH * 0.35, '#44ff88');

    // Input B
    if (!isNOT) {
      ctx.fillStyle = '#44ccff';
      ctx.fillText(`B = ${puzzle.b}`, 110, inBY + 5);
      drawWire(ctx, 110, inBY, gateX, gateY + gateH * 0.65, '#44ccff');
    }

    // Gate box with glow
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#0d1a2e';
    ctx.fillRect(gateX, gateY, gateW, gateH);
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth   = 3;
    ctx.strokeRect(gateX, gateY, gateW, gateH);
    ctx.shadowBlur  = 0;

    // "?" label in gate
    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('?', gateX + gateW / 2, gateY + gateH / 2 + 13);

    // Output wire + target
    drawWire(ctx, outX, outY, outX + 80, outY, '#ffdd44');
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Output = ${puzzle.expected}`, outX + 88, outY + 5);

    // Instruction
    ctx.fillStyle = '#888';
    ctx.font = '13px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('▼  Select the correct gate  ▼', W / 2, 258);

    // ── Option buttons (4 choices) ──
    const btnW = 120, btnH = 48, gap = 20;
    const total = puzzle.options.length * btnW + (puzzle.options.length - 1) * gap;
    const startX = (W - total) / 2;

    puzzle.options.forEach((opt, i) => {
      const bx = startX + i * (btnW + gap);
      const by = 270;
      opt.rect = { x: bx, y: by, w: btnW, h: btnH };

      // Hover glow is expensive to detect, use simple fill
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur  = 6;
      ctx.fillStyle   = '#0d1a2e';
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth   = 2;
      ctx.strokeRect(bx, by, btnW, btnH);
      ctx.shadowBlur  = 0;

      ctx.fillStyle = '#88bbff';
      ctx.font = 'bold 18px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(opt.label, bx + btnW / 2, by + 30);
    });

    // Round indicator dots
    for (let i = 0; i < TOTAL_ROUNDS; i++) {
      ctx.beginPath();
      ctx.arc(W / 2 - (TOTAL_ROUNDS - 1) * 14 / 2 + i * 14, 368, 5, 0, Math.PI * 2);
      ctx.fillStyle = i < round ? '#ff69b4' : '#333';
      ctx.fill();
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    animFrame = requestAnimationFrame(render);
  }

  function drawWire(ctx, x1, y1, x2, y2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const mx = (x1 + x2) / 2;
    ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
    ctx.stroke();
    // Dot at end
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x2, y2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return { start, stop };
})();

window.MiniGame_Professor = MiniGame_Professor;
