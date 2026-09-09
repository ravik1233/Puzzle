(function () {
  "use strict";

  const LEVELS = window.DINNER_RUSH_LEVELS;
  const { pantryCards } = window.DinnerRushEngine;
  const STATIONS = ["counter", "stovetop", "oven"];

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

  const stationsPhaseEl = document.getElementById("stationsPhase");
  const stationTrayEl = document.getElementById("stationTray");
  const stationsProgressEl = document.getElementById("stationsProgress");
  const confirmStationsBtn = document.getElementById("confirmStationsBtn");
  const zoneEls = { counter: document.getElementById("zoneCounter"), stovetop: document.getElementById("zoneStovetop"), oven: document.getElementById("zoneOven") };

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
  let stationPlaced = new Map(); // stepIndex -> station (tentative, unconfirmed)
  let stationFound = new Map(); // stepIndex -> station (locked correct)
  let trayOrder = []; // step indices not yet placed anywhere
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

    stationPlaced = new Map();
    stationFound = new Map();
    trayOrder = shuffle(level.steps.map((_, i) => i));

    recipeNameEl.textContent = level.recipeName;
    pantryPhaseEl.hidden = false;
    stationsPhaseEl.hidden = true;

    renderPantry();
    renderStations();
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
        stationsPhaseEl.hidden = false;
        stationsPhaseEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    }
  });

  // ---------- Stations phase ----------
  function makeStepCard(idx, extraClass) {
    const step = level.steps[idx];
    const card = document.createElement("div");
    card.className = "step-card" + (extraClass ? " " + extraClass : "");
    card.textContent = step.text;
    card.dataset.index = idx;
    return card;
  }

  function renderStations() {
    STATIONS.forEach((st) => (zoneEls[st].innerHTML = ""));
    stationTrayEl.innerHTML = "";

    stationFound.forEach((st, idx) => {
      const card = makeStepCard(idx, "found");
      zoneEls[st].appendChild(card);
    });
    stationPlaced.forEach((st, idx) => {
      const card = makeStepCard(idx, "placed");
      attachStationDrag(card, idx);
      zoneEls[st].appendChild(card);
    });
    trayOrder.forEach((idx) => {
      const card = makeStepCard(idx);
      attachStationDrag(card, idx);
      stationTrayEl.appendChild(card);
    });

    stationsProgressEl.textContent = `${stationFound.size} / ${level.steps.length} placed`;
  }

  function hitTestZone(clientX, clientY) {
    for (const st of STATIONS) {
      const r = zoneEls[st].getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return st;
    }
    return null;
  }

  function attachStationDrag(el, idx) {
    el.addEventListener("pointerdown", (e) => {
      if (won) return;
      e.preventDefault();
      startStationDrag(e, idx);
    });
  }

  function startStationDrag(e, idx) {
    const step = level.steps[idx];
    const sourceEl = document.querySelector(`.step-card[data-index="${idx}"]`);
    const rect = sourceEl.getBoundingClientRect();

    const ghost = document.createElement("div");
    ghost.className = "step-ghost";
    ghost.style.width = rect.width + "px";
    ghost.textContent = step.text;
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.body.appendChild(ghost);

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    function moveGhost(clientX, clientY) {
      ghost.style.left = clientX - offsetX + "px";
      ghost.style.top = clientY - offsetY + "px";
    }
    moveGhost(e.clientX, e.clientY);

    function updateHover(clientX, clientY) {
      STATIONS.forEach((st) => zoneEls[st].classList.toggle("hover", hitTestZone(clientX, clientY) === st));
    }
    updateHover(e.clientX, e.clientY);

    function onMove(ev) {
      moveGhost(ev.clientX, ev.clientY);
      updateHover(ev.clientX, ev.clientY);
    }

    function onUp(ev) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ghost.remove();
      STATIONS.forEach((st) => zoneEls[st].classList.remove("hover"));

      const targetZone = hitTestZone(ev.clientX, ev.clientY);
      trayOrder = trayOrder.filter((i) => i !== idx);
      stationPlaced.delete(idx);
      if (targetZone) {
        stationPlaced.set(idx, targetZone);
      } else {
        trayOrder.push(idx);
      }
      renderStations();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  confirmStationsBtn.addEventListener("click", () => {
    if (won) return;
    const wrongIdx = [];
    const correctIdx = [];
    stationPlaced.forEach((st, idx) => {
      if (level.steps[idx].station === st) correctIdx.push(idx);
      else wrongIdx.push(idx);
    });
    correctIdx.forEach((idx) => {
      stationFound.set(idx, stationPlaced.get(idx));
      stationPlaced.delete(idx);
    });
    wrongIdx.forEach((idx) => stationPlaced.delete(idx));
    trayOrder = [...trayOrder, ...wrongIdx];
    renderStations();

    wrongIdx.forEach((idx) => {
      const card = document.querySelector(`.step-card[data-index="${idx}"]`);
      if (card) {
        card.classList.add("wrong-flash");
        card.addEventListener("animationend", () => card.classList.remove("wrong-flash"), { once: true });
      }
    });

    if (stationFound.size === level.steps.length) {
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
