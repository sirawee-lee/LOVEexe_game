'use strict';

/**
 * PlayerController — handles WASD movement on the canvas world map,
 * collision with walls, and E/Space interaction with booths.
 */
const PlayerController = (() => {

  const TILE = 32;
  const SPEED = 3;
  const CANVAS_W = 800;
  const CANVAS_H = 552;

  // Player sprite state
  let player = { x: 200, y: 280, w: 24, h: 24, dir: 'down', frame: 0, frameTimer: 0 };
  let keys = {};
  let moving = false;
  let dialogueOpen = false;
  let initialized = false;
  let animFrame = null;

  // ── Booth definitions (pixel coords + size + which game) ────
  const BOOTHS = [
    {
      id: 'professor',
      label: '📋 Professor Chen',
      x: 120, y: 100, w: 80, h: 80,
      color: '#4488ff',
      dialoguePre: 'professor_pre',
      game: 'professor',
    },
    {
      id: 'niupai',
      label: '🐕 Niu Pai Zone',
      x: 380, y: 200, w: 80, h: 80,
      color: '#88cc44',
      dialoguePre: 'niupai_pre',
      game: 'niupai',
    },
    {
      id: 'father',
      label: '👔 Mr. Wang',
      x: 600, y: 300, w: 80, h: 80,
      color: '#cc4444',
      dialoguePre: 'father_pre',
      game: 'father',
    },
  ];

  // Simple wall rects (x, y, w, h) — pixel coords
  const WALLS = [
    { x: 0,   y: 0,   w: CANVAS_W, h: 10 },   // top
    { x: 0,   y: 542, w: CANVAS_W, h: 10 },   // bottom
    { x: 0,   y: 0,   w: 10,       h: CANVAS_H }, // left
    { x: 790, y: 0,   w: 10,       h: CANVAS_H }, // right
  ];

  function init() {
    if (initialized) return;
    initialized = true;
    player = { x: 200, y: 280, w: 24, h: 24, dir: 'down', frame: 0, frameTimer: 0 };
    keys = {};
    dialogueOpen = false;

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
    requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    keys[e.key.toLowerCase()] = true;

    if ((e.key === 'e' || e.key === ' ') && !dialogueOpen) {
      tryInteract();
    }
    // allow dialogue system to handle E too
    if ((e.key === 'e' || e.key === ' ') && dialogueOpen) {
      DialogueSystem.advance();
    }
  }

  function tryInteract() {
    const reach = 50;
    for (const booth of BOOTHS) {
      if (rectsOverlap(
        { x: player.x - reach, y: player.y - reach, w: player.w + reach*2, h: player.h + reach*2 },
        booth
      )) {
        enterBooth(booth);
        return;
      }
    }
  }

  function enterBooth(booth) {
    dialogueOpen = true;
    DialogueSystem.start(booth.dialoguePre, () => {
      dialogueOpen = false;
      launchMiniGame(booth.game);
    });
  }

  function launchMiniGame(game) {
    GameManager.showScreen('minigame');
    if (game === 'professor') MiniGame_Professor.start();
    else if (game === 'niupai')   MiniGame_NiuPai.start();
    else if (game === 'father')   MiniGame_Father.start();
  }

  // ── Collision helpers ───────────────────────────────────────
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function collidesWithWalls(nx, ny) {
    const pr = { x: nx, y: ny, w: player.w, h: player.h };
    return WALLS.some(w => rectsOverlap(pr, w));
  }

  // ── Game loop ───────────────────────────────────────────────
  function loop() {
    update();
    render();
    animFrame = requestAnimationFrame(loop);
  }

  function update() {
    if (dialogueOpen) return;

    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup'])    dy = -SPEED;
    if (keys['s'] || keys['arrowdown'])  dy =  SPEED;
    if (keys['a'] || keys['arrowleft'])  dx = -SPEED;
    if (keys['d'] || keys['arrowright']) dx =  SPEED;

    moving = dx !== 0 || dy !== 0;
    if (dx !== 0 || dy !== 0) {
      if      (dy < 0) player.dir = 'up';
      else if (dy > 0) player.dir = 'down';
      else if (dx < 0) player.dir = 'left';
      else             player.dir = 'right';
    }

    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!collidesWithWalls(nx, player.y)) player.x = nx;
    if (!collidesWithWalls(player.x, ny)) player.y = ny;

    // Animate walk frames
    if (moving) {
      player.frameTimer++;
      if (player.frameTimer >= 12) { player.frame ^= 1; player.frameTimer = 0; }
    } else {
      player.frame = 0;
    }
  }

  function render() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── Draw ground (grass tiles) ──
    drawGround(ctx, canvas.width, canvas.height);

    // ── Draw booths ──
    for (const booth of BOOTHS) {
      drawBooth(ctx, booth);
    }

    // ── Draw player ──
    drawPlayer(ctx);

    // ── Draw interaction hint ──
    for (const booth of BOOTHS) {
      if (rectsOverlap(
        { x: player.x - 50, y: player.y - 50, w: player.w + 100, h: player.h + 100 },
        booth
      )) {
        ctx.fillStyle = '#ffffffcc';
        ctx.font = '11px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('[E] Interact', booth.x + booth.w/2, booth.y - 8);
      }
    }
  }

  function drawGround(ctx, w, h) {
    // Checkerboard grass
    const colors = ['#2d5a27', '#336b2d'];
    for (let y = 0; y < h; y += TILE) {
      for (let x = 0; x < w; x += TILE) {
        ctx.fillStyle = colors[((x/TILE + y/TILE) % 2)];
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
    // Path (horizontal + vertical)
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(0, 260, w, 40);   // horizontal path
    ctx.fillRect(360, 0, 40, h);   // vertical path

    // NTHU campus label
    ctx.fillStyle = '#ffffff44';
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('NTHU CAMPUS', 20, 30);
  }

  function drawBooth(ctx, booth) {
    // Building body
    ctx.fillStyle = booth.color + '88';
    ctx.fillRect(booth.x, booth.y, booth.w, booth.h);
    ctx.strokeStyle = booth.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(booth.x, booth.y, booth.w, booth.h);

    // Door
    ctx.fillStyle = '#5c3d1e';
    ctx.fillRect(booth.x + booth.w/2 - 10, booth.y + booth.h - 24, 20, 24);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    const label = booth.label;
    ctx.fillText(label, booth.x + booth.w/2, booth.y + 20);

    // Heart fragment display
    const s = GameManager.getState();
    if ((booth.id === 'professor' && s.professorDone) ||
        (booth.id === 'father'    && s.fatherDone)) {
      ctx.fillStyle = '#ff69b4';
      ctx.font = '18px serif';
      ctx.fillText('💗', booth.x + booth.w/2, booth.y - 10);
    }
  }

  function drawPlayer(ctx) {
    // Simple pixel-art player (colored rect with directional indicator)
    const px = player.x, py = player.y, pw = player.w, ph = player.h;

    // Body
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(px, py, pw, ph);

    // Head
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(px + 4, py - 12, 16, 16);

    // Hair (dark)
    ctx.fillStyle = '#2c1a0e';
    ctx.fillRect(px + 4, py - 12, 16, 7);

    // Eyes (direction hint)
    ctx.fillStyle = '#1a1a2e';
    if (player.dir === 'down') {
      ctx.fillRect(px + 7,  py - 7,  4, 3);
      ctx.fillRect(px + 15, py - 7,  4, 3);
    } else if (player.dir === 'up') {
      // back of head
    } else if (player.dir === 'right') {
      ctx.fillRect(px + 16, py - 8,  4, 3);
    } else {
      ctx.fillRect(px + 4,  py - 8,  4, 3);
    }

    // Walk bob
    const legOffset = moving && player.frame ? 2 : 0;
    ctx.fillStyle = '#2c4a7a';
    ctx.fillRect(px + 2,  py + ph,     10, 8 + legOffset);
    ctx.fillRect(px + pw - 12, py + ph, 10, 8 - legOffset);
  }

  function setDialogueOpen(val) { dialogueOpen = val; }

  function stop() {
    if (animFrame) cancelAnimationFrame(animFrame);
    initialized = false;
    document.removeEventListener('keydown', onKeyDown);
  }

  return { init, stop, setDialogueOpen };
})();

window.PlayerController = PlayerController;
