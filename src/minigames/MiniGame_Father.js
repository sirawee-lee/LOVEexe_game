'use strict';

/**
 * MiniGame_Father — "River Catch"
 * Falling items beside the river: catch GOOD items (colorful), dodge BAD ones (grey).
 * Win: reach 60 points in 45 seconds.
 * Good items = colorful; Bad items = desaturated/grey.
 */
const MiniGame_Father = (() => {

  const W = 700, H = 400;
  const BASKET_W = 80, BASKET_H = 20;
  const ITEM_SIZE = 28;
  const WIN_SCORE = 60;
  const TIME_LIMIT = 45;
  const BASKET_SPEED = 6;

  // Good items: colorful label + bright color
  const GOOD_ITEMS = [
    { emoji: '💐', color: '#ff69b4', label: 'Flowers' },
    { emoji: '📝', color: '#44aaff', label: 'Love Note' },
    { emoji: '🎓', color: '#ffdd44', label: 'Diploma' },
    { emoji: '💝', color: '#ff4488', label: 'Heart Gift' },
    { emoji: '⭐', color: '#ffee00', label: 'Star' },
    { emoji: '🍱', color: '#88cc44', label: 'Bento' },
    { emoji: '🎁', color: '#ff8833', label: 'Present' },
  ];

  // Bad items: grey-ish, undesirable
  const BAD_ITEMS = [
    { emoji: '📢', color: '#888888', label: 'Noise' },
    { emoji: '💸', color: '#777777', label: 'Debt' },
    { emoji: '😤', color: '#666666', label: 'Anger' },
    { emoji: '💔', color: '#999999', label: 'Broken' },
    { emoji: '🚫', color: '#555555', label: 'Reject' },
    { emoji: '🗑', color: '#888888', label: 'Trash' },
  ];

  let basket, items, score, lives, timeLeft;
  let gameActive, timerInterval, animFrame, keys;
  let spawnTimer = 0;
  let catchFlash = null; // { good, timer }

  function start() {
    gameActive = true;
    score = 0; lives = 3; timeLeft = TIME_LIMIT;
    basket = { x: W/2 - BASKET_W/2, y: H - 50 };
    items = []; keys = {};
    spawnTimer = 0;
    catchFlash = null;

    HUDController.setMiniGameTitle(
      'RIVER CATCH',
      'Catch COLORFUL items! Dodge GREY ones! [A/D or ←/→]'
    );
    HUDController.updateMiniGameHUD(
      `Lives: ${'❤'.repeat(lives)}`,
      `Score: ${score}/${WIN_SCORE}`,
      `Time: ${timeLeft}s`
    );

    timerInterval = setInterval(tick, 1000);
    animFrame = requestAnimationFrame(loop);
    document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
    document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
  }

  function stop() {
    gameActive = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animFrame);
  }

  function tick() {
    if (!gameActive) return;
    timeLeft--;
    HUDController.updateMiniGameHUD(
      `Lives: ${'❤'.repeat(Math.max(0,lives))}`,
      `Score: ${score}/${WIN_SCORE}`,
      `Time: ${timeLeft}s`
    );
    if (timeLeft <= 0) loseGame('Time ran out!');
  }

  function loop() {
    if (!gameActive) return;
    update();
    render();
    animFrame = requestAnimationFrame(loop);
  }

  function update() {
    if (keys['a'] || keys['arrowleft'])  basket.x -= BASKET_SPEED;
    if (keys['d'] || keys['arrowright']) basket.x += BASKET_SPEED;
    basket.x = Math.max(0, Math.min(W - BASKET_W, basket.x));

    spawnTimer++;
    const spawnRate = Math.max(18, 55 - Math.floor(score / 10) * 4);
    if (spawnTimer >= spawnRate) {
      spawnTimer = 0;
      const isGood = Math.random() > 0.38;
      const pool   = isGood ? GOOD_ITEMS : BAD_ITEMS;
      const item   = pool[Math.floor(Math.random() * pool.length)];
      items.push({
        x: Math.random() * (W - ITEM_SIZE),
        y: -ITEM_SIZE,
        speed: 2 + Math.random() * 2.5,
        good: isGood,
        emoji: item.emoji,
        color: item.color,
        label: item.label,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    if (catchFlash) catchFlash.timer--;

    items = items.filter(item => {
      item.y += item.speed;
      item.wobble += 0.05;

      const hit = item.x < basket.x + BASKET_W &&
                  item.x + ITEM_SIZE > basket.x &&
                  item.y + ITEM_SIZE > basket.y &&
                  item.y < basket.y + BASKET_H;
      if (hit) {
        if (item.good) {
          score += 10;
          catchFlash = { good: true, color: item.color, timer: 20 };
          HUDController.showToast(`+10 pts — ${item.label}!`);
          if (score >= WIN_SCORE) winGame();
        } else {
          lives--;
          catchFlash = { good: false, color: '#888', timer: 20 };
          HUDController.showToast(`Bad catch! ${item.emoji} -1 Life`);
          if (lives <= 0) loseGame('Too many bad items!');
        }
        HUDController.updateMiniGameHUD(
          `Lives: ${'❤'.repeat(Math.max(0,lives))}`,
          `Score: ${score}/${WIN_SCORE}`,
          `Time: ${timeLeft}s`
        );
        return false;
      }
      return item.y < H + ITEM_SIZE;
    });
  }

  function winGame() {
    stop();
    AudioManager.playSFX('correct');
    AudioManager.onMiniGameEnd();
    GameManager.completeMiniGame('father');
    GameManager.addCoins(score * 2);
    HUDController.showMiniGameResult(true, 'MISSION COMPLETE!',
      `Score: ${score}\nMr. Wang nods slowly. "You have my blessing."`,
      () => HUDController.showHeartFragment('Mr. Wang 👔', () => {
        DialogueSystem.start('father_post_win', () => {
          CutsceneManager.show('father_win', checkAllDone);
        });
      })
    );
  }

  function loseGame(reason) {
    stop();
    AudioManager.playSFX('wrong');
    AudioManager.onMiniGameEnd();
    GameManager.loseHP();
    HUDController.showMiniGameResult(false, 'REJECTED!',
      `${reason}\nMr. Wang shakes his head.`,
      () => DialogueSystem.start('father_post_lose', () => {
        CutsceneManager.show('father_lose', null);
      })
    );
  }

  function checkAllDone() {
    const s = GameManager.getState();
    if (s.professorDone && s.niupaiDone && s.fatherDone && !s.girlDone) {
      setTimeout(() => HUDController.showToast('💕 All 3 fragments! Head north to Xiao Chi Bu, then east to Delta Building!', 5000), 500);
    }
  }

  // ── Render ────────────────────────────────────────────────
  function render() {
    const canvas = document.getElementById('minigame-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Sky + river background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a2a4a');
    grad.addColorStop(0.5, '#1a3a2a');
    grad.addColorStop(1, '#2a1a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // River stripe on left side
    ctx.fillStyle = '#1a3a6a';
    ctx.fillRect(0, 0, 60, H);
    ctx.strokeStyle = 'rgba(100,180,255,0.3)';
    ctx.lineWidth = 1;
    const t = Date.now() * 0.001;
    for (let ry = 0; ry < H; ry += 20) {
      ctx.beginPath();
      ctx.moveTo(0, ry + Math.sin(t + ry * 0.1) * 3);
      ctx.lineTo(55, ry + Math.sin(t + ry * 0.1 + 1) * 3);
      ctx.stroke();
    }
    ctx.fillStyle = '#c8a86a';
    ctx.fillRect(56, 0, 6, H);

    // Ground
    ctx.fillStyle = '#2a3a1a';
    ctx.fillRect(62, H - 24, W - 62, 24);

    // Flash effect on catch
    if (catchFlash && catchFlash.timer > 0) {
      const alpha = (catchFlash.timer / 20) * 0.3;
      ctx.fillStyle = catchFlash.good
        ? `rgba(255,200,50,${alpha})`
        : `rgba(100,100,100,${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Items
    items.forEach(item => {
      const cx = item.x + ITEM_SIZE/2;
      const cy = item.y + ITEM_SIZE/2;

      if (item.good) {
        // Colorful glow for good items
        ctx.shadowColor = item.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = item.color + '44';
        ctx.beginPath();
        ctx.arc(cx, cy, ITEM_SIZE/2 + 4, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Grey tinted box for bad items
        ctx.fillStyle = 'rgba(80,80,80,0.5)';
        ctx.fillRect(item.x - 2, item.y - 2, ITEM_SIZE + 4, ITEM_SIZE + 4);
      }

      // Emoji
      ctx.font = `${ITEM_SIZE}px serif`;
      ctx.textAlign = 'center';
      // Desaturate bad items by drawing them with grey overlay
      if (!item.good) {
        ctx.globalAlpha = 0.55;
      }
      ctx.fillText(item.emoji, cx, item.y + ITEM_SIZE - 2);
      ctx.globalAlpha = 1;

      // Color indicator dot
      ctx.fillStyle = item.good ? item.color : '#555555';
      ctx.beginPath();
      ctx.arc(cx, item.y + ITEM_SIZE + 6, 3, 0, Math.PI*2);
      ctx.fill();
    });

    // Legend
    ctx.fillStyle = '#ffffff88';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('COLORFUL = GOOD ✓', W - 130, 16);
    ctx.fillStyle = '#88888888';
    ctx.fillText('GREY = BAD ✗', W - 130, 28);

    // Basket
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(basket.x, basket.y, BASKET_W, BASKET_H);
    ctx.strokeStyle = '#d2691e';
    ctx.lineWidth = 2;
    ctx.strokeRect(basket.x, basket.y, BASKET_W, BASKET_H);
    ctx.fillStyle = '#d2691e';
    ctx.fillRect(basket.x + 5, basket.y - 6, BASKET_W - 10, 6);

    // Score bar
    const barW = (score / WIN_SCORE) * (W - 80);
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(40, 10, W - 80, 12);
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(40, 10, Math.min(barW, W - 80), 12);
    ctx.strokeStyle = '#ff69b4';
    ctx.strokeRect(40, 10, W - 80, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`${score}/${WIN_SCORE}`, W/2, 20);
  }

  return { start, stop };
})();

window.MiniGame_Father = MiniGame_Father;
