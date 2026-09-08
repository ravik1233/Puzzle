(function () {
  "use strict";

  const LEVELS = window.DINNER_RUSH_LEVELS;
  const { computeValidity, buildLanes, stepKey, getDish: engineGetDish } = window.DinnerRushEngine;

  const PX_PER_MIN = 18;
  const ROW_H = 42;
  const LABEL_W = 84;

  const levelMapEl = document.getElementById("levelMap");
  const levelTitleEl = document.getElementById("levelTitle");
  const levelSubEl = document.getElementById("levelSub");
  const prevLevelBtn = document.getElementById("prevLevelBtn");
  const nextLevelBtn = document.getElementById("nextLevelBtn");
  const statusPanelEl = document.getElementById("statusPanel");
  const boardEl = document.getElementById("board");
  const serveLineEl = document.getElementById("serveLine");
  const trayEl = document.getElementById("tray");
  const resetBtn = document.getElementById("resetBtn");
  const serveBtn = document.getElementById("serveBtn");
  const winOverlay = document.getElementById("winOverlay");
  const winStats = document.getElementById("winStats");
  const replayBtn = document.getElementById("replayBtn");
  const nextBtn = document.getElementById("nextBtn");

  const PROGRESS_KEY = "dinnerrush.progress.v1";
  const progress = loadProgress();

  let currentLevelIndex = 0;
  let level = null;
  let lanes = [];
  // placements: Map "dishId.stepIndex" -> { laneId, start }
  let placements = new Map();
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

  function getDish(dishId) {
    return engineGetDish(level, dishId);
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
    lanes = buildLanes(level);
    placements = new Map();
    won = false;
    hideWin();
    render();
    updateNav();
    updateLevelMapActive();
  }

  // ---------- Rendering ----------
  function render() {
    renderBoard();
    const { invalid, dishState } = computeValidity(level, placements);
    renderStatus(dishState);
    renderChipsOnBoard(invalid);
    renderTray(invalid);
    checkWin(dishState, invalid);
  }

  function renderBoard() {
    boardEl.querySelectorAll(".lane-row").forEach((el) => el.remove());
    const totalWidth = level.boardMinutes * PX_PER_MIN;
    boardEl.style.width = LABEL_W + totalWidth + "px";
    boardEl.style.height = lanes.length * ROW_H + "px";

    lanes.forEach((lane) => {
      const row = document.createElement("div");
      row.className = "lane-row";
      row.dataset.lane = lane.id;
      row.style.width = LABEL_W + totalWidth + "px";

      const label = document.createElement("div");
      label.className = "lane-label";
      label.style.setProperty("--label-w", LABEL_W + "px");
      label.textContent = lane.label;
      row.appendChild(label);

      const track = document.createElement("div");
      track.className = "lane-track";
      track.style.setProperty("--label-w", LABEL_W + "px");
      track.style.width = totalWidth + "px";
      track.style.backgroundImage =
        "repeating-linear-gradient(to right, rgba(0,0,0,0.08) 0, rgba(0,0,0,0.08) 1px, transparent 1px, transparent " +
        (30 * PX_PER_MIN) + "px), repeating-linear-gradient(to right, rgba(0,0,0,0.04) 0, rgba(0,0,0,0.04) 1px, transparent 1px, transparent " +
        (PX_PER_MIN * level.gridStep) + "px)";
      row.appendChild(track);

      boardEl.insertBefore(row, serveLineEl);
    });

    serveLineEl.style.left = LABEL_W + totalWidth + "px";
    serveLineEl.style.height = lanes.length * ROW_H + "px";
  }

  function renderChipsOnBoard(invalid) {
    boardEl.querySelectorAll(".chip").forEach((el) => el.remove());
    placements.forEach((p, key) => {
      const [dishId, idxStr] = key.split(".");
      const dish = getDish(dishId);
      const step = dish.steps[Number(idxStr)];
      const track = boardEl.querySelector(`.lane-row[data-lane="${p.laneId}"] .lane-track`);
      if (!track) return;
      const chip = document.createElement("div");
      chip.className = "chip" + (invalid.has(key) ? " invalid" : "");
      chip.dataset.key = key;
      chip.style.background = dish.color;
      chip.style.left = p.start * PX_PER_MIN + "px";
      chip.style.width = step.duration * PX_PER_MIN - 2 + "px";
      chip.textContent = `${dish.emoji} ${step.label}`;
      attachChipDrag(chip, dishId, Number(idxStr));
      track.appendChild(chip);
    });
  }

  function renderStatus(dishState) {
    statusPanelEl.innerHTML = "";
    level.dishes.forEach((dish) => {
      const st = dishState[dish.id];
      const chip = document.createElement("div");
      chip.className = "status-chip";
      chip.style.setProperty("--dish-color", dish.color);
      let text;
      if (st.state === "ready") { chip.classList.add("ready"); text = "Ready!"; }
      else if (st.state === "conflict") { chip.classList.add("off"); text = "Conflict"; }
      else if (st.state === "early") { chip.classList.add("off"); text = `${st.offBy}m early`; }
      else if (st.state === "partial") { text = `${st.placedCount}/${st.total} placed`; }
      else { text = "Not started"; }
      chip.innerHTML = `<span>${dish.emoji} ${dish.name}</span><span class="state">${text}</span>`;
      statusPanelEl.appendChild(chip);
    });
  }

  function renderTray(invalid) {
    trayEl.innerHTML = "";
    level.dishes.forEach((dish) => {
      const card = document.createElement("div");
      card.className = "dish-card";
      card.style.setProperty("--dish-color", dish.color);
      const name = document.createElement("div");
      name.className = "dish-name";
      name.textContent = `${dish.emoji} ${dish.name}`;
      card.appendChild(name);
      const chipsWrap = document.createElement("div");
      chipsWrap.className = "tray-chips";
      dish.steps.forEach((step, i) => {
        const key = stepKey(dish.id, i);
        const isPlaced = placements.has(key);
        const chip = document.createElement("div");
        chip.className = "tray-chip" + (isPlaced ? " placed" : "");
        chip.style.background = dish.color;
        chip.textContent = `${step.label} · ${step.duration}m`;
        chip.dataset.key = key;
        if (!isPlaced) attachChipDrag(chip, dish.id, i, true);
        chipsWrap.appendChild(chip);
      });
      card.appendChild(chipsWrap);
      trayEl.appendChild(card);
    });
  }

  // ---------- Drag & drop ----------
  function attachChipDrag(el, dishId, stepIndex) {
    el.addEventListener("pointerdown", (e) => {
      if (won) return;
      e.preventDefault();
      startDrag(e, dishId, stepIndex);
    });
  }

  function startDrag(e, dishId, stepIndex) {
    const dish = getDish(dishId);
    const step = dish.steps[stepIndex];
    const key = stepKey(dishId, stepIndex);

    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.style.background = dish.color;
    ghost.style.width = step.duration * PX_PER_MIN + "px";
    ghost.style.height = ROW_H - 6 + "px";
    ghost.textContent = `${dish.emoji} ${step.label}`;
    document.body.appendChild(ghost);

    // remove from placements while dragging so it doesn't collide with itself
    placements.delete(key);
    render();

    function moveGhost(clientX, clientY) {
      ghost.style.left = clientX - ghost.offsetWidth / 2 + "px";
      ghost.style.top = clientY - ghost.offsetHeight / 2 + "px";
    }
    moveGhost(e.clientX, e.clientY);

    function onMove(ev) {
      moveGhost(ev.clientX, ev.clientY);
    }

    function onUp(ev) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ghost.remove();

      const rows = boardEl.querySelectorAll(".lane-row");
      let targetLane = null;
      rows.forEach((row) => {
        const r = row.getBoundingClientRect();
        if (ev.clientY >= r.top && ev.clientY <= r.bottom) targetLane = row.dataset.lane;
      });

      if (targetLane) {
        const lane = lanes.find((l) => l.id === targetLane);
        if (lane.type === step.type) {
          const trackRect = boardEl.getBoundingClientRect();
          const relX = ev.clientX - trackRect.left - LABEL_W - (step.duration * PX_PER_MIN) / 2;
          let startMin = Math.round(relX / PX_PER_MIN / level.gridStep) * level.gridStep;
          startMin = Math.max(0, Math.min(startMin, level.boardMinutes - step.duration));
          if (!isNaN(startMin)) {
            placements.set(key, { laneId: lane.id, start: startMin });
          }
        }
      }
      // if not placed above, it stays unplaced (back to tray)
      render();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // ---------- Win ----------
  function checkWin(dishState, invalid) {
    if (invalid.size > 0) return;
    const allReady = level.dishes.every((d) => dishState[d.id].state === "ready");
    if (allReady && !won) {
      won = true;
      progress.solved[level.id] = true;
      const levelNumber = currentLevelIndex + 1;
      if (levelNumber === progress.highestUnlocked && levelNumber < LEVELS.length) {
        progress.highestUnlocked = levelNumber + 1;
      }
      saveProgress();
      buildLevelMap();
      updateNav();
      setTimeout(showWin, 200);
    }
  }

  function showWin() {
    const isLast = currentLevelIndex >= LEVELS.length - 1;
    winStats.textContent = isLast
      ? `${level.name} complete — you've cleared all ${LEVELS.length} stages!`
      : `${level.name} complete — every dish hit the table hot!`;
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
  serveBtn.addEventListener("click", () => {
    const { invalid, dishState } = computeValidity(level, placements);
    checkWin(dishState, invalid);
    if (!won) {
      serveBtn.classList.add("invalid");
      setTimeout(() => serveBtn.classList.remove("invalid"), 600);
    }
  });

  buildLevelMap();
  loadLevel(Math.min(progress.highestUnlocked, LEVELS.length) - 1);
})();
