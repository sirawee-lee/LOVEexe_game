'use strict';

/**
 * MiniGame_Father — "Heartbeat Sync"
 * Falling items: move basket LEFT/RIGHT to catch GOOD items, dodge BAD ones.
 * Win: reach 60 points in 45 seconds.
 */
const MiniGame_Father = (() => {

  const W = 700, H = 400;
  const BASKET_W = 80, BASKET_H = 20;
  const ITEM_SIZE = 32;
  const WIN_SCORE = 60;
  const TIME_LIMIT = 45;
  const BASKET_SPEED = 6;

  const GOOD_ITEMS = ['💐', '📝', '🎓', '💝', '⭐'];
  const BAD_ITEMS  = ['📢', '💸', '😤', '💔', '🚫'];

  let basket, items, score, lives, timeLeft;
  let gameActive, timerInterval, animFrame, keys;
  let spawnTimer = 0;

  function start() {
    gameActive = true;
    score = 0; lives = 3; timeLeft = TIME_LIMIT;
    basket = { x: W/2 - BASKET_W/2, y: H - 40 };
    items = []; keys = {};
    spawnTimer = 0;

    HUDController.setMiniGameTitle('HEARTBEAT SYNC', 'Catch GOOD items! Dodge BAD ones! [A/D or ←/→]');
    HUDController.updateMiniGameHUD(`Lives: ${'❤'.repeat(lives)}`, `Score: ${score}/${WIN_SCORE}`, `Time: ${timeLeft}s`);

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
    HUDController.updateMiniGameHUD(`Lives: ${'❤'.repeat(lives)}`, `Score: ${score}/${WIN_SCORE}`, `Time: ${timeLeft}s`);
    if (timeLeft <= 0) loseGame('Time ran out!');
  }

  function loop() {
    if (!gameActive) return;
    update();
    render();
    animFrame = requestAnimationFrame(loop);
  }

  function update() {
    // Move basket
    if (keys['a'] || keys['arrowleft'])  basket.x -= BASKET_SPEED;
    if (keys['d'] || keys['arrowright']) basket.x += BASKET_SPEED;
    basket.x = Math.max(0, Math.min(W - BASKET_W, basket.x));

    // Spawn items
    spawnTimer++;
    const spawnRate = Math.max(20, 60 - Math.floor(score / 10) * 5);
    if (spawnTimer >= spawnRate) {
      spawnTimer = 0;
      const isGood = Math.random() > 0.4;
      const emoji  = isGood
        ? GOOD_ITEMS[Math.floor(Math.random() * GOOD_ITEMS.length)]
        : BAD_ITEMS [Math.floor(Math.random() * BAD_ITEMS.length)];
      items.push({
        x: Math.random() * (W - ITEM_SIZE),
        y: -ITEM_SIZE,
        speed: 2 + Math.random() * 2,
        good: isGood,
        emoji,
      });
    }

    // Move items + check collision
    items = items.filter(item => {
      item.y += item.speed;

      // Hit basket?
      const hit = item.x < basket.x + BASKET_W &&
                  item.x + ITEM_SIZE > basket.x &&
                  item.y + ITEM_SIZE > basket.y &&
                  item.y < basket.y + BASKET_H;
      if (hit) {
        if (item.good) {
          score += 10;
          HUDController.showToast(`+10 pts ${item.emoji}`);
          if (score >= WIN_SCORE) winGame();
        } else {
          lives--;
          HUDController.showToast(`Miss! ${item.emoji} -1 Life`);
          if (lives <= 0) loseGame('3 bad items caught!');
        }
        HUDController.updateMiniGameHUD(`Lives: ${'❤'.repeat(Math.max(0,lives))}`, `Score: ${score}/${WIN_SCORE}`, `Time: ${timeLeft}s`);
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
      `Score: ${score}\nMr. Wang nods. "You have my blessing."`,
      () => HUDController.showHeartFragment('Mr. Wang', () => {
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
      `${reason}\nMr. Wang is unimpressed.`,
      () => DialogueSystem.start('father_post_lose', () => {
        CutsceneManager.show('father_lose', null);
      })
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
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d0d2a');
    grad.addColorStop(1, '#1a0a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, H - 20, W, 20);

    // Items
    items.forEach(item => {
      ctx.font = `${ITEM_SIZE}px serif`;
      ctx.textAlign = 'left';
      ctx.fillText(item.emoji, item.x, item.y + ITEM_SIZE);
    });

    // Basket
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(basket.x, basket.y, BASKET_W, BASKET_H);
    ctx.strokeStyle = '#d2691e';
    ctx.lineWidth = 2;
    ctx.strokeRect(basket.x, basket.y, BASKET_W, BASKET_H);
    // Basket handle
    ctx.fillStyle = '#d2691e';
    ctx.fillRect(basket.x + 5, basket.y - 6, BASKET_W - 10, 6);

    // Score bar
    const barW = (score / WIN_SCORE) * (W - 40);
    ctx.fillStyle = '#1a0a2a';
    ctx.fillRect(20, 10, W - 40, 12);
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(20, 10, Math.min(barW, W - 40), 12);
    ctx.strokeStyle = '#ff69b4';
    ctx.strokeRect(20, 10, W - 40, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`${score}/${WIN_SCORE}`, W/2, 20);
  }

  return { start, stop };
})();

window.MiniGame_Father = MiniGame_Father;
