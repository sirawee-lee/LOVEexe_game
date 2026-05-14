'use strict';

/**
 * MiniGame_Professor — "Rope Swing"
 * Delta Building rooftop: swing on a rope and land on platforms.
 * Press SPACE to release the rope and fly to the next platform.
 * 3 successful swings to win. Miss = fall = lose a life.
 */
const MiniGame_Professor = (() => {

  const W = 700, H = 400;
  const TOTAL_SWINGS = 3;
  const TIME_LIMIT   = 60;

  let round, score, timeLeft, lives, timerInterval, animFrame;
  let gameActive = false;
  let keyHandler = null;
  let clickHandler = null;

  // Rope swing state
  let rope = {};
  let player = {};
  let platforms = [];
  let released = false;
  let flying = false;
  let landed = false;
  let failFall = false;
  let resultTimer = 0;

  function initRound() {
    released = false;
    flying   = false;
    landed   = false;
    failFall = false;
    resultTimer = 0;

    // Anchor point at top-center
    rope = {
      ax: W / 2,     // anchor x
      ay: 30,        // anchor y
      len: 110,      // rope length
      angle: -0.8,   // start angle (left side)
      omega: 1.4,    // angular velocity (right-swinging)
      gravity: 0.025,
    };

    // Player hangs at rope end
    player = {
      x: rope.ax + Math.sin(rope.angle) * rope.len,
      y: rope.ay + Math.cos(rope.angle) * rope.len,
      vx: 0,
      vy: 0,
      w: 20,
      h: 28,
    };

    // Landing platforms: left (start) and right (target)
    const targetX = W * 0.6 + Math.random() * W * 0.18;
    platforms = [
      { x: W * 0.08, y: H - 70, w: 90, h: 18, color: '#5a3a1a', safe: false },  // left (start) — already standing
      { x: targetX,  y: H - 70 - Math.round(Math.random() * 40), w: 80, h: 18, color: '#2a5a2a', safe: true },  // right (land here)
    ];
  }

  // ── Public API ────────────────────────────────────────────
  function start() {
    round = 0; score = 0; timeLeft = TIME_LIMIT; lives = 3;
    gameActive = true;

    HUDController.setMiniGameTitle(
      'ROPE SWING',
      'Press SPACE (or Click) at the right moment to release and land on the platform!'
    );
    HUDController.updateMiniGameHUD(
      `Lives: ${'❤'.repeat(lives)}`,
      `Round: ${round + 1}/${TOTAL_SWINGS}`,
      `⏱ ${timeLeft}s`
    );

    initRound();

    timerInterval = setInterval(tick, 1000);
    animFrame = requestAnimationFrame(loop);

    keyHandler  = e => { if (e.code === 'Space') { e.preventDefault(); doRelease(); } };
    clickHandler = () => doRelease();
    document.addEventListener('keydown', keyHandler);
    const canvas = document.getElementById('minigame-canvas');
    if (canvas) canvas.addEventListener('click', clickHandler);
  }

  function stop() {
    gameActive = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animFrame);
    document.removeEventListener('keydown', keyHandler);
    const canvas = document.getElementById('minigame-canvas');
    if (canvas && clickHandler) canvas.removeEventListener('click', clickHandler);
    keyHandler = null; clickHandler = null;
  }

  function tick() {
    if (!gameActive) return;
    timeLeft--;
    HUDController.updateMiniGameHUD(
      `Lives: ${'❤'.repeat(Math.max(0,lives))}`,
      `Round: ${round + 1}/${TOTAL_SWINGS}`,
      `⏱ ${timeLeft}s`
    );
    if (timeLeft <= 0) loseGame("Time's up! Prof. Hung is disappointed.");
  }

  function doRelease() {
    if (!gameActive || released) return;
    released = true;
    flying   = true;

    // Give player velocity tangential to rope at moment of release
    const vTangential = rope.omega * rope.len;
    player.vx =  Math.cos(rope.angle) * vTangential;
    player.vy = -Math.sin(rope.angle) * vTangential * 0.6;
  }

  function loop() {
    if (!gameActive) return;
    updatePhysics();
    render();
    animFrame = requestAnimationFrame(loop);
  }

  function updatePhysics() {
    if (landed || failFall) {
      resultTimer++;
      if (resultTimer >= 60) {
        if (landed) {
          round++;
          score += 20 + Math.floor(timeLeft * 0.5);
          HUDController.updateMiniGameHUD(
            `Lives: ${'❤'.repeat(Math.max(0,lives))}`,
            `Round: ${round + 1}/${TOTAL_SWINGS}`,
            `⏱ ${timeLeft}s`
          );
          if (round >= TOTAL_SWINGS) { winGame(); return; }
          initRound();
        } else {
          lives--;
          HUDController.updateMiniGameHUD(
            `Lives: ${'❤'.repeat(Math.max(0,lives))}`,
            `Round: ${round + 1}/${TOTAL_SWINGS}`,
            `⏱ ${timeLeft}s`
          );
          if (lives <= 0) { loseGame('Fell too many times!'); return; }
          initRound();
        }
      }
      return;
    }

    if (!released) {
      // Pendulum physics
      const sin = Math.sin(rope.angle);
      rope.omega -= (rope.gravity / rope.len) * sin * 60 * (1/60);
      rope.omega *= 0.999; // tiny damping
      rope.angle += rope.omega * (1/60) * 60;
      // Clamp angle so swing stays within bounds
      if (rope.angle > 1.1)  { rope.omega *= -0.6; rope.angle = 1.1; }
      if (rope.angle < -1.1) { rope.omega *= -0.6; rope.angle = -1.1; }

      player.x = rope.ax + Math.sin(rope.angle) * rope.len;
      player.y = rope.ay + Math.cos(rope.angle) * rope.len;
    } else if (flying) {
      // Projectile physics
      player.vy += 0.4;  // gravity
      player.x  += player.vx;
      player.y  += player.vy;

      // Check landing on target platform
      const target = platforms[1];
      if (
        player.x + player.w > target.x &&
        player.x < target.x + target.w &&
        player.y + player.h >= target.y &&
        player.y + player.h <= target.y + target.h + 12 &&
        player.vy >= 0
      ) {
        landed = true;
        player.y = target.y - player.h;
        player.vx = 0; player.vy = 0;
        HUDController.showToast('✓ Landed! +' + (20 + Math.floor(timeLeft * 0.5)) + ' pts');
        return;
      }

      // Check if missed (fell off screen or landed on wrong platform)
      if (player.y > H + 20) {
        failFall = true;
        HUDController.showToast('💥 Missed the platform! -1 Life');
      }
    }
  }

  function winGame() {
    stop();
    AudioManager.playSFX('correct');
    AudioManager.onMiniGameEnd();
    GameManager.completeMiniGame('professor');
    GameManager.addCoins(score);
    HUDController.showMiniGameResult(true, 'MISSION COMPLETE!',
      `Score: ${score}\nProf. Hung nods. "Perfect timing. You understand physics — and perhaps, also love."`,
      () => HUDController.showHeartFragment('Prof. Hung 🏛', () => {
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
      `${reason}\nProf. Hung: "The rope of fate requires precise release."`,
      () => DialogueSystem.start('professor_post_lose', () => {
        CutsceneManager.show('professor_lose', null);
      })
    );
  }

  function checkAllDone() {
    const s = GameManager.getState();
    if (s.professorDone && s.niupaiDone && s.fatherDone && !s.girlDone) {
      setTimeout(() => HUDController.showToast('💕 All 3 fragments! Go South from Delta Building — Mei is waiting!', 5000), 500);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    if (!gameActive) return;
    const canvas = document.getElementById('minigame-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Sky — rooftop feel
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a1a3a');
    sky.addColorStop(1, '#1a2a4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = '#ffffff66';
    for (let i = 0; i < 20; i++) {
      const sx = (i * 137 + 40) % W, sy = (i * 53) % (H * 0.4);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Building edge (rooftop floor)
    ctx.fillStyle = '#334455';
    ctx.fillRect(0, H - 30, W, 30);
    ctx.fillStyle = '#445566';
    ctx.fillRect(0, H - 32, W, 4);

    // Platforms
    platforms.forEach((p, i) => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = i === 1 ? '#88ff88' : '#888866';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      if (i === 1) {
        ctx.fillStyle = '#88ff8888';
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('LAND HERE', p.x + p.w/2, p.y - 6);
      }
    });

    // Rope anchor
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(rope.ax - 8, rope.ay - 12, 16, 12);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(rope.ax - 8, rope.ay - 12, 16, 12);

    if (!released) {
      // Draw rope
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rope.ax, rope.ay);
      ctx.lineTo(player.x, player.y);
      ctx.stroke();

      // Rope tension visual
      ctx.strokeStyle = '#e8c080';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rope.ax, rope.ay);
      // slight sag
      const midX = (rope.ax + player.x) / 2 + Math.cos(rope.angle) * 8;
      const midY = (rope.ay + player.y) / 2 + 6;
      ctx.quadraticCurveTo(midX, midY, player.x, player.y);
      ctx.stroke();
    } else if (flying) {
      // Shadow below player
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const shadowY = platforms[1].y;
      ctx.beginPath();
      ctx.ellipse(player.x + player.w/2, shadowY, 20, 5, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Player (pixel boy hanging / flying)
    drawPlayerPixel(ctx, player.x, player.y, !released);

    // Result feedback
    if (landed) {
      ctx.fillStyle = '#88ff88';
      ctx.font = 'bold 22px Courier New';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, resultTimer / 15);
      ctx.fillText('LANDED! ✓', W/2, H/2 - 30);
      ctx.globalAlpha = 1;
    } else if (failFall) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 22px Courier New';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, resultTimer / 15);
      ctx.fillText('MISSED!', W/2, H/2 - 30);
      ctx.globalAlpha = 1;
    }

    // Swing angle indicator (helps timing)
    if (!released) {
      const anglePct = (rope.angle + 1.1) / 2.2; // 0..1
      const good = anglePct > 0.55 && anglePct < 0.75;
      ctx.fillStyle = good ? '#88ff8844' : '#ffffff11';
      ctx.fillRect(W - 28, 50, 18, H - 80);
      ctx.fillStyle = good ? '#88ff88' : '#ff8844';
      const indicatorY = 50 + (1 - anglePct) * (H - 80);
      ctx.fillRect(W - 32, indicatorY - 4, 26, 8);
      ctx.fillStyle = '#ffffff88';
      ctx.font = '9px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(good ? '▶ NOW!' : 'WAIT', W - 20, indicatorY - 8);
    }

    // Instruction
    ctx.fillStyle = '#ffffff44';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('[SPACE] or [CLICK] to release', W/2, H - 10);

    // Round dots
    for (let i = 0; i < TOTAL_SWINGS; i++) {
      ctx.beginPath();
      ctx.arc(W/2 - (TOTAL_SWINGS-1)*14/2 + i*14, 18, 5, 0, Math.PI*2);
      ctx.fillStyle = i < round ? '#88ff88' : (i === round ? '#ffdd44' : '#333');
      ctx.fill();
      ctx.strokeStyle = '#88ff88';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawPlayerPixel(ctx, x, y, hanging) {
    // Body
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(x + 2, y + 12, 16, 18);
    // Head
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(x + 4, y, 12, 14);
    // Hair
    ctx.fillStyle = '#2c1a0e';
    ctx.fillRect(x + 4, y, 12, 5);
    // Arms up when hanging
    if (hanging) {
      ctx.fillStyle = '#f5cba7';
      ctx.fillRect(x - 4, y + 2, 8, 5);   // left arm up
      ctx.fillRect(x + 16, y + 2, 8, 5);  // right arm up
    }
    // Legs
    ctx.fillStyle = '#2c4a7a';
    ctx.fillRect(x + 4, y + 30, 5, 10);
    ctx.fillRect(x + 11, y + 30, 5, 10);
  }

  return { start, stop };
})();

window.MiniGame_Professor = MiniGame_Professor;
