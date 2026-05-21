'use strict';

/**
 * MiniGame_NiuPai — "Xiao Chi Bu Rescue"
 * Clean prototype:
 * 1. Go to McDonald and press E.
 * 2. Choose what Niu Pai should order.
 * 3. Niu Pai queues outside, the food cooks, and black dogs pressure the area.
 * 4. Pick up the food at the counter with F.
 * 5. Enter the tunnel and escape through the real exit.
 *
 * The map geometry is authored on a readable tile grid.
 * Movement stays smooth and actor hitboxes are smaller than one tile.
 */
const MiniGame_NiuPai = (() => {

  const VIEW_W = 700;
  const VIEW_H = 400;
  const TILE = 40;
  const STEP = 1 / 100;
  const MAX_FRAME = 0.25;

  const PLAYER_SIZE = 26;
  const NIUPAI_SIZE = 24;
  const DOG_SIZE = 24;
  const PLAYER_SPEED = 170;
  const NIUPAI_SPEED = 152;
  const DOG_SPEED = 105;
  const FOLLOW_CATCHUP_RANGE = 120;
  const FOLLOW_TELEPORT_RANGE = 240;
  const CONTACT_RANGE = 24;
  const ATTACK_COOLDOWN = 24;
  const ORDER_TICKS = 6 * 100;
  const SPOIL_TICKS = 20 * 100;

  const PLAYER_MAX_HP = 8;
  const NIUPAI_MAX_HP = 8;

  const ORDER_OPTIONS = [
    { id: 'apple_pie', label: 'Apple Pie', correct: true, color: '#ffd166', emoji: '🥧' },
    { id: 'big_mac', label: 'Big Mac', correct: false, color: '#f97316', emoji: '🍔' },
    { id: 'mcflurry', label: 'McFlurry', correct: false, color: '#7dd3fc', emoji: '🍨' },
  ];

  const TILE_KEY = {
    '.': 'empty',
    'S': 'stall',
    'M': 'mcdonald',
    'Q': 'queue',
    'C': 'counter',
    'T': 'tunnel-entry',
    't': 'table',
    'c': 'chair',
    'E': 'player-spawn',
    'B': 'black-dog-spawn',
    '#': 'wall',
    'X': 'exit',
    'I': 'tunnel-spawn',
  };

  const MAIN_MAP = matrix([
    '. S S S . . . . . . . . . . . . . . . . . . . . . . S S S .',
    '. S S S . . . . M M M M M M M M . . . . . . . . . . B T S .',
    '. S S S . . . . M M M M M M M M . . . . . . . . . . . T S .',
    '. S S S . . . . M M M M M M M M . . . . . . . . . . . . S .',
    '. S S S . . . . M M M M M M M M . . . . . . . . . . . . S .',
    '. S S S . . . . . Q Q C C Q Q . . . . . . . . . . . . . S .',
    '. S S S . . . . . . . . . . . . . . . . . . . . . . . . S .',
    '. . . . . . t t t . . . t t t . . . t t t . . . . . . . . .',
    '. . . . . . c c c . . . c c c . . . c c c . . . . . . . . .',
    '. . . . . . t t t . . . t t t . . . t t t . . . . . . . . .',
    '. . . . . . c c c . . . c c c . . . c c c . . . . . . . . .',
    '. . . . . . . . . . . . . . . . . . . . B . . . . . . . . .',
    '. . S S S . . . . . . . . . . . . . . . . . . . . . . . . S',
    '. . S S S . . t t t . . . t t t . . . t t t . . . . . . . S',
    '. . S S S . . c c c . . . c c c . . . c c c . . . . . . . S',
    '. . S S S . . t t t . . . t t t . . . t t t . . . . . . . S',
    '. . S S S . . c c c . . . c c c . . . c c c . . . . . . . S',
    '. . S S S . . . . . . . . . . . . . . . . . . . E E B . . S',
    '. . S S S . . . . . . . . . . . . . . . . . . . E E . . . S',
    '. . . . . . . . . . . . . . . . . . . . . . . . . . . . . .',
  ]);

  const TUNNEL_MAP = matrix([
    '# # # # # # # X # # # # # # #',
    '# . . . . . B . . . . . . . #',
    '# . . . . . . . . B . . . . #',
    '# . . . # # . . . . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . . . # # # . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . # # # . . . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . . . # # . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . . . . . . . . . . #',
    '# . . . . I . . . . . . . . #',
    '# # # # # # # # # # # # # # #',
  ]);

  const MAIN_ORIGIN = { x: 0, y: 0 };
  const TUNNEL_ORIGIN = { x: MAIN_MAP[0].length * TILE + 240, y: 80 };
  const WORLD_W = TUNNEL_ORIGIN.x + TUNNEL_MAP[0].length * TILE + 120;
  const WORLD_H = Math.max(MAIN_MAP.length * TILE, TUNNEL_ORIGIN.y + TUNNEL_MAP.length * TILE) + 120;

  let player;
  let niupai;
  let dogs;
  let orderState;
  let keys;
  let gameActive;
  let animFrame;
  let lastTime;
  let accumulator;
  let camera;
  let popups;
  let pulseTick;
  let section;
  let keyDownHandler;
  let keyUpHandler;

  const mainGeometry = buildMainGeometry();
  const tunnelGeometry = buildTunnelGeometry();

  function start() {
    gameActive = true;
    lastTime = 0;
    accumulator = 0;
    pulseTick = 0;
    keys = {};
    popups = [];
    section = 'main';
    camera = { x: 0, y: 0 };

    const spawn = mainGeometry.playerSpawn;
    player = {
      x: spawn.x,
      y: spawn.y,
      w: PLAYER_SIZE,
      h: PLAYER_SIZE,
      hp: PLAYER_MAX_HP,
      invuln: 0,
      carrying: null,
      attackCooldown: 0,
    };

    niupai = {
      x: spawn.x - 34,
      y: spawn.y + 6,
      w: NIUPAI_SIZE,
      h: NIUPAI_SIZE,
      hp: NIUPAI_MAX_HP,
      invuln: 0,
      state: 'follow', // follow | queueing | ordering | waitingPickup | regroup
    };

    dogs = [
      spawnDog(mainGeometry.dogSpawns[0]),
      spawnDog(mainGeometry.dogSpawns[1]),
      spawnDog(mainGeometry.dogSpawns[2]),
    ];

    orderState = {
      status: 'idle', // idle | menu | approaching_counter | queued | ready | escaping
      selectedFood: null,
      ticksLeft: 0,
      foodReadyAtCounter: false,
      spoilTicksLeft: SPOIL_TICKS,
    };

    HUDController.setMiniGameTitle(
      'XIAO CHI BU RESCUE',
      'Get Mei something sweet. Order, protect Niu Pai, pick up the food, then escape.'
    );
    updateHUD();
    HUDController.showToast('Mei wants something sweet. Apple Pie is the best guess.', 3200);
    updateCamera();

    keyDownHandler = onKeyDown;
    keyUpHandler = onKeyUp;
    document.addEventListener('keydown', keyDownHandler);
    document.addEventListener('keyup', keyUpHandler);

    animFrame = requestAnimationFrame(loop);
  }

  function stop() {
    gameActive = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    if (keyDownHandler) document.removeEventListener('keydown', keyDownHandler);
    if (keyUpHandler) document.removeEventListener('keyup', keyUpHandler);
    keyDownHandler = null;
    keyUpHandler = null;
  }

  function buildMainGeometry() {
    const walls = [];
    const tables = [];
    const chairs = [];
    const stalls = [];
    let mcdonald = null;
    let orderZone = null;
    let counter = null;
    let queueSpot = null;
    let tunnelEntry = null;
    let playerSpawn = null;
    const dogSpawns = [];

    for (let row = 0; row < MAIN_MAP.length; row++) {
      for (let col = 0; col < MAIN_MAP[row].length; col++) {
        const ch = MAIN_MAP[row][col];
        const rect = cellRect(MAIN_ORIGIN, col, row);
        if (ch === 'S') stalls.push(rect);
        else if (ch === 't') tables.push(insetRect(rect, 2));
        else if (ch === 'c') chairs.push(insetRect(rect, 9));
        else if (ch === 'M') mcdonald = unionRect(mcdonald, rect);
        else if (ch === 'Q') queueSpot = unionRect(queueSpot, rect);
        else if (ch === 'C') counter = unionRect(counter, rect);
        else if (ch === 'T') tunnelEntry = unionRect(tunnelEntry, rect);
        else if (ch === 'E') playerSpawn = offsetPoint(rect.x + 7, rect.y + 7);
        else if (ch === 'B') dogSpawns.push(offsetPoint(rect.x + 8, rect.y + 8));
      }
    }

    orderZone = expandRect(counter, 38, 22);

    walls.push(...stalls);
    walls.push(...tables);
    walls.push(...chairs);
    walls.push(mcdonald);
    walls.push(
      { x: MAIN_ORIGIN.x, y: MAIN_ORIGIN.y, w: MAIN_MAP[0].length * TILE, h: 8 },
      { x: MAIN_ORIGIN.x, y: MAIN_ORIGIN.y + MAIN_MAP.length * TILE - 8, w: MAIN_MAP[0].length * TILE, h: 8 },
      { x: MAIN_ORIGIN.x, y: MAIN_ORIGIN.y, w: 8, h: MAIN_MAP.length * TILE },
      { x: MAIN_ORIGIN.x + MAIN_MAP[0].length * TILE - 8, y: MAIN_ORIGIN.y, w: 8, h: MAIN_MAP.length * TILE }
    );

    return {
      bounds: { x: 0, y: 0, w: MAIN_MAP[0].length * TILE, h: MAIN_MAP.length * TILE },
      walls,
      tables,
      chairs,
      stalls,
      mcdonald,
      orderZone,
      counter,
      queueSpot,
      tunnelEntry,
      playerSpawn,
      dogSpawns,
      safeCounterZone: expandRect(counter, 90, 70),
    };
  }

  function buildTunnelGeometry() {
    const walls = [];
    let exit = null;
    let entry = null;
    const dogSpawns = [];

    for (let row = 0; row < TUNNEL_MAP.length; row++) {
      for (let col = 0; col < TUNNEL_MAP[row].length; col++) {
        const ch = TUNNEL_MAP[row][col];
        const rect = cellRect(TUNNEL_ORIGIN, col, row);
        if (ch === '#') walls.push(rect);
        else if (ch === 'X') exit = unionRect(exit, rect);
        else if (ch === 'I') entry = unionRect(entry, rect);
        else if (ch === 'B') dogSpawns.push(offsetPoint(rect.x + 8, rect.y + 8));
      }
    }

    return {
      bounds: { x: TUNNEL_ORIGIN.x, y: TUNNEL_ORIGIN.y, w: TUNNEL_MAP[0].length * TILE, h: TUNNEL_MAP.length * TILE },
      walls,
      exit,
      entry,
      dogSpawns,
    };
  }

  function loop(timestamp) {
    if (!gameActive) return;
    if (!lastTime) lastTime = timestamp;

    let frameTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    frameTime = Math.min(frameTime, MAX_FRAME);
    accumulator += frameTime;

    while (accumulator >= STEP) {
      update();
      accumulator -= STEP;
    }

    render();
    animFrame = requestAnimationFrame(loop);
  }

  function update() {
    if (!gameActive) return;
    pulseTick++;

    if (orderState.status === 'menu') {
      tickPopups();
      return;
    }

    if (player.invuln > 0) player.invuln--;
    if (niupai.invuln > 0) niupai.invuln--;
    if (player.attackCooldown > 0) player.attackCooldown--;
    if ((orderState.foodReadyAtCounter || player.carrying) && orderState.spoilTicksLeft > 0) {
      orderState.spoilTicksLeft--;
    }

    updatePlayer();
    updateNiuPai();
    updateOrder();
    updateDogs();
    tickPopups();
    checkPickup();
    checkTunnelEntry();
    checkExit();

    if (player.hp <= 0) {
      loseGame('The black dogs overwhelmed you before you could leave Xiao Chi Bu.');
      return;
    }
    if (niupai.hp <= 0) {
      loseGame('Niu Pai collapsed protecting the order. Mei never gets her surprise.');
      return;
    }
    if (orderState.spoilTicksLeft <= 0) {
      spoilFood();
      return;
    }

    updateCamera();
  }

  function updatePlayer() {
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    moveActor(player, dx, dy, PLAYER_SPEED);
  }

  function updateNiuPai() {
    if (niupai.state === 'follow') {
      followPlayerSmart(false);
      return;
    }

    if (niupai.state === 'queueing') {
      const target = centerTarget(mainGeometry.queueSpot, niupai);
      seekTarget(niupai, target.x, target.y, NIUPAI_SPEED);
      if (rectsOverlap(niupai, mainGeometry.queueSpot) || distanceBetweenCenters(niupai, mainGeometry.queueSpot) < 26) {
        niupai.state = 'ordering';
        orderState.status = 'queued';
        orderState.ticksLeft = ORDER_TICKS;
        updateHUD();
        HUDController.showToast(`${foodName(orderState.selectedFood)} order placed. Guard the counter area!`, 2600);
      }
      return;
    }

    if (niupai.state === 'ordering') return;

    if (niupai.state === 'waitingPickup') {
      const waitX = mainGeometry.counter.x + mainGeometry.counter.w + 26;
      const waitY = mainGeometry.counter.y + 8;
      seekTarget(niupai, waitX, waitY, NIUPAI_SPEED * 0.92);
      return;
    }

    if (niupai.state === 'regroup') {
      followPlayerSmart(true);
      if (distanceBetweenCenters(niupai, player) < 32) niupai.state = 'follow';
    }
  }

  function updateOrder() {
    if (orderState.status === 'queued' && orderState.ticksLeft > 0) {
      orderState.ticksLeft--;
      if (orderState.ticksLeft === 0) {
        orderState.status = 'ready';
        orderState.foodReadyAtCounter = true;
        orderState.spoilTicksLeft = SPOIL_TICKS;
        niupai.state = 'waitingPickup';
        updateHUD();
        HUDController.showToast(`${foodName(orderState.selectedFood)} is ready. Pick it up at the counter!`, 3200);
      }
    }
  }

  function updateDogs() {
    for (const dog of dogs) {
      if (dog.invuln > 0) dog.invuln--;
      if (dog.attackCooldown > 0) dog.attackCooldown--;
      dog.retargetTicks--;

      if (dog.retargetTicks <= 0) {
        chooseDogTarget(dog);
        if (!dog.target) refreshDogWander(dog);
        dog.retargetTicks = 16 + Math.floor(Math.random() * 10);
      }

      if (dog.target) {
        seekTarget(dog, dog.target.x, dog.target.y, DOG_SPEED);
      } else {
        const wander = dog.wander;
        dog.wanderAngle += 0.04;
        seekTarget(
          dog,
          wander.cx + Math.cos(dog.wanderAngle) * wander.rx,
          wander.cy + Math.sin(dog.wanderAngle * 1.6) * wander.ry,
          DOG_SPEED * 0.72
        );
      }

      maybeDamage(dog, player, false);
      maybeDamage(dog, niupai, true);
    }
  }

  function chooseDogTarget(dog) {
    const zone = section === 'main' ? mainGeometry.safeCounterZone : tunnelGeometry.bounds;
    dog.target = null;

    const playerDist = distanceBetweenCenters(dog, player);
    const niuIgnored = niupai.state === 'queueing' || niupai.state === 'ordering';
    const niuDist = niuIgnored ? Infinity : distanceBetweenCenters(dog, niupai);

    if (section === 'main' && orderState.status === 'queued') {
      dog.target = niuIgnored ? player : (niuDist <= playerDist + 20 ? niupai : player);
      return;
    }
    if (section === 'main' && player.carrying) {
      dog.target = player;
      return;
    }
    if (section === 'main' && pointInRect(player.x, player.y, zone)) {
      dog.target = niuIgnored ? player : (playerDist <= niuDist ? player : niupai);
      return;
    }
    if (section === 'tunnel') {
      dog.target = niuIgnored ? player : (playerDist <= niuDist + 10 ? player : niupai);
      return;
    }
  }

  function maybeDamage(dog, target, isNiuPai) {
    if (dog.attackCooldown > 0 || target.invuln > 0) return;
    if (isNiuPai && (niupai.state === 'queueing' || niupai.state === 'ordering')) return;
    if (distanceBetweenCenters(dog, target) > CONTACT_RANGE) return;

    target.invuln = 24;
    dog.attackCooldown = ATTACK_COOLDOWN;
    target.hp = Math.max(0, target.hp - 1);
    pushPopup(target.x, target.y - 10, isNiuPai ? '-1 Niu Pai HP' : '-1 HP', isNiuPai ? '#ffd166' : '#ff8a8a');
    updateHUD();
  }

  function checkPickup() {
    if (!orderState.foodReadyAtCounter) return;
    if (!keys['f']) return;
    if (distanceBetweenCenters(player, mainGeometry.counter) > 48) return;

    player.carrying = orderState.selectedFood;
    orderState.foodReadyAtCounter = false;
    orderState.status = 'escaping';
    orderState.spoilTicksLeft = SPOIL_TICKS;
    niupai.state = 'regroup';
    updateHUD();
    HUDController.showToast(`Picked up ${foodName(player.carrying)}. Head for the tunnel!`, 2800);
  }

  function checkTunnelEntry() {
    if (section !== 'main') return;
    if (distanceBetweenCenters(player, mainGeometry.tunnelEntry) > 42) return;

    section = 'tunnel';
    player.x = tunnelGeometry.entry.x + 8;
    player.y = tunnelGeometry.entry.y + 8;
    niupai.x = player.x - 30;
    niupai.y = player.y + 2;
    niupai.state = 'follow';
    dogs = tunnelGeometry.dogSpawns.map(spawnDog);
    updateHUD();
    updateCamera();
    HUDController.showToast('Into the tunnel. The real exit is at the far end!', 2800);
  }

  function checkExit() {
    if (!player.carrying || section !== 'tunnel') return;
    if (!rectsOverlap(player, tunnelGeometry.exit)) return;

    if (player.carrying.correct) winGame();
    else wrongFoodEnding();
  }

  function spoilFood() {
    const hadFood = !!player.carrying;
    const hadReadyFood = orderState.foodReadyAtCounter;

    player.carrying = null;
    orderState.selectedFood = null;
    orderState.foodReadyAtCounter = false;
    orderState.status = 'idle';
    orderState.ticksLeft = 0;
    orderState.spoilTicksLeft = SPOIL_TICKS;
    niupai.state = 'follow';

    updateHUD();
    HUDController.showToast(
      hadFood || hadReadyFood
        ? 'The food sat around too long and disappeared. Order again.'
        : 'Too much time passed. You need to place the order again.',
      2600
    );
  }

  function followPlayerSmart(forceCatchup) {
    const targetX = player.x - 28;
    const targetY = player.y + 6;
    const dist = distance(niupai.x, niupai.y, targetX, targetY);

    if (dist > FOLLOW_TELEPORT_RANGE) {
      placeNiupaiNearPlayer();
      return;
    }

    const speed = dist > FOLLOW_CATCHUP_RANGE || forceCatchup ? NIUPAI_SPEED * 1.28 : NIUPAI_SPEED;
    if (trySmartSeek(niupai, targetX, targetY, speed)) return;
    if (trySmartSeek(niupai, player.x + 12, player.y + 12, speed)) return;
    nudgeAroundObstacle(niupai, speed * 0.78);
  }

  function trySmartSeek(actor, tx, ty, speed) {
    const dx = tx - actor.x;
    const dy = ty - actor.y;
    if (Math.hypot(dx, dy) < 2) return true;

    const len = Math.hypot(dx, dy);
    const dirX = dx / len;
    const dirY = dy / len;
    const step = speed * STEP;
    const probes = [
      { x: dirX, y: dirY },
      { x: dirX, y: 0 },
      { x: 0, y: dirY },
      { x: dirX * 0.86 - dirY * 0.52, y: dirY * 0.86 + dirX * 0.52 },
      { x: dirX * 0.86 + dirY * 0.52, y: dirY * 0.86 - dirX * 0.52 },
    ];

    for (const p of probes) {
      if (tryMoveVector(actor, p.x * step, p.y * step)) return true;
    }
    return false;
  }

  function nudgeAroundObstacle(actor, speed) {
    const step = speed * STEP;
    const options = [
      { x: step, y: 0 },
      { x: -step, y: 0 },
      { x: 0, y: step },
      { x: 0, y: -step },
    ];
    for (const o of options) {
      if (tryMoveVector(actor, o.x, o.y)) return true;
    }
    return false;
  }

  function moveActor(actor, dx, dy, speed) {
    const len = Math.hypot(dx, dy);
    if (!len) return;
    const stepX = dx / len * speed * STEP;
    const stepY = dy / len * speed * STEP;
    tryMove(actor, stepX, 0);
    tryMove(actor, 0, stepY);
  }

  function seekTarget(actor, tx, ty, speed) {
    moveActor(actor, tx - actor.x, ty - actor.y, speed);
  }

  function tryMove(actor, dx, dy) {
    const next = { x: actor.x + dx, y: actor.y + dy, w: actor.w, h: actor.h };
    if (!withinSectionBounds(next)) return;
    if (collidesObstacle(next)) return;
    actor.x = next.x;
    actor.y = next.y;
  }

  function tryMoveVector(actor, dx, dy) {
    const next = { x: actor.x + dx, y: actor.y + dy, w: actor.w, h: actor.h };
    if (!withinSectionBounds(next)) return false;
    if (collidesObstacle(next)) return false;
    actor.x = next.x;
    actor.y = next.y;
    return true;
  }

  function withinSectionBounds(rect) {
    const bounds = section === 'main' ? mainGeometry.bounds : tunnelGeometry.bounds;
    return rect.x >= bounds.x + 4 &&
           rect.y >= bounds.y + 4 &&
           rect.x + rect.w <= bounds.x + bounds.w - 4 &&
           rect.y + rect.h <= bounds.y + bounds.h - 4;
  }

  function collidesObstacle(rect) {
    const walls = section === 'main' ? mainGeometry.walls : tunnelGeometry.walls;
    return walls.some(w => rectsOverlap(rect, w));
  }

  function onKeyDown(e) {
    if (!gameActive) return;
    const key = e.key.toLowerCase();
    keys[key] = true;

    if (orderState.status === 'menu') {
      if (key === '1' || key === '2' || key === '3') {
        e.preventDefault();
        chooseOrder(Number(key) - 1);
      } else if (key === 'escape') {
        e.preventDefault();
        closeMenu();
      }
      return;
    }

    if (key === 'e') {
      e.preventDefault();
      tryOpenMenu();
    }
    if (key === 'f') {
      e.preventDefault();
      checkPickup();
    }
  }

  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }

  function tryOpenMenu() {
    if (section !== 'main') return;
    if (orderState.status !== 'idle') return;
    if (distanceBetweenCenters(player, mainGeometry.orderZone) > 60) return;
    orderState.status = 'menu';
    updateHUD();
  }

  function chooseOrder(index) {
    const choice = ORDER_OPTIONS[index];
    if (!choice) return;
    orderState.selectedFood = choice;
    orderState.status = 'approaching_counter';
    niupai.state = 'queueing';
    updateHUD();
    HUDController.showToast(`Niu Pai runs to queue for ${choice.label}.`, 2200);
  }

  function closeMenu() {
    orderState.status = 'idle';
    updateHUD();
  }

  function updateHUD() {
    const left = `MC: ${'❤'.repeat(Math.max(0, player ? player.hp : 0))}`;
    const right = `Niu Pai: ${'❤'.repeat(Math.max(0, niupai ? niupai.hp : 0))}`;

    let center = 'Go to McDonald and press [E].';
    if (orderState.status === 'menu') center = 'Choose with [1] [2] [3].';
    else if (orderState.status === 'approaching_counter') center = `Niu Pai is queueing for ${foodName(orderState.selectedFood)}.`;
    else if (orderState.status === 'queued') center = `Order cooking: ${(orderState.ticksLeft / 100).toFixed(1)}s`;
    else if (orderState.foodReadyAtCounter) center = 'Food ready: press [F] at the counter.';
    else if (player.carrying && section === 'main') center = `Carry ${foodName(player.carrying)} to the tunnel entrance.`;
    else if (player.carrying && section === 'tunnel') center = `Carry ${foodName(player.carrying)} to the tunnel exit.`;

    HUDController.updateMiniGameHUD(left, center, right);
  }

  function winGame() {
    stop();
    AudioManager.playSFX('correct');
    AudioManager.onMiniGameEnd();
    const score = 180 + player.hp * 12 + niupai.hp * 12 + Math.floor(orderState.spoilTicksLeft / 30);
    GameManager.completeMiniGame('niupai');
    GameManager.addCoins(score);
    HUDController.showMiniGameResult(
      true,
      'DELIVERY COMPLETE!',
      `You escaped with the Apple Pie.\nMei lights up the moment she sees it.\nScore: ${score}`,
      () => HUDController.showHeartFragment('Niu Pai 🐕', () => {
        DialogueSystem.start('niupai_post_win', () => {
          CutsceneManager.show('niupai_win', checkAllDone);
        });
      })
    );
  }

  function wrongFoodEnding() {
    stop();
    AudioManager.onMiniGameEnd();
    HUDController.showMiniGameResult(
      false,
      'WRONG ORDER',
      `You escaped with ${foodName(player.carrying)}.\nMei never shows up. That probably was not the sweet she wanted.`,
      () => null
    );
  }

  function loseGame(reason) {
    stop();
    AudioManager.playSFX('wrong');
    AudioManager.onMiniGameEnd();
    GameManager.loseHP();
    HUDController.showMiniGameResult(
      false,
      'FAILED DELIVERY',
      reason,
      () => CutsceneManager.show('niupai_lose', null)
    );
  }

  function checkAllDone() {
    const s = GameManager.getState();
    if (s.fatherDone && s.niupaiDone && !s.professorDone) {
      setTimeout(() => HUDController.showToast('➡ Go East to Delta Building — find Prof. Hung!', 4000), 500);
    }
  }

  function render() {
    const canvas = document.getElementById('minigame-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    drawBackground(ctx);
    drawMainWorld(ctx);
    drawTunnelWorld(ctx);
    drawCounterFood(ctx);
    drawActor(ctx, niupai, '#d0a356', '#f5d197', '🐕');
    dogs.forEach(d => drawActor(ctx, d, '#262626', '#454545', '🐕‍🦺'));
    drawActor(ctx, player, '#4a90d9', '#f5cba7', player.carrying ? player.carrying.emoji : '🙂');
    drawStatusBubbles(ctx);
    drawPopups(ctx);

    drawGuidePanel(ctx);
    drawStageCountdown(ctx);
    drawObjectives(ctx);
    drawMenu(ctx);
  }

  function drawBackground(ctx) {
    ctx.fillStyle = '#231f2b';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawMainWorld(ctx) {
    ctx.fillStyle = '#2f2938';
    ctx.fillRect(sx(mainGeometry.bounds.x), sy(mainGeometry.bounds.y), mainGeometry.bounds.w, mainGeometry.bounds.h);

    ctx.strokeStyle = '#ff69b488';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      sx(mainGeometry.bounds.x) + 2,
      sy(mainGeometry.bounds.y) + 2,
      mainGeometry.bounds.w - 4,
      mainGeometry.bounds.h - 4
    );

    ctx.fillStyle = '#8f63db';
    mainGeometry.stalls.forEach(r => ctx.fillRect(sx(r.x), sy(r.y), r.w, r.h));

    ctx.fillStyle = '#f4c542';
    ctx.fillRect(sx(mainGeometry.mcdonald.x), sy(mainGeometry.mcdonald.y), mainGeometry.mcdonald.w, mainGeometry.mcdonald.h);
    ctx.fillStyle = '#7a3f00';
    ctx.fillRect(sx(mainGeometry.mcdonald.x + 12), sy(mainGeometry.mcdonald.y + 16), mainGeometry.mcdonald.w - 24, 24);
    ctx.fillStyle = '#fff0ad';
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('McDonald', sx(mainGeometry.mcdonald.x + mainGeometry.mcdonald.w / 2), sy(mainGeometry.mcdonald.y + 29));

    ctx.fillStyle = '#f5efe6';
    ctx.fillRect(sx(mainGeometry.counter.x), sy(mainGeometry.counter.y), mainGeometry.counter.w, mainGeometry.counter.h);
    ctx.fillStyle = '#6e5547';
    ctx.fillRect(sx(mainGeometry.counter.x), sy(mainGeometry.counter.y + mainGeometry.counter.h - 4), mainGeometry.counter.w, 4);
    ctx.strokeStyle = '#fff3ca';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx(mainGeometry.counter.x - 2), sy(mainGeometry.counter.y - 2), mainGeometry.counter.w + 4, mainGeometry.counter.h + 4);
    ctx.fillStyle = '#fff8df';
    ctx.font = 'bold 10px Courier New';
    ctx.fillText('PICKUP COUNTER', sx(mainGeometry.counter.x + mainGeometry.counter.w / 2), sy(mainGeometry.counter.y - 8));

    ctx.strokeStyle = '#ffd977bb';
    ctx.strokeRect(sx(mainGeometry.queueSpot.x - 6), sy(mainGeometry.queueSpot.y - 6), mainGeometry.queueSpot.w + 12, mainGeometry.queueSpot.h + 12);
    ctx.fillStyle = '#fff4c7';
    ctx.font = '10px Courier New';
    ctx.fillText('QUEUE HERE', sx(mainGeometry.queueSpot.x + mainGeometry.queueSpot.w / 2), sy(mainGeometry.queueSpot.y + mainGeometry.queueSpot.h + 20));

    ctx.fillStyle = '#8d8d96';
    ctx.fillRect(sx(mainGeometry.tunnelEntry.x - 80), sy(mainGeometry.tunnelEntry.y - 10), 120, 32);
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(sx(mainGeometry.tunnelEntry.x), sy(mainGeometry.tunnelEntry.y), mainGeometry.tunnelEntry.w, mainGeometry.tunnelEntry.h);
    ctx.fillStyle = '#231f2b';
    ctx.fillRect(sx(mainGeometry.tunnelEntry.x + 8), sy(mainGeometry.tunnelEntry.y + 6), mainGeometry.tunnelEntry.w - 16, mainGeometry.tunnelEntry.h - 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Courier New';
    ctx.fillText('TUNNEL', sx(mainGeometry.tunnelEntry.x - 20), sy(mainGeometry.tunnelEntry.y - 14));

    mainGeometry.tables.forEach(r => {
      ctx.fillStyle = '#c78334';
      ctx.fillRect(sx(r.x), sy(r.y), r.w, r.h);
    });

    mainGeometry.chairs.forEach(r => {
      ctx.fillStyle = '#83f0ea';
      ctx.fillRect(sx(r.x), sy(r.y), r.w, r.h);
    });

    if (section === 'main') {
      if (orderState.status === 'idle') drawPulseOutline(ctx, mainGeometry.orderZone, '#ff69b4', true);
      if (orderState.status === 'approaching_counter') drawPulseOutline(ctx, mainGeometry.safeCounterZone, '#ffb703', true);
      if (orderState.status === 'queued') {
        drawPulseOutline(ctx, mainGeometry.safeCounterZone, '#ffd166', true);
        drawCounterProgress(ctx);
      }
      if (player.carrying) drawPulseOutline(ctx, mainGeometry.tunnelEntry, '#ff9f1c', true);
    }
  }

  function drawTunnelWorld(ctx) {
    ctx.fillStyle = '#16161f';
    ctx.fillRect(sx(tunnelGeometry.bounds.x), sy(tunnelGeometry.bounds.y), tunnelGeometry.bounds.w, tunnelGeometry.bounds.h);

    tunnelGeometry.walls.forEach(r => {
      ctx.fillStyle = '#6a6a76';
      ctx.fillRect(sx(r.x), sy(r.y), r.w, r.h);
    });

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(sx(tunnelGeometry.exit.x), sy(tunnelGeometry.exit.y), tunnelGeometry.exit.w, tunnelGeometry.exit.h);
    ctx.fillStyle = '#d8ffe2';
    ctx.font = 'bold 11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', sx(tunnelGeometry.exit.x + tunnelGeometry.exit.w / 2), sy(tunnelGeometry.exit.y + 18));

    if (section === 'tunnel' && player.carrying) drawPulseOutline(ctx, tunnelGeometry.exit, '#7df58a', true);
  }

  function drawGuidePanel(ctx) {
    ctx.fillStyle = 'rgba(12, 10, 18, 0.78)';
    ctx.fillRect(16, 124, 230, 104);
    ctx.strokeStyle = '#ff69b477';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 124, 230, 104);

    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('CURRENT TASK', 28, 143);

    const lines = getGuideLines();
    ctx.fillStyle = '#f1edf7';
    ctx.font = '11px Courier New';
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], 28, 165 + i * 16);

    ctx.fillStyle = 'rgba(12, 10, 18, 0.78)';
    ctx.fillRect(VIEW_W - 190, 124, 176, 104);
    ctx.strokeStyle = '#ffd16677';
    ctx.strokeRect(VIEW_W - 190, 124, 176, 104);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 12px Courier New';
    ctx.fillText('INVENTORY', VIEW_W - 180, 143);

    if (player.carrying) {
      ctx.font = '22px serif';
      ctx.fillText(player.carrying.emoji, VIEW_W - 172, 178);
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px Courier New';
      ctx.fillText(player.carrying.label, VIEW_W - 142, 172);
      ctx.fillStyle = player.carrying.correct ? '#7df58a' : '#ffb4a2';
      ctx.fillText(player.carrying.correct ? 'Likely correct.' : 'Likely wrong.', VIEW_W - 180, 194);
    } else {
      ctx.fillStyle = '#bbbbbb';
      ctx.font = '11px Courier New';
      ctx.fillText('Hands empty.', VIEW_W - 180, 172);
      ctx.fillText('Pick up food at counter.', VIEW_W - 180, 190);
    }
  }

  function drawStageCountdown(ctx) {
    if (orderState.status !== 'queued' && !player.carrying) return;
    const x = VIEW_W / 2 - 86;
    const y = 26;
    ctx.fillStyle = 'rgba(12, 10, 18, 0.82)';
    ctx.fillRect(x, y, 172, 48);
    ctx.strokeStyle = orderState.status === 'queued' ? '#ffd166aa' : '#7df58aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 172, 48);

    ctx.textAlign = 'center';
    if (orderState.status === 'queued') {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px Courier New';
      ctx.fillText('ORDER COUNTDOWN', VIEW_W / 2, y + 15);
      ctx.fillStyle = '#fff4bf';
      ctx.font = 'bold 20px Courier New';
      ctx.fillText(`${(orderState.ticksLeft / 100).toFixed(1)}s`, VIEW_W / 2, y + 36);
    } else if (player.carrying) {
      ctx.fillStyle = '#7df58a';
      ctx.font = 'bold 12px Courier New';
      ctx.fillText('SPOIL TIMER', VIEW_W / 2, y + 15);
      ctx.fillStyle = '#eaffef';
      ctx.font = 'bold 20px Courier New';
      ctx.fillText(`${(orderState.spoilTicksLeft / 100).toFixed(1)}s`, VIEW_W / 2, y + 36);
    }
  }

  function getGuideLines() {
    if (orderState.status === 'menu') {
      return ['Pick with [1] [2] [3].', 'Apple Pie is the sweet guess.', 'Esc closes the menu.'];
    }
    if (orderState.status === 'approaching_counter') {
      return ['Niu Pai is queueing.', 'Stay near McDonald.', 'Cooking starts when he arrives.'];
    }
    if (orderState.status === 'queued') {
      return ['Guard the counter area.', 'Keep black dogs off Niu Pai.', 'Wait for the countdown.'];
    }
    if (orderState.foodReadyAtCounter) {
      return ['Food is ready.', 'Go to the counter.', 'Press [F] to pick it up.'];
    }
    if (player.carrying && section === 'main') {
      return ['Bring the food to the tunnel.', 'Avoid getting boxed in.', 'Keep Niu Pai alive.'];
    }
    if (player.carrying && section === 'tunnel') {
      return ['Push through the tunnel.', 'Reach the green exit.', 'Do not get trapped.'];
    }
    return ['Go to McDonald.', 'Press [E] in the order zone.', 'Tell Niu Pai what to buy.'];
  }

  function drawObjectives(ctx) {
    ctx.fillStyle = '#ffffffbb';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Mei wants something sweet.', 18, 18);

    if (section === 'main' && orderState.status === 'idle') {
      drawArrow(ctx, mainGeometry.orderZone.x + mainGeometry.orderZone.w / 2, mainGeometry.orderZone.y + mainGeometry.orderZone.h + 14, '#ff69b4');
      drawHint(ctx, mainGeometry.orderZone.x + mainGeometry.orderZone.w / 2, mainGeometry.orderZone.y - 8, '[E] Order Food');
    }
    if (section === 'main' && orderState.status === 'approaching_counter') {
      drawArrow(ctx, mainGeometry.queueSpot.x + mainGeometry.queueSpot.w / 2, mainGeometry.queueSpot.y + mainGeometry.queueSpot.h + 16, '#ffb703');
      drawHint(ctx, mainGeometry.queueSpot.x + mainGeometry.queueSpot.w / 2, mainGeometry.queueSpot.y + mainGeometry.queueSpot.h + 32, 'Niu Pai queues here');
    }
    if (section === 'main' && orderState.foodReadyAtCounter) {
      drawArrow(ctx, mainGeometry.counter.x + mainGeometry.counter.w / 2, mainGeometry.counter.y + mainGeometry.counter.h + 16, '#ffd166');
      drawHint(ctx, mainGeometry.counter.x + mainGeometry.counter.w / 2, mainGeometry.counter.y - 8, '[F] Pick Up');
    }
    if (section === 'main' && player.carrying) {
      drawArrow(ctx, mainGeometry.tunnelEntry.x + mainGeometry.tunnelEntry.w / 2, mainGeometry.tunnelEntry.y + mainGeometry.tunnelEntry.h + 18, '#ff9f1c');
      drawHint(ctx, mainGeometry.tunnelEntry.x + mainGeometry.tunnelEntry.w / 2, mainGeometry.tunnelEntry.y - 8, 'Tunnel Entrance');
    }
    if (section === 'tunnel' && player.carrying) {
      drawArrow(ctx, tunnelGeometry.exit.x + tunnelGeometry.exit.w / 2, tunnelGeometry.exit.y + tunnelGeometry.exit.h + 16, '#7df58a');
      drawHint(ctx, tunnelGeometry.exit.x + tunnelGeometry.exit.w / 2, tunnelGeometry.exit.y - 8, 'Real Exit');
    }
  }

  function drawCounterFood(ctx) {
    if (orderState.status === 'queued' && orderState.selectedFood) {
      const prepBox = {
        x: mainGeometry.counter.x - 42,
        y: mainGeometry.counter.y - 32,
        w: mainGeometry.counter.w + 84,
        h: 18,
      };
      ctx.fillStyle = '#20171fcc';
      ctx.fillRect(sx(prepBox.x), sy(prepBox.y), prepBox.w, prepBox.h);
      ctx.strokeStyle = '#ffd166aa';
      ctx.strokeRect(sx(prepBox.x), sy(prepBox.y), prepBox.w, prepBox.h);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(
        `PREPARING ${orderState.selectedFood.emoji} ${foodName(orderState.selectedFood).toUpperCase()}`,
        sx(prepBox.x + prepBox.w / 2),
        sy(prepBox.y + 12)
      );
      return;
    }

    if (!orderState.foodReadyAtCounter || !orderState.selectedFood) return;
    const fx = sx(mainGeometry.counter.x + mainGeometry.counter.w / 2);
    const fy = sy(mainGeometry.counter.y - 2);
    const pulse = 1 + Math.sin(pulseTick * 0.12) * 0.06;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(pulse, pulse);
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.fillText(orderState.selectedFood.emoji, 0, 0);
    ctx.restore();
    ctx.fillStyle = '#fff4bf';
    ctx.font = 'bold 10px Courier New';
    ctx.fillText('READY', fx, sy(mainGeometry.counter.y - 18));
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Courier New';
    ctx.fillText('Press [F] to pick up', fx, sy(mainGeometry.counter.y + mainGeometry.counter.h + 18));
    drawPulseOutline(ctx, expandRect(mainGeometry.counter, 8, 14), '#ffd166', true);
  }

  function drawActor(ctx, actor, bodyColor, accentColor, icon) {
    const x = sx(actor.x);
    const y = sy(actor.y);
    const flash = actor.invuln > 0 && Math.floor(actor.invuln / 3) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.45;

    ctx.fillStyle = '#00000033';
    ctx.beginPath();
    ctx.ellipse(x + actor.w / 2, y + actor.h + 4, actor.w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyColor;
    ctx.fillRect(x + 2, y + actor.h * 0.35, actor.w - 4, actor.h * 0.55);
    ctx.fillStyle = accentColor;
    ctx.fillRect(x + 4, y, actor.w - 8, actor.h * 0.45);
    ctx.fillStyle = '#ffffff';
    ctx.font = `${actor === player ? 16 : 15}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(icon, x + actor.w / 2, y + actor.h * 0.7);
    ctx.globalAlpha = 1;
    drawHpBar(ctx, actor);
  }

  function drawHpBar(ctx, actor) {
    const x = sx(actor.x);
    const y = sy(actor.y);
    const max = actor === player ? PLAYER_MAX_HP : actor === niupai ? NIUPAI_MAX_HP : 5;
    const hp = actor === player ? player.hp : actor === niupai ? niupai.hp : 5;
    const w = actor.w + 6;
    ctx.fillStyle = '#00000066';
    ctx.fillRect(x - 3, y - 10, w, 5);
    ctx.fillStyle = actor === niupai ? '#ffd166' : '#ff5d73';
    ctx.fillRect(x - 3, y - 10, (hp / max) * w, 5);
  }

  function drawStatusBubbles(ctx) {
    if (niupai.state === 'queueing') drawBubble(ctx, niupai.x + niupai.w / 2, niupai.y - 12, 'Queueing...');
    else if (niupai.state === 'ordering') drawBubble(ctx, niupai.x + niupai.w / 2, niupai.y - 12, 'Ordering...');
    else if (niupai.state === 'waitingPickup') drawBubble(ctx, niupai.x + niupai.w / 2, niupai.y - 12, 'Food ready!');
  }

  function drawBubble(ctx, x, y, text) {
    x = sx(x);
    y = sy(y);
    const width = text.length * 6 + 12;
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(x - width / 2, y - 16, width, 14);
    ctx.strokeStyle = '#bda88a';
    ctx.strokeRect(x - width / 2, y - 16, width, 14);
    ctx.fillStyle = '#333';
    ctx.font = '9px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 6);
  }

  function drawPopups(ctx) {
    ctx.font = '11px Courier New';
    ctx.textAlign = 'left';
    popups.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.timer / 20);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, sx(p.x), sy(p.y));
      ctx.globalAlpha = 1;
    });
  }

  function drawMenu(ctx) {
    if (orderState.status !== 'menu') return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#101016';
    ctx.strokeStyle = '#ff69b4';
    ctx.lineWidth = 2;
    ctx.fillRect(120, 84, 460, 220);
    ctx.strokeRect(120, 84, 460, 220);

    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 18px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('What should Niu Pai order?', VIEW_W / 2, 118);

    ctx.fillStyle = '#eeeeee';
    ctx.font = '12px Courier New';
    ctx.fillText('Mei wants something sweet. Pick the order and protect Niu Pai while it cooks.', VIEW_W / 2, 146);

    ORDER_OPTIONS.forEach((food, index) => {
      const y = 182 + index * 38;
      ctx.fillStyle = food.color;
      ctx.fillRect(162, y - 16, 22, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px serif';
      ctx.fillText(food.emoji, 173, y + 1);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(`[${index + 1}] ${food.label}`, 206, y);
    });

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('[Esc] Cancel', VIEW_W / 2, 282);
  }

  function tickPopups() {
    popups = popups.filter(p => {
      p.timer--;
      p.y -= 0.25;
      return p.timer > 0;
    });
  }

  function spawnDog(point) {
    return {
      x: point.x,
      y: point.y,
      w: DOG_SIZE,
      h: DOG_SIZE,
      invuln: 0,
      attackCooldown: 0,
      retargetTicks: 0,
      target: null,
      wanderAngle: Math.random() * Math.PI * 2,
      wander: randomWanderArea(section),
    };
  }

  function refreshDogWander(dog) {
    dog.wander = randomWanderArea(section);
  }

  function randomWanderArea(areaSection) {
    const bounds = areaSection === 'main' ? mainGeometry.bounds : tunnelGeometry.bounds;
    const margin = 120;
    const minX = bounds.x + margin;
    const maxX = bounds.x + bounds.w - margin;
    const minY = bounds.y + margin;
    const maxY = bounds.y + bounds.h - margin;
    return {
      cx: randRange(minX, maxX),
      cy: randRange(minY, maxY),
      rx: 60 + Math.random() * 70,
      ry: 50 + Math.random() * 70,
    };
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function pushPopup(x, y, text, color) {
    popups.push({ x, y, text, color, timer: 45 });
  }

  function updateCamera() {
    const bounds = section === 'main' ? mainGeometry.bounds : tunnelGeometry.bounds;
    camera.x = clamp(player.x + player.w / 2 - VIEW_W / 2, bounds.x, bounds.x + bounds.w - VIEW_W);
    camera.y = clamp(player.y + player.h / 2 - VIEW_H / 2, bounds.y, bounds.y + bounds.h - VIEW_H);
  }

  function drawHint(ctx, x, y, text) {
    x = sx(x);
    y = sy(y);
    ctx.fillStyle = '#ffffffdd';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  function drawArrow(ctx, x, y, color) {
    x = sx(x);
    y = sy(y);
    const bob = Math.sin(pulseTick * 0.16) * 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + bob);
    ctx.lineTo(x - 8, y - 12 + bob);
    ctx.lineTo(x + 8, y - 12 + bob);
    ctx.closePath();
    ctx.fill();
  }

  function drawPulseOutline(ctx, rect, color, active) {
    if (!active) return;
    const pulse = 0.45 + 0.25 * (1 + Math.sin(pulseTick * 0.14));
    ctx.strokeStyle = color;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 3;
    ctx.strokeRect(sx(rect.x - 2), sy(rect.y - 2), rect.w + 4, rect.h + 4);
    ctx.globalAlpha = 1;
  }

  function drawCounterProgress(ctx) {
    const ratio = 1 - orderState.ticksLeft / ORDER_TICKS;
    const barX = sx(mainGeometry.counter.x - 18);
    const barY = sy(mainGeometry.counter.y - 20);
    const barW = mainGeometry.counter.w + 36;
    ctx.fillStyle = '#120d18cc';
    ctx.fillRect(barX, barY, barW, 8);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(barX, barY, Math.max(0, Math.min(1, ratio)) * barW, 8);
    ctx.strokeStyle = '#ffe9a9';
    ctx.strokeRect(barX, barY, barW, 8);
  }

  function sx(x) { return x - camera.x; }
  function sy(y) { return y - camera.y; }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function cellRect(origin, col, row) {
    return { x: origin.x + col * TILE, y: origin.y + row * TILE, w: TILE, h: TILE };
  }

  function matrix(rows) {
    return rows.map(row => row.trim().split(/\s+/));
  }

  function insetRect(rect, inset) {
    return { x: rect.x + inset, y: rect.y + inset, w: rect.w - inset * 2, h: rect.h - inset * 2 };
  }

  function expandRect(rect, dx, dy) {
    return { x: rect.x - dx, y: rect.y - dy, w: rect.w + dx * 2, h: rect.h + dy * 2 };
  }

  function unionRect(a, b) {
    if (!a) return { ...b };
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + a.w, b.x + b.w);
    const y2 = Math.max(a.y + a.h, b.y + b.h);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }

  function centerTarget(rect, actor) {
    return { x: rect.x + rect.w / 2 - actor.w / 2, y: rect.y + rect.h / 2 - actor.h / 2 };
  }

  function offsetPoint(x, y) {
    return { x, y };
  }

  function placeNiupaiNearPlayer() {
    const candidates = [
      { x: player.x - 30, y: player.y + 2 },
      { x: player.x + player.w + 6, y: player.y + 2 },
      { x: player.x - 8, y: player.y + player.h + 8 },
      { x: player.x - 8, y: player.y - niupai.h - 8 },
    ];

    for (const c of candidates) {
      const rect = { x: c.x, y: c.y, w: niupai.w, h: niupai.h };
      if (withinSectionBounds(rect) && !collidesObstacle(rect)) {
        niupai.x = rect.x;
        niupai.y = rect.y;
        return;
      }
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function centerOf(r) {
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  function distance(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  function distanceBetweenCenters(a, b) {
    const ac = centerOf(a);
    const bc = centerOf(b);
    return distance(ac.x, ac.y, bc.x, bc.y);
  }

  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function foodName(food) {
    return food ? food.label : 'Food';
  }

  return { start, stop };
})();

window.MiniGame_NiuPai = MiniGame_NiuPai;
