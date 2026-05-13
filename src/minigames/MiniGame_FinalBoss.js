'use strict';

/**
 * MiniGame_FinalBoss — "Heartbeat Tap"
 * Rhythm game: hit SPACE or click when the pulse ring hits the center.
 * 10 beats, need 7+ perfect/good hits to win.
 * This is the final challenge with Mei before the true ending.
 */
const MiniGame_FinalBoss = (() => {

  const TOTAL_BEATS = 10;
  const PERFECT_WINDOW = 18;  // px tolerance for perfect
  const GOOD_WINDOW    = 36;

  const W = 700, H = 400;
  const CX = W / 2, CY = H / 2 - 20;
  const INNER_R  = 30;
  const SPAWN_R  = 180;
  const BEAT_INTERVAL = 1400; // ms between beats

  let beats, hits, misses, score, gameActive;
  let animFrame, beatTimer;
  let currentBeat = null; // { r, born, judged }
  let lastJudge = null;   // { text, color, timer }
  let clickHandler = null;
  let keyHandler   = null;

  function start() {
    beats = 0; hits = 0; misses = 0; score = 0;
    gameActive = true;
    currentBeat = null;
    lastJudge   = null;

    HUDController.setMiniGameTitle('HEARTBEAT TAP', 'Press SPACE or CLICK when the ring reaches the center!');
    HUDController.updateMiniGameHUD(`Hits: 0/${TOTAL_BEATS}`, `Score: ${score}`, '♥ ♥ ♥');

    animFrame = requestAnimationFrame(render);
    scheduleBeat();

    const canvas = document.getElementById('minigame-canvas');
    clickHandler = () => tap();
    keyHandler   = e => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
    canvas.addEventListener('click', clickHandler);
    document.addEventListener('keydown', keyHandler);
  }

  function stop() {
    gameActive = false;
    clearTimeout(beatTimer);
    cancelAnimationFrame(animFrame);
    const canvas = document.getElementById('minigame-canvas');
    if (canvas && clickHandler) canvas.removeEventListener('click', clickHandler);
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    clickHandler = null; keyHandler = null;
  }

  function scheduleBeat() {
    if (!gameActive) return;
    if (beats >= TOTAL_BEATS) { checkEnd(); return; }
    currentBeat = { r: SPAWN_R, born: performance.now(), judged: false };
    beats++;
    HUDController.updateMiniGameHUD(`Hits: ${hits}/${TOTAL_BEATS}`, `Score: ${score}`, '♥'.repeat(Math.max(0, hits)));
    beatTimer = setTimeout(scheduleBeat, BEAT_INTERVAL);
  }

  function tap() {
    if (!gameActive || !currentBeat || currentBeat.judged) return;
    currentBeat.judged = true;
    const diff = Math.abs(currentBeat.r - INNER_R);
    if (diff <= PERFECT_WINDOW) {
      hits++; score += 30;
      lastJudge = { text: '✨ PERFECT!', color: '#ff69b4', timer: 40 };
    } else if (diff <= GOOD_WINDOW) {
      hits++; score += 15;
      lastJudge = { text: '♥ GOOD', color: '#ffdd44', timer: 40 };
    } else {
      misses++;
      lastJudge = { text: 'MISS...', color: '#cc4444', timer: 40 };
    }
    HUDController.updateMiniGameHUD(`Hits: ${hits}/${TOTAL_BEATS}`, `Score: ${score}`, '♥'.repeat(hits));
  }

  function checkEnd() {
    if (beats < TOTAL_BEATS) return; // still going
    // Wait for last beat to settle
    setTimeout(() => {
      if (hits >= 7) winGame();
      else loseGame();
    }, BEAT_INTERVAL);
  }

  function winGame() {
    stop();
    AudioManager.playSFX('heart');
    AudioManager.onMiniGameEnd();
    GameManager.completeMiniGame('girl');
    GameManager.addCoins(score);
    GameManager.changeAffinity(30);
    HUDController.showMiniGameResult(true, 'IN SYNC! 💗',
      `Score: ${score}\nYour heartbeats matched perfectly...`,
      () => HUDController.showHeartFragment('Mei 💕', () => {
        CutsceneManager.show('girl_win', () => EndingManager.resolve());
      })
    );
  }

  function loseGame() {
    stop();
    AudioManager.playSFX('wrong');
    AudioManager.onMiniGameEnd();
    GameManager.loseHP();
    HUDController.showMiniGameResult(false, 'NOT IN SYNC...',
      `You got ${hits}/${TOTAL_BEATS} beats.\nMei smiles softly. "Maybe next time?"`,
      () => null
    );
  }

  // ── Render ─────────────────────────────────────────────────
  let time = 0;
  function render() {
    if (!gameActive) return;
    time++;
    const canvas = document.getElementById('minigame-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // BG — dark with subtle heartbeat gradient
    const grd = ctx.createRadialGradient(CX, CY, 10, CX, CY, 300);
    grd.addColorStop(0, '#1a0a1a');
    grd.addColorStop(1, '#060610');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Decorative particle hearts
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + time * 0.005;
      const dist  = 200 + Math.sin(time * 0.03 + i) * 20;
      const hx = CX + Math.cos(angle) * dist;
      const hy = CY + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(255,105,180,${0.08 + 0.05 * Math.sin(time * 0.05 + i)})`;
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', hx, hy);
    }

    // ── Target ring (inner) ──
    ctx.strokeStyle = '#ff69b4';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur  = 15;
    ctx.beginPath();
    ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center icon
    ctx.fillStyle = '#ff69b4aa';
    ctx.font = '28px serif';
    ctx.textAlign = 'center';
    ctx.fillText('💗', CX, CY + 10);

    // ── Incoming beat ring ──
    if (currentBeat && !currentBeat.judged) {
      // Shrink ring toward center
      const elapsed = performance.now() - currentBeat.born;
      const progress = Math.min(elapsed / (BEAT_INTERVAL * 0.85), 1);
      currentBeat.r  = SPAWN_R * (1 - progress);

      const alpha = 0.4 + 0.6 * progress;
      const pulse = Math.sin(time * 0.15) * 0.1 + 0.9;
      ctx.strokeStyle = `rgba(255,180,220,${alpha})`;
      ctx.lineWidth = 3 * pulse;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(CX, CY, Math.max(currentBeat.r, INNER_R), 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // auto-miss if ring passed center
      if (currentBeat.r <= INNER_R - GOOD_WINDOW && !currentBeat.judged) {
        currentBeat.judged = true;
        misses++;
        lastJudge = { text: 'MISS...', color: '#cc4444', timer: 40 };
        HUDController.updateMiniGameHUD(`Hits: ${hits}/${TOTAL_BEATS}`, `Score: ${score}`, '♥'.repeat(hits));
      }
    }

    // ── Judge text ──
    if (lastJudge && lastJudge.timer > 0) {
      lastJudge.timer--;
      ctx.fillStyle = lastJudge.color;
      ctx.font = `bold ${20 + (40 - lastJudge.timer) * 0.3}px Courier New`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = lastJudge.timer / 40;
      ctx.fillText(lastJudge.text, CX, CY - 80);
      ctx.globalAlpha = 1;
    }

    // ── Progress bar ──
    const pct = hits / TOTAL_BEATS;
    ctx.fillStyle = '#1a0a1a';
    ctx.fillRect(60, H - 40, W - 120, 16);
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(60, H - 40, (W - 120) * pct, 16);
    ctx.strokeStyle = '#ff69b488';
    ctx.lineWidth = 1;
    ctx.strokeRect(60, H - 40, W - 120, 16);

    // Beat counter
    ctx.fillStyle = '#aaa';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`${hits} hits / ${TOTAL_BEATS} beats`, W / 2, H - 50);

    // Hint
    ctx.fillStyle = '#ffffff44';
    ctx.font = '13px Courier New';
    ctx.fillText('[SPACE] or [CLICK]', W / 2, H - 10);

    animFrame = requestAnimationFrame(render);
  }

  return { start, stop };
})();

window.MiniGame_FinalBoss = MiniGame_FinalBoss;
