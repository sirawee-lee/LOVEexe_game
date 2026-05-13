'use strict';

/**
 * EndingManager — resolves which of the 5 endings to trigger
 * and drives the ending screen using data from game-data.json.
 */
const EndingManager = (() => {

  let endingData = null;
  let currentSlides = [];
  let slideIndex = 0;

  async function loadData() {
    if (endingData) return;
    try {
      const res = await fetch('assets/resources/game-data.json');
      const json = await res.json();
      endingData = json.endings;
    } catch(e) {
      endingData = {};
    }
  }

  /**
   * Determine which ending to show based on current game state,
   * then transition to the ending screen.
   */
  function resolve() {
    const s = GameManager.getState();
    let key;

    // Priority order as per SRS
    if (s.fedNiupaiCount >= 3 && s.affinity < 20) {
      key = 'ending_niupai';
    } else if (s.neverRomantic && s.professorDone && s.niupaiDone && s.fatherDone) {
      key = 'ending_eecs_overload';
    } else if (s.hearts >= 3 && s.affinity >= 70) {
      key = 'ending_true_love';
    } else if (s.hearts >= 2 || s.affinity >= 40) {
      key = 'ending_friend_zone';
    } else {
      key = 'ending_rejected';
    }

    show(key);
  }

  async function show(key) {
    await loadData();
    const ending = endingData[key];
    if (!ending) { GameManager.backToTitle(); return; }

    currentSlides = ending.slides || [];
    slideIndex = 0;
    GameManager.showScreen('ending');
    showSlide();
  }

  function showSlide() {
    const slide = currentSlides[slideIndex];
    if (!slide) { GameManager.backToTitle(); return; }

    document.getElementById('ending-title').textContent = slide.title || '';
    document.getElementById('ending-body').textContent  = slide.body  || '';

    const imgEl = document.getElementById('ending-image-placeholder');
    imgEl.textContent = `[ ${slide.image || 'CG'} ]`;

    const btn = document.getElementById('ending-next-btn');
    btn.textContent = slideIndex < currentSlides.length - 1 ? 'Next ▶' : 'Finish';
    btn.onclick = nextSlide;
  }

  function nextSlide() {
    slideIndex++;
    if (slideIndex >= currentSlides.length) {
      GameManager.backToTitle();
    } else {
      showSlide();
    }
  }

  // Pre-load
  loadData();

  return { resolve, show };
})();

window.EndingManager = EndingManager;
