(function () {
  "use strict";

  const LEVELS = window.DINNER_RUSH_LEVELS;
  const { pantryCards, methodState } = window.DinnerRushEngine;

  const levelMapEl = document.getElementById("levelMap");
  const levelTitleEl = document.getElementById("levelTitle");
  const levelSubEl = document.getElementById("levelSub");
  const prevLevelBtn = document.getElementById("prevLevelBtn");
  const nextLevelBtn = document.getElementById("nextLevelBtn");
  const recipeNameEl = document.getElementById("recipeName");

  const pantryPhaseEl = document.getElementById("pantryPhase");
  const pantryGridEl = document.getElementById("pantryGrid");
  const pantryProgressEl = document.getElementById("pantryProgress");
  const confirmPantryBtn = document.getElementById("confirmPantryBtn");

  const methodPhaseEl = document.getElementById("methodPhase");
  const methodListEl = document.getElementById("methodList");
  const methodProgressEl = document.getElementById("methodProgress");
  const confirmMethodBtn = document.getElementById("confirmMethodBtn");

  const resetBtn = document.getElementById("resetBtn");
  const winOverlay = document.getElementById("winOverlay");
  const winStats = document.getElementById("winStats");
  const replayBtn = document.getElementById("replayBtn");
  const nextBtn = document.getElementById("nextBtn");

  const PROGRESS_KEY = "dinnerrush.progress.v2";
  const progress = loadProgress();

  let currentLevelIndex = 0;
  let level = null;
  let pantryShuffled = [];
  let pantrySelected = new Set();
  let pantryFound = new Set();
  let pantrySolved = false;
  let methodOrder = [];
  let methodFeedback = null; // array of booleans per position, or null
  let won = false;

  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (p && typeof p.highestUnlocked === "number" && p.solved) return p;
    } catch (e) { /* ignore */ }
    return { highestUnlocked: 1, solved: {} };
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); }
    catch (e) { /* ignore */ }
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Level map / nav ----------
  function buildLevelMap() {
    levelMapEl.innerHTML = "";
    LEVELS.forEach((lvl, i) => {
      const n = i + 1;
      const btn = document.createElement("button");
      btn.className = "stage-btn";
      btn.textContent = n;
      btn.dataset.index = i;
      const unlocked = n <= progress.highestUnlocked;
      if (progress.solved[lvl.id]) btn.classList.add("solved");
      else if (unlocked) btn.classList.add("unlocked");
      else btn.classList.add("locked");
      if (!unlocked) btn.disabled = true;
      btn.addEventListener("click", () => { if (unlocked) loadLevel(i); });
      levelMapEl.appendChild(btn);
    });
    updateLevelMapActive();
  }

  function updateLevelMapActive() {
    levelMapEl.querySelectorAll(".stage-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.index) === currentLevelIndex);
    });
    const activeBtn = levelMapEl.querySelector(".stage-btn.active");
    if (activeBtn) activeBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function updateNav() {
    levelTitleEl.textContent = level.name;
    levelSubEl.textContent = `${currentLevelIndex + 1} / ${LEVELS.length}`;
    prevLevelBtn.disabled = currentLevelIndex === 0;
    nextLevelBtn.disabled = currentLevelIndex >= progress.highestUnlocked - 1 || currentLevelIndex >= LEVELS.length - 1;
  }

  // ---------- Level loading ----------
  function loadLevel(index) {
    currentLevelIndex = index;
    level = LEVELS[index];
    won = false;
    hideWin();

    pantryShuffled = shuffle(pantryCards(level));
    pantrySelected = new Set();
    pantryFound = new Set();
    pantrySolved = false;

    let order = shuffle(level.steps);
    if (level.steps.length > 1 && order.every((s, i) => s === level.steps[i])) order = shuffle(level.steps);
    methodOrder = order;
    methodFeedback = null;

    recipeNameEl.textContent = level.recipeName;
    pantryPhaseEl.hidden = false;
    methodPhaseEl.hidden = true;

    renderPantry();
    renderMethod();
    updateNav();
    updateLevelMapActive();
  }

  // ---------- Pantry phase ----------
  function renderPantry() {
    pantryGridEl.innerHTML = "";
    pantryShuffled.forEach((ing) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "pantry-card";
      card.textContent = ing;
      if (pantryFound.has(ing)) {
        card.classList.add("found");
        card.disabled = true;
      } else if (pantrySelected.has(ing)) {
        card.classList.add("selected");
      }
      card.addEventListener("click", () => {
        if (pantryFound.has(ing) || pantrySolved) return;
        if (pantrySelected.has(ing)) pantrySelected.delete(ing);
        else pantrySelected.add(ing);
        renderPantry();
      });
      pantryGridEl.appendChild(card);
    });
    pantryProgressEl.textContent = `${pantryFound.size} / ${level.ingredients.length} found`;
  }

  confirmPantryBtn.addEventListener("click", () => {
    if (pantrySolved) return;
    const wrongPicks = [];
    pantrySelected.forEach((ing) => {
      if (level.ingredients.includes(ing)) pantryFound.add(ing);
      else wrongPicks.push(ing);
    });
    pantrySelected = new Set();
    renderPantry();

    if (wrongPicks.length) {
      wrongPicks.forEach((ing) => {
        const card = [...pantryGridEl.children].find((c) => c.textContent === ing);
        if (card) {
          card.classList.add("wrong-flash");
          card.addEventListener("animationend", () => card.classList.remove("wrong-flash"), { once: true });
        }
      });
    }

    if (pantryFound.size === level.ingredients.length) {
      pantrySolved = true;
      setTimeout(() => {
        pantryPhaseEl.hidden = true;
        methodPhaseEl.hidden = false;
        methodPhaseEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    }
  });

  // ---------- Method phase ----------
  function renderMethod() {
    methodListEl.innerHTML = "";
    methodOrder.forEach((step, i) => {
      const li = document.createElement("li");
      li.className = "method-item";
      if (methodFeedback) li.classList.add(methodFeedback[i] ? "correct" : "incorrect");
      const badge = document.createElement("span");
      badge.className = "method-index";
      badge.textContent = i + 1;
      const text = document.createElement("span");
      text.className = "method-text";
      text.textContent = step;
      li.appendChild(badge);
      li.appendChild(text);
      attachMethodDrag(li, i);
      methodListEl.appendChild(li);
    });
    const correctNow = methodFeedback ? methodFeedback.filter(Boolean).length : 0;
    methodProgressEl.textContent = `${correctNow} / ${level.steps.length} in place`;
  }

  function attachMethodDrag(el, index) {
    el.addEventListener("pointerdown", (e) => {
      if (won) return;
      e.preventDefault();
      startMethodDrag(e, index);
    });
  }

  function startMethodDrag(e, index) {
    methodFeedback = null;
    const step = methodOrder[index];
    const sourceEl = methodListEl.children[index];
    const rect = sourceEl.getBoundingClientRect();

    const ghost = document.createElement("div");
    ghost.className = "method-ghost";
    ghost.style.width = rect.width + "px";
    ghost.textContent = step;
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.body.appendChild(ghost);
    sourceEl.classList.add("drag-source");

    const offsetY = e.clientY - rect.top;

    function moveGhost(clientY) {
      ghost.style.top = clientY - offsetY + "px";
    }
    moveGhost(e.clientY);

    function onMove(ev) {
      moveGhost(ev.clientY);
    }

    function onUp(ev) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ghost.remove();

      const items = [...methodListEl.children];
      let targetIndex = items.length - 1;
      for (let i = 0; i < items.length; i++) {
        const r = items[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { targetIndex = i; break; }
      }

      const [moved] = methodOrder.splice(index, 1);
      methodOrder.splice(targetIndex, 0, moved);
      renderMethod();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  confirmMethodBtn.addEventListener("click", () => {
    if (won) return;
    const state = methodState(level, methodOrder);
    methodFeedback = methodOrder.map((s, i) => s === level.steps[i]);
    renderMethod();

    if (state.solved) {
      won = true;
      progress.solved[level.id] = true;
      const levelNumber = currentLevelIndex + 1;
      if (levelNumber === progress.highestUnlocked && levelNumber < LEVELS.length) {
        progress.highestUnlocked = levelNumber + 1;
      }
      saveProgress();
      buildLevelMap();
      updateNav();
      setTimeout(showWin, 300);
    }
  });

  // ---------- Win ----------
  function showWin() {
    const isLast = currentLevelIndex >= LEVELS.length - 1;
    winStats.textContent = isLast
      ? `${level.recipeName} complete — you've cleared all ${LEVELS.length} recipes!`
      : `${level.recipeName}, solved straight from the real 1896 recipe.`;
    winOverlay.hidden = false;
    nextBtn.disabled = isLast;
    nextBtn.style.opacity = isLast ? 0.5 : 1;
  }

  function hideWin() {
    winOverlay.hidden = true;
  }

  resetBtn.addEventListener("click", () => loadLevel(currentLevelIndex));
  replayBtn.addEventListener("click", () => loadLevel(currentLevelIndex));
  nextBtn.addEventListener("click", () => {
    if (currentLevelIndex < LEVELS.length - 1) loadLevel(currentLevelIndex + 1);
  });
  prevLevelBtn.addEventListener("click", () => {
    if (currentLevelIndex > 0) loadLevel(currentLevelIndex - 1);
  });
  nextLevelBtn.addEventListener("click", () => {
    if (currentLevelIndex < progress.highestUnlocked - 1 && currentLevelIndex < LEVELS.length - 1) {
      loadLevel(currentLevelIndex + 1);
    }
  });

  buildLevelMap();
  loadLevel(Math.min(progress.highestUnlocked, LEVELS.length) - 1);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* offline support is optional */ });
    });
  }
})();
