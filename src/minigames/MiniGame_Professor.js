'use strict';

/**
 * MiniGame_Professor — "Circuit Pulse"
 * Logic-gate puzzle: place missing gate (AND/OR/NOT) to make output match target.
 * Win: solve 3 circuits in 60 seconds.
 */
const MiniGame_Professor = (() => {

  const TOTAL_ROUNDS = 3;
  const TIME_LIMIT   = 60;
  const BONUS_TIME   = 5;

  let round, score, timeLeft, solved, failed, timerInterval, animFrame;
  let puzzle = null;
  let selectedGate = null;
  let gameActive = false;

  // Possible gate types
  const GATES = ['AND', 'OR', 'NOT'];

  // ── Puzzle generation ─────────────────────────────────────
  function genPuzzle() {
    const gateType = GATES[Math.floor(Math.random() * GATES.length)];
    const a = Math.round(Math.random());
    const b = Math.round(Math.random());
    let expected;
    if (gateType === 'AND') expected = a & b;
    else if (gateType === 'OR')  expected = a | b;
    else                          expected = a ? 0 : 1; // NOT a

    // Shuffle wrong answers
    const options = [...GATES].sort(() => Math.random() - 0.5);
    return { gateType, a, b, expected, options };
  }

  // ── Public API ────────────────────────────────────────────
  function start() {
    round = 0; score = 0; timeLeft = TIME_LIMIT;
    solved = 0; failed = 0; gameActive = true;
    selectedGate = null;

    HUDController.setMiniGameTitle('CIRCUIT PULSE', 'Solve 3 logic circuits before time runs out!');
    HUDController.updateMiniGameHUD(`Round: ${round+1}/${TOTAL_ROUNDS}`, `Score: ${score}`, `Time: ${timeLeft}s`);

    puzzle = genPuzzle();
    timerInterval = setInterval(tick, 1000);
    animFrame = requestAnimationFrame(render);
  }

  function stop() {
    gameActive = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animFrame);
  }

  function tick() {
    if (!gameActive) return;
    timeLeft--;
    HUDController.updateMiniGameHUD(`Round: ${round+1}/${TOTAL_ROUNDS}`, `Score: ${score}`, `Time: ${timeLeft}s`);
    if (timeLeft <= 0) loseGame('Time\'s up!');
  }

  function pickGate(gate) {
    if (!gameActive || !puzzle) return;
    selectedGate = gate;
    checkAnswer();
  }

  function checkAnswer() {
    if (!puzzle) return;
    const correct = selectedGate === puzzle.gateType;
    if (correct) {
      const bonus = timeLeft > (TIME_LIMIT - BONUS_TIME) ? 10 : 0;
      score += 20 + bonus;
      solved++;
      HUDController.showToast(bonus ? `Correct! +30 pts (BONUS!)` : 'Correct! +20 pts');
      round++;
      if (round >= TOTAL_ROUNDS) {
        winGame();
      } else {
        puzzle = genPuzzle();
        selectedGate = null;
        HUDController.updateMiniGameHUD(`Round: ${round+1}/${TOTAL_ROUNDS}`, `Score: ${score}`, `Time: ${timeLeft}s`);
      }
    } else {
      failed++;
      HUDController.showToast('Wrong gate! Try again.');
      if (failed >= 3) loseGame('3 wrong answers!');
      selectedGate = null;
    }
  }

  function winGame() {
    stop();
    GameManager.completeMiniGame('professor');
    GameManager.addCoins(score);
    HUDController.showMiniGameResult(true, 'SUCCESS!',
      `Score: ${score}\nProfessor Chen is impressed!\n+1 Heart Fragment 💗`,
      () => {
        DialogueSystem.start('professor_post_win', checkAllDone);
      }
    );
  }

  function loseGame(reason) {
    stop();
    HUDController.showMiniGameResult(false, 'FAILED',
      `${reason}\nScore: ${score}\nProfessor Chen shakes his head.`,
      () => DialogueSystem.start('professor_post_lose', null)
    );
  }

  function checkAllDone() {
    const s = GameManager.getState();
    if (s.professorDone && s.niupaiDone && s.fatherDone) EndingManager.resolve();
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    if (!gameActive) return;
    const canvas = document.getElementById('minigame-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 700, 400);

    if (!puzzle) { animFrame = requestAnimationFrame(render); return; }

    // Background
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, 700, 400);

    // Circuit board lines
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 1;
    for (let y = 0; y < 400; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(700, y); ctx.stroke();
    }

    // Title area
    ctx.fillStyle = '#4488ff';
    ctx.font = 'bold 18px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('LOGIC GATE PUZZLE', 350, 40);

    // Input values
    ctx.fillStyle = '#88ff88';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Input A = ${puzzle.a}`, 60, 130);
    if (puzzle.gateType !== 'NOT') {
      ctx.fillText(`Input B = ${puzzle.b}`, 60, 165);
    }

    // Wire lines
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(160, 130); ctx.lineTo(260, 180); ctx.stroke();
    if (puzzle.gateType !== 'NOT') {
      ctx.beginPath(); ctx.moveTo(160, 165); ctx.lineTo(260, 195); ctx.stroke();
    }

    // Gate box (unknown)
    ctx.fillStyle = '#1a2a3a';
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 3;
    ctx.fillRect(260, 150, 120, 80);
    ctx.strokeRect(260, 150, 120, 80);
    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 22px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('?', 320, 200);

    // Output wire
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(380, 190); ctx.lineTo(480, 190); ctx.stroke();

    // Expected output
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Target Output = ${puzzle.expected}`, 490, 195);

    // Instruction
    ctx.fillStyle = '#aaa';
    ctx.font = '13px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Click the correct gate below:', 350, 270);

    // Gate buttons
    const btnW = 100, btnH = 44, gap = 30;
    const totalW = GATES.length * btnW + (GATES.length - 1) * gap;
    const startX = (700 - totalW) / 2;

    puzzle.options.forEach((gate, i) => {
      const bx = startX + i * (btnW + gap);
      const by = 290;
      ctx.fillStyle = selectedGate === gate ? '#ff69b4' : '#1a2a3a';
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, btnW, btnH);
      ctx.strokeRect(bx, by, btnW, btnH);
      ctx.fillStyle = selectedGate === gate ? '#fff' : '#88bbff';
      ctx.font = 'bold 16px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(gate, bx + btnW/2, by + 28);

      // Store hit areas for click detection
      puzzle.options[i]._rect = { x: bx, y: by, w: btnW, h: btnH };
    });

    animFrame = requestAnimationFrame(render);
  }

  // ── Click handler ─────────────────────────────────────────
  function handleClick(e) {
    if (!gameActive || !puzzle) return;
    const canvas = document.getElementById('minigame-canvas');
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (700 / rect.width);
    const my = (e.clientY - rect.top)  * (400 / rect.height);

    puzzle.options.forEach(gate => {
      const r = gate._rect;
      if (r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        pickGate(gate);
      }
    });
  }

  // Attach/detach click on canvas when this game is active
  function attachListeners() {
    const c = document.getElementById('minigame-canvas');
    c.addEventListener('click', handleClick);
  }
  function detachListeners() {
    const c = document.getElementById('minigame-canvas');
    c.removeEventListener('click', handleClick);
  }

  const _origStart = start;
  const wrappedStart = () => { _origStart(); attachListeners(); };
  const _origStop  = stop;
  const wrappedStop  = () => { _origStop();  detachListeners(); };

  return { start: wrappedStart, stop: wrappedStop };
})();

window.MiniGame_Professor = MiniGame_Professor;
