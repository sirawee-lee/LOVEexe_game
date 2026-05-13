'use strict';

/**
 * GameManager — single source of truth for all game state.
 * Access via window.GameManager (singleton).
 */
const GameManager = (() => {

  // ── State ──────────────────────────────────────────────────
  let state = {};

  function reset() {
    state = {
      hearts: 0,           // 0-3 heart fragments
      coins: 0,
      affinity: 0,         // 0-100 affinity with Mei

      // mini-game completion flags
      professorDone: false,
      niupaiDone: false,
      fatherDone: false,

      // easter egg trackers
      fedNiupaiCount: 0,   // times player fed Niu Pai
      neverRomantic: true, // true if player never picked a romantic dialogue
    };
  }

  // ── Hearts ─────────────────────────────────────────────────
  function addHeart() {
    if (state.hearts < 3) state.hearts++;
    HUDController.update();
  }

  function getHearts() { return state.hearts; }

  // ── Coins ──────────────────────────────────────────────────
  function addCoins(n) {
    state.coins += n;
    HUDController.update();
  }

  function getCoins() { return state.coins; }

  // ── Affinity ───────────────────────────────────────────────
  function changeAffinity(delta) {
    state.affinity = Math.max(0, Math.min(100, state.affinity + delta));
    if (delta > 0) state.neverRomantic = false;
    HUDController.update();
  }

  function getAffinity() { return state.affinity; }

  // ── Mini-game completion ────────────────────────────────────
  function completeMiniGame(name) {
    if (name === 'professor') {
      if (!state.professorDone) { state.professorDone = true; addHeart(); }
    } else if (name === 'niupai') {
      state.niupaiDone = true;
    } else if (name === 'father') {
      if (!state.fatherDone) { state.fatherDone = true; addHeart(); }
    }
  }

  function feedNiupai() {
    state.fedNiupaiCount++;
    if (state.fedNiupaiCount >= 3) {
      HUDController.showToast('Niu Pai loves you! 🐕');
    }
  }

  function getState() { return { ...state }; }

  // ── Screen switching (thin wrapper) ─────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
  }

  // ── New game entry point ────────────────────────────────────
  function startNewGame() {
    reset();
    HUDController.update();
    DialogueSystem.start('intro_girl', () => {
      showScreen('game');
      PlayerController.init();
    });
    showScreen('game');
    PlayerController.init();
  }

  function backToTitle() {
    showScreen('title');
  }

  function showCredits() {
    HUDController.showToast('LOVE.EXE — Group 23 | SS2026 NTHU');
  }

  return {
    reset, startNewGame, backToTitle, showCredits, showScreen,
    addHeart, getHearts,
    addCoins, getCoins,
    changeAffinity, getAffinity,
    completeMiniGame, feedNiupai,
    getState,
  };
})();

// make accessible as both GameManager and Game (used in HTML onclick)
window.GameManager = GameManager;
window.Game = GameManager;
