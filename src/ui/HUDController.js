'use strict';

/**
 * HUDController — updates hearts, coins, affinity display and toast notifications.
 */
const HUDController = (() => {

  let toastTimer = null;

  function update() {
    const s = GameManager.getState();

    // Hearts (0-3)
    const heartsEl = document.getElementById('hud-hearts');
    if (heartsEl) {
      heartsEl.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const span = document.createElement('span');
        span.className = 'hud-heart';
        span.textContent = i < s.hearts ? '💗' : '🤍';
        heartsEl.appendChild(span);
      }
    }

    // Coins
    const coinsEl = document.getElementById('hud-coins');
    if (coinsEl) coinsEl.textContent = s.coins;

    // Affinity
    const affEl = document.getElementById('hud-affinity');
    if (affEl) affEl.textContent = `Affinity: ${s.affinity}`;

    // Mini-game HUD elements (if visible)
    updateMiniGameHUD();
  }

  function updateMiniGameHUD(left, center, right) {
    const l = document.getElementById('mg-left');
    const c = document.getElementById('mg-center');
    const r = document.getElementById('mg-right');
    if (l && left   !== undefined) l.textContent = left;
    if (c && center !== undefined) c.textContent = center;
    if (r && right  !== undefined) r.textContent = right;
  }

  function showToast(msg, duration = 2000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('active');
    void toast.offsetWidth; // reflow to restart animation
    toast.classList.add('active');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('active'), duration);
  }

  function setMiniGameTitle(title, subtitle) {
    const t = document.getElementById('minigame-title');
    const s = document.getElementById('minigame-subtitle');
    if (t) t.textContent = title;
    if (s) s.textContent = subtitle || '';
  }

  function showMiniGameResult(win, titleText, bodyText, onContinue) {
    const result = document.getElementById('minigame-result');
    const rTitle = document.getElementById('result-title');
    const rBody  = document.getElementById('result-body');
    const rBtn   = document.getElementById('result-btn');

    rTitle.textContent = win ? '✨ SUCCESS!' : '💔 FAILED';
    rTitle.style.color = win ? '#ff69b4' : '#cc4444';
    rBody.textContent  = bodyText || '';
    result.classList.add('active');

    rBtn.onclick = () => {
      result.classList.remove('active');
      GameManager.showScreen('game');
      if (onContinue) onContinue();
    };
  }

  return { update, updateMiniGameHUD, showToast, setMiniGameTitle, showMiniGameResult };
})();

window.HUDController = HUDController;
