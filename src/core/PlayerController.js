'use strict';

const PlayerController = (() => {

  const SPEED    = 3;
  const CANVAS_W = 800;
  const CANVAS_H = 552;
  const TILE     = 32;

  let player   = {};
  let keys     = {};
  let moving   = false;
  let dialogueOpen = false;
  let initialized  = false;
  let animFrame    = null;

  // Dog companion state
  let dog = { x: 0, y: 0, visible: false, trail: [], askTimer: 0 };

  // ── World objects ──────────────────────────────────────────
  const BOOTHS = [
    { id: 'professor', label: '📋 Prof. Chen',  x: 100, y:  80, w: 80, h: 80, color: '#4488ff', dialoguePre: 'professor_pre', game: 'professor' },
    { id: 'niupai',   label: '🐕 Niu Pai Zone', x: 360, y: 190, w: 80, h: 80, color: '#88cc44', dialoguePre: 'niupai_pre',   game: 'niupai'    },
    { id: 'father',   label: '👔 Mr. Wang',     x: 580, y: 300, w: 80, h: 80, color: '#cc4444', dialoguePre: 'father_pre',   game: 'father'    },
  ];

  // Girl NPC — appears at bottom-right, unlocked after 1st intro dialogue
  const GIRL_NPC = { x: 640, y: 420, w: 48, h: 64, label: '💕 Mei' };

  // Easter egg: hidden bush, top-left corner
  const EASTER_BUSH = { x: 30, y: 80, w: 36, h: 36 };

  // Walls
  const WALLS = [
    { x: 0,         y: 0,         w: CANVAS_W, h: 10 },
    { x: 0,         y: CANVAS_H-10, w: CANVAS_W, h: 10 },
    { x: 0,         y: 0,         w: 10,       h: CANVAS_H },
    { x: CANVAS_W-10, y: 0,       w: 10,       h: CANVAS_H },
  ];

  // ── Init ───────────────────────────────────────────────────
  function init() {
    if (initialized) return;
    initialized = true;
    player = { x: 200, y: 280, w: 24, h: 32, dir: 'down', frame: 0, frameTimer: 0 };
    keys   = {};
    dialogueOpen = false;
    dog    = { x: player.x - 40, y: player.y, visible: false, trail: [], askTimer: 0 };

    ItemManager.reset();
    NPCManager.reset();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });
    requestAnimationFrame(loop);
  }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if ((k === 'e' || e.key === ' ') && dialogueOpen) {
      e.preventDefault();
      DialogueSystem.advance();
      return;
    }
    if ((k === 'e' || e.key === ' ') && !dialogueOpen) {
      e.preventDefault();
      tryInteract();
    }
    // Feed dog: press F near dog
    if (k === 'f') tryFeedDog();
  }

  // ── Interaction ────────────────────────────────────────────
  function tryInteract() {
    const reach = 55;
    const pr = expandRect(player, reach);

    // Easter egg bush (highest priority — hidden)
    if (rectsOverlap(pr, EASTER_BUSH)) {
      GameManager.findEasterEgg();
      return;
    }

    // Girl NPC
    const s = GameManager.getState();
    if (s.girlMet && rectsOverlap(pr, GIRL_NPC)) {
      enterGirlNPC();
      return;
    }

    // Regular booths
    for (const booth of BOOTHS) {
      if (rectsOverlap(pr, booth)) {
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

  function enterGirlNPC() {
    dialogueOpen = true;
    const s = GameManager.getState();
    const dlgId = s.girlDone ? 'girl_after_game' : 'girl_pre_game';
    DialogueSystem.start(dlgId, () => {
      dialogueOpen = false;
      if (!s.girlDone) launchMiniGame('finalboss');
    });
  }

  function launchMiniGame(game) {
    GameManager.showScreen('minigame');
    if      (game === 'professor') MiniGame_Professor.start();
    else if (game === 'niupai')    MiniGame_NiuPai.start();
    else if (game === 'father')    MiniGame_Father.start();
    else if (game === 'finalboss') MiniGame_FinalBoss.start();
  }

  function tryFeedDog() {
    const s = GameManager.getState();
    if (!s.dogUnlocked) return;
    if (!dog.visible) return;
    const dist = Math.hypot(player.x - dog.x, player.y - dog.y);
    if (dist < 80) GameManager.feedDog();
  }

  // ── Update loop ────────────────────────────────────────────
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
    if (moving) {
      if      (dy < 0) player.dir = 'up';
      else if (dy > 0) player.dir = 'down';
      else if (dx < 0) player.dir = 'left';
      else             player.dir = 'right';
      player.frameTimer++;
      if (player.frameTimer >= 10) { player.frame ^= 1; player.frameTimer = 0; }
    } else {
      player.frame = 0;
    }

    const nx = player.x + dx, ny = player.y + dy;
    if (!collidesWithWalls(nx, player.y)) player.x = nx;
    if (!collidesWithWalls(player.x, ny)) player.y = ny;

    // Update dog trail & position
    updateDog();

    // Items auto-pickup on proximity
    ItemManager.update(player.x, player.y, player.w, player.h);

    // NPC wander
    NPCManager.update();

    // Romance BGM when close to Mei
    const s2 = GameManager.getState();
    if (s2.girlMet) {
      const dx2 = player.x - GIRL_NPC.x, dy2 = player.y - GIRL_NPC.y;
      if (Math.sqrt(dx2*dx2 + dy2*dy2) < 120) AudioManager.onRomance();
    }

    // Dog asks for food periodically
    const s = GameManager.getState();
    if (s.dogUnlocked && dog.visible) {
      dog.askTimer++;
      if (dog.askTimer > 420) { // ~7 seconds at 60fps
        dog.askTimer = 0;
        const lines = [
          '🐕 Woof! I\'m hungry... [F] to feed me!',
          '🐕 *stares at you with big eyes* Feed me?',
          '🐕 Did I mention I\'m starving? [F] to feed!',
        ];
        HUDController.showToast(lines[Math.floor(Math.random() * lines.length)], 3000);
      }
    }

    // Unlock girl NPC after meeting in intro
    if (s.girlMet) dog.visible = true;
  }

  function updateDog() {
    const s = GameManager.getState();
    if (!s.dogUnlocked) return;

    // Record player trail
    dog.trail.push({ x: player.x, y: player.y });
    if (dog.trail.length > 40) dog.trail.shift();

    // Dog follows 40 frames behind player
    if (dog.trail.length >= 40) {
      const target = dog.trail[0];
      dog.x += (target.x - dog.x) * 0.18;
      dog.y += (target.y - dog.y) * 0.18;
    }
  }

  // ── Collision helpers ──────────────────────────────────────
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function expandRect(r, margin) {
    return { x: r.x - margin, y: r.y - margin, w: r.w + margin*2, h: r.h + margin*2 };
  }
  function collidesWithWalls(nx, ny) {
    const pr = { x: nx, y: ny, w: player.w, h: player.h };
    return WALLS.some(w => rectsOverlap(pr, w));
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGround(ctx);
    drawEasterBush(ctx);
    ItemManager.draw(ctx);
    NPCManager.draw(ctx);
    for (const booth of BOOTHS) drawBooth(ctx, booth);
    drawGirlNPC(ctx);
    if (dog.visible) drawDog(ctx);
    drawPlayer(ctx);
    drawInteractHints(ctx);
  }

  function drawGround(ctx) {
    const colors = ['#2d5a27', '#336b2d'];
    for (let y = 0; y < CANVAS_H; y += TILE) {
      for (let x = 0; x < CANVAS_W; x += TILE) {
        ctx.fillStyle = colors[((x/TILE + y/TILE) % 2)];
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
    // Paths
    ctx.fillStyle = '#8b7355';
    ctx.fillRect(0, 256, CANVAS_W, 40);
    ctx.fillRect(356, 0, 40, CANVAS_H);

    // Campus label
    ctx.fillStyle = '#ffffff33';
    ctx.font = 'bold 13px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('NTHU CAMPUS', 20, 22);

    // Subtle hint near easter bush
    ctx.fillStyle = '#ffffff15';
    ctx.font = '10px Courier New';
    ctx.fillText('?', EASTER_BUSH.x + 14, EASTER_BUSH.y - 4);
  }

  function drawEasterBush(ctx) {
    // Looks like a normal decorative bush — slightly suspicious
    ctx.fillStyle = '#1e5c1e';
    ctx.fillRect(EASTER_BUSH.x, EASTER_BUSH.y, EASTER_BUSH.w, EASTER_BUSH.h);
    ctx.fillStyle = '#2e7c2e';
    ctx.fillRect(EASTER_BUSH.x + 4, EASTER_BUSH.y + 4, EASTER_BUSH.w - 8, EASTER_BUSH.h - 8);
    // Sparkle hint
    ctx.fillStyle = `rgba(255,255,100,${0.15 + 0.1 * Math.sin(Date.now() * 0.003)})`;
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦', EASTER_BUSH.x + EASTER_BUSH.w/2, EASTER_BUSH.y + 20);
  }

  function drawBooth(ctx, booth) {
    const s = GameManager.getState();
    // Shadow
    ctx.fillStyle = '#00000033';
    ctx.fillRect(booth.x + 4, booth.y + 4, booth.w, booth.h);

    ctx.fillStyle = booth.color + '66';
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
    ctx.fillText(booth.label, booth.x + booth.w/2, booth.y + 18);

    // Completed checkmark / heart
    const done = (booth.id === 'professor' && s.professorDone) ||
                 (booth.id === 'father'    && s.fatherDone);
    if (done) {
      ctx.font = '16px serif';
      ctx.fillText('💗', booth.x + booth.w/2, booth.y - 8);
    }
    if (booth.id === 'niupai' && s.niupaiDone) {
      ctx.font = '16px serif';
      ctx.fillText('✅', booth.x + booth.w/2, booth.y - 8);
    }
  }

  function drawGirlNPC(ctx) {
    const s = GameManager.getState();
    if (!s.girlMet) return;

    const g = GIRL_NPC;
    // Shadow
    ctx.fillStyle = '#00000033';
    ctx.ellipse(g.x + g.w/2, g.y + g.h + 4, 16, 6, 0, 0, Math.PI*2);
    ctx.fill();

    // Body (pink dress pixel style)
    ctx.fillStyle = '#ff99cc';
    ctx.fillRect(g.x + 8, g.y + 20, 32, 36);

    // Head
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(g.x + 10, g.y, 28, 24);

    // Hair (long, dark)
    ctx.fillStyle = '#2c1a0e';
    ctx.fillRect(g.x + 8,  g.y,      32, 10);
    ctx.fillRect(g.x + 6,  g.y + 10, 6,  30); // left strand
    ctx.fillRect(g.x + 36, g.y + 10, 6,  30); // right strand

    // Eyes
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(g.x + 14, g.y + 12, 5, 4);
    ctx.fillRect(g.x + 29, g.y + 12, 5, 4);

    // Blush
    ctx.fillStyle = '#ff99b488';
    ctx.fillRect(g.x + 11, g.y + 16, 5, 3);
    ctx.fillRect(g.x + 32, g.y + 16, 5, 3);

    // Legs
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(g.x + 12, g.y + 56, 10, 12);
    ctx.fillRect(g.x + 26, g.y + 56, 10, 12);

    // Floating name tag
    ctx.fillStyle = '#ff69b4cc';
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(g.label, g.x + g.w/2, g.y - 6);

    // Completed mark
    if (s.girlDone) {
      ctx.font = '16px serif';
      ctx.fillText('💗', g.x + g.w/2, g.y - 22);
    }
  }

  function drawDog(ctx) {
    const dx = dog.x, dy = dog.y;
    // Shadow
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(dx + 16, dy + 22, 14, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(dx, dy + 8, 32, 18);

    // Head
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(dx + 20, dy, 18, 16);

    // Ear
    ctx.fillStyle = '#a07840';
    ctx.fillRect(dx + 20, dy - 4, 8, 10);
    ctx.fillRect(dx + 30, dy - 4, 8, 10);

    // Eye
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(dx + 30, dy + 4, 4, 4);

    // Nose
    ctx.fillStyle = '#331111';
    ctx.fillRect(dx + 35, dy + 9, 4, 3);

    // Tail (wagging animation)
    const wag = Math.sin(Date.now() * 0.008) * 6;
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(dx - 8, dy + 8 + wag, 12, 6);

    // Legs
    ctx.fillStyle = '#a07840';
    const legBob = Math.sin(Date.now() * 0.01) * 2;
    ctx.fillRect(dx + 4,  dy + 22, 6, 8 + legBob);
    ctx.fillRect(dx + 12, dy + 22, 6, 8 - legBob);
    ctx.fillRect(dx + 20, dy + 22, 6, 8 + legBob);

    // "Feed me" speech bubble when close to player
    const dist = Math.hypot(player.x - dx, player.y - dy);
    if (dist < 100) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(dx - 10, dy - 26, 70, 18);
      ctx.fillStyle = '#333';
      ctx.font = '9px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText('[F] feed me! 🌭', dx - 6, dy - 13);
    }
  }

  function drawPlayer(ctx) {
    const px = player.x, py = player.y, pw = player.w, ph = player.h;

    // Shadow
    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(px + pw/2, py + ph + 4, 12, 4, 0, 0, Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#4a90d9';
    ctx.fillRect(px + 2, py + 14, pw - 4, ph - 14);

    // Head
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(px + 4, py, pw - 8, 18);

    // Hair
    ctx.fillStyle = '#2c1a0e';
    ctx.fillRect(px + 4, py, pw - 8, 8);

    // Glasses (EECS boy!)
    ctx.fillStyle = '#aaccff';
    ctx.fillRect(px + 5,  py + 10, 7, 5);
    ctx.fillRect(px + 14, py + 10, 7, 5);
    ctx.strokeStyle = '#336';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 5,  py + 10, 7, 5);
    ctx.strokeRect(px + 14, py + 10, 7, 5);
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 12); ctx.lineTo(px + 14, py + 12);
    ctx.stroke();

    // Walk legs
    const legBob = moving && player.frame ? 3 : 0;
    ctx.fillStyle = '#2c4a7a';
    ctx.fillRect(px + 3,  py + ph,     10, 8 + legBob);
    ctx.fillRect(px + pw - 13, py + ph, 10, 8 - legBob);
  }

  function drawInteractHints(ctx) {
    const reach = 55;
    const pr    = expandRect(player, reach);
    const s     = GameManager.getState();

    for (const booth of BOOTHS) {
      if (rectsOverlap(pr, booth)) {
        drawHint(ctx, booth.x + booth.w/2, booth.y - 20, '[E] Enter');
      }
    }
    if (s.girlMet && rectsOverlap(pr, GIRL_NPC)) {
      drawHint(ctx, GIRL_NPC.x + GIRL_NPC.w/2, GIRL_NPC.y - 20, '[E] Talk to Mei');
    }
    if (rectsOverlap(pr, EASTER_BUSH)) {
      drawHint(ctx, EASTER_BUSH.x + EASTER_BUSH.w/2, EASTER_BUSH.y - 14, '[E] Inspect');
    }
  }

  function drawHint(ctx, x, y, text) {
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  function setDialogueOpen(val) { dialogueOpen = val; }

  // Called by GameManager after intro dialogue completes
  function onGirlMet() {
    GameManager.meetGirl();
    dog.visible = true;
    dog.x = player.x - 50;
    dog.y = player.y;
  }

  function stop() {
    if (animFrame) cancelAnimationFrame(animFrame);
    initialized = false;
    document.removeEventListener('keydown', onKeyDown);
  }

  return { init, stop, setDialogueOpen, onGirlMet };
})();

window.PlayerController = PlayerController;
