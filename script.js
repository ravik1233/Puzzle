(function () {
  "use strict";

  const GRID = 6;
  const EXIT_ROW = 2; // every level's target car lives on this row

  // Vehicle: { id, dir: 'H'|'V', len, row, col, color, target? }
  const LEVELS = [
    {
      id: "easy1", name: "Easy 1", difficulty: "Easy",
      vehicles: [
        { id: "target", dir: "H", len: 2, row: 2, col: 0, color: "#e63946", target: true },
        { id: "v1", dir: "V", len: 2, row: 1, col: 3, color: "#4a6fa5" },
        { id: "v2", dir: "V", len: 2, row: 0, col: 0, color: "#6c757d" },
      ],
    },
    {
      id: "easy2", name: "Easy 2", difficulty: "Easy",
      vehicles: [
        { id: "target", dir: "H", len: 2, row: 2, col: 1, color: "#e63946", target: true },
        { id: "v1", dir: "V", len: 3, row: 1, col: 4, color: "#3a86ff" },
        { id: "v2", dir: "H", len: 2, row: 5, col: 0, color: "#6c757d" },
      ],
    },
    {
      id: "medium1", name: "Medium 1", difficulty: "Medium",
      vehicles: [
        { id: "target", dir: "H", len: 2, row: 2, col: 0, color: "#e63946", target: true },
        { id: "v1", dir: "V", len: 2, row: 1, col: 2, color: "#4a6fa5" },
        { id: "v3", dir: "V", len: 3, row: 0, col: 4, color: "#2a9d8f" },
        { id: "v4", dir: "V", len: 2, row: 0, col: 0, color: "#6c757d" },
        { id: "v5", dir: "H", len: 2, row: 5, col: 2, color: "#9c6644" },
      ],
    },
    {
      id: "medium2", name: "Medium 2", difficulty: "Medium",
      vehicles: [
        { id: "target", dir: "H", len: 2, row: 2, col: 1, color: "#e63946", target: true },
        { id: "v1", dir: "V", len: 2, row: 1, col: 3, color: "#4a6fa5" },
        { id: "v3", dir: "V", len: 2, row: 1, col: 4, color: "#3a86ff" },
        { id: "v4", dir: "H", len: 2, row: 4, col: 0, color: "#6c757d" },
        { id: "v5", dir: "H", len: 3, row: 5, col: 3, color: "#9c6644" },
      ],
    },
    {
      id: "hard1", name: "Hard 1", difficulty: "Hard",
      vehicles: [
        { id: "target", dir: "H", len: 2, row: 2, col: 0, color: "#e63946", target: true },
        { id: "v1", dir: "V", len: 3, row: 0, col: 2, color: "#4a6fa5" },
        { id: "v5", dir: "H", len: 2, row: 4, col: 1, color: "#e9974a" },
        { id: "v3", dir: "V", len: 3, row: 0, col: 4, color: "#2a9d8f" },
        { id: "v7", dir: "V", len: 2, row: 0, col: 0, color: "#6c757d" },
        { id: "v8", dir: "V", len: 2, row: 0, col: 1, color: "#8d99ae" },
      ],
    },
    {
      id: "hard2", name: "Hard 2", difficulty: "Hard",
      vehicles: [
        { id: "target", dir: "H", len: 2, row: 2, col: 1, color: "#e63946", target: true },
        { id: "v1", dir: "V", len: 3, row: 0, col: 3, color: "#4a6fa5" },
        { id: "v5", dir: "H", len: 2, row: 4, col: 3, color: "#e9974a" },
        { id: "v3", dir: "V", len: 2, row: 1, col: 4, color: "#3a86ff" },
        { id: "v7", dir: "V", len: 2, row: 0, col: 0, color: "#6c757d" },
        { id: "v8", dir: "V", len: 2, row: 0, col: 1, color: "#8d99ae" },
      ],
    },
  ];

  const boardEl = document.getElementById("board");
  const levelBarEl = document.getElementById("levelBar");
  const moveCountEl = document.getElementById("moveCount");
  const timeCountEl = document.getElementById("timeCount");
  const bestCountEl = document.getElementById("bestCount");
  const resetBtn = document.getElementById("resetBtn");
  const winOverlay = document.getElementById("winOverlay");
  const winStats = document.getElementById("winStats");
  const replayBtn = document.getElementById("replayBtn");
  const nextBtn = document.getElementById("nextBtn");

  let cellSize = 0;
  let vehicles = [];
  let occ = [];
  let currentLevelIndex = 0;
  let selectedId = null;
  let moves = 0;
  let startTime = null;
  let timerInterval = null;
  let won = false;

  const STORAGE_KEY = "trafficjam.best.v1";
  const bestScores = loadBest();

  function loadBest() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveBest() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bestScores));
    } catch (e) {
      /* ignore */
    }
  }

  function buildLevelBar() {
    levelBarEl.innerHTML = "";
    const groups = {};
    LEVELS.forEach((lvl, i) => {
      groups[lvl.difficulty] = groups[lvl.difficulty] || [];
      groups[lvl.difficulty].push({ lvl, i });
    });
    Object.keys(groups).forEach((diff) => {
      const group = document.createElement("div");
      group.className = "level-group";
      const label = document.createElement("span");
      label.className = "group-label";
      label.textContent = diff;
      group.appendChild(label);
      groups[diff].forEach(({ lvl, i }) => {
        const btn = document.createElement("button");
        btn.className = "level-btn";
        btn.textContent = lvl.name.split(" ")[1];
        btn.dataset.index = i;
        if (bestScores[lvl.id]) btn.classList.add("solved");
        btn.addEventListener("click", () => loadLevel(i));
        group.appendChild(btn);
      });
      levelBarEl.appendChild(group);
    });
    highlightActiveLevelBtn();
  }

  function highlightActiveLevelBtn() {
    levelBarEl.querySelectorAll(".level-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.index) === currentLevelIndex);
    });
  }

  function cloneVehicles(list) {
    return list.map((v) => ({ ...v }));
  }

  function rebuildOcc() {
    occ = Array.from({ length: GRID }, () => Array(GRID).fill(null));
    vehicles.forEach((v) => {
      for (let k = 0; k < v.len; k++) {
        const r = v.dir === "V" ? v.row + k : v.row;
        const c = v.dir === "H" ? v.col + k : v.col;
        occ[r][c] = v.id;
      }
    });
  }

  function canPlace(vehicle, row, col) {
    if (row < 0 || col < 0) return false;
    for (let k = 0; k < vehicle.len; k++) {
      const r = vehicle.dir === "V" ? row + k : row;
      const c = vehicle.dir === "H" ? col + k : col;
      if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
      const occupant = occ[r][c];
      if (occupant && occupant !== vehicle.id) return false;
    }
    return true;
  }

  function loadLevel(index) {
    currentLevelIndex = index;
    const lvl = LEVELS[index];
    vehicles = cloneVehicles(lvl.vehicles);
    rebuildOcc();
    selectedId = null;
    moves = 0;
    won = false;
    startTime = Date.now();
    updateHUD();
    startTimer();
    hideWin();
    renderBoardStatic();
    renderVehicles();
    highlightActiveLevelBtn();
    updateBestLabel();
  }

  function updateBestLabel() {
    const lvl = LEVELS[currentLevelIndex];
    const best = bestScores[lvl.id];
    bestCountEl.textContent = best ? `${best.moves}mv / ${formatTime(best.time)}` : "–";
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (won) return;
      timeCountEl.textContent = formatTime(Date.now() - startTime);
    }, 250);
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function updateHUD() {
    moveCountEl.textContent = moves;
  }

  function renderBoardStatic() {
    boardEl.querySelectorAll(".exit-gap").forEach((el) => el.remove());
    const gap = document.createElement("div");
    gap.className = "exit-gap";
    gap.style.top = `calc(${(EXIT_ROW / GRID) * 100}% + 2px)`;
    gap.style.height = `calc(${(1 / GRID) * 100}% - 4px)`;
    boardEl.appendChild(gap);
  }

  function measure() {
    cellSize = boardEl.clientWidth / GRID;
  }

  function renderVehicles() {
    boardEl.querySelectorAll(".vehicle").forEach((el) => el.remove());
    measure();
    vehicles.forEach((v) => {
      const el = document.createElement("div");
      el.className = "vehicle dir-" + v.dir.toLowerCase();
      if (v.target) el.classList.add("target");
      el.dataset.id = v.id;
      el.style.background = v.color;
      positionVehicleEl(el, v);
      const badge = document.createElement("div");
      badge.className = "badge";
      el.appendChild(badge);
      attachDrag(el, v);
      boardEl.appendChild(el);
    });
  }

  function positionVehicleEl(el, v) {
    const pad = 4;
    const left = v.col * cellSize + pad;
    const top = v.row * cellSize + pad;
    const width = (v.dir === "H" ? v.len * cellSize : cellSize) - pad * 2;
    const height = (v.dir === "V" ? v.len * cellSize : cellSize) - pad * 2;
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.width = width + "px";
    el.style.height = height + "px";
  }

  function refreshVehiclePosition(v) {
    const el = boardEl.querySelector(`.vehicle[data-id="${v.id}"]`);
    if (el) positionVehicleEl(el, v);
  }

  function selectVehicle(id) {
    selectedId = id;
    boardEl.querySelectorAll(".vehicle").forEach((el) => {
      el.classList.toggle("selected", el.dataset.id === id);
    });
  }

  function attachDrag(el, v) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originRow = 0;
    let originCol = 0;
    let lastDelta = 0;

    el.addEventListener("pointerdown", (e) => {
      if (won) return;
      selectVehicle(v.id);
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      originRow = v.row;
      originCol = v.col;
      lastDelta = 0;
      el.setPointerCapture(e.pointerId);
      el.style.transition = "none";
    });

    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const rawDelta = v.dir === "H" ? dx / cellSize : dy / cellSize;
      const wanted = Math.round(rawDelta);
      const step = wanted > 0 ? 1 : -1;
      let delta = 0;
      while (Math.abs(delta) < Math.abs(wanted)) {
        const next = delta + step;
        const r = v.dir === "V" ? originRow + next : originRow;
        const c = v.dir === "H" ? originCol + next : originCol;
        if (canPlace(v, r, c)) delta = next;
        else break;
      }
      lastDelta = delta;
      v.row = v.dir === "V" ? originRow + delta : originRow;
      v.col = v.dir === "H" ? originCol + delta : originCol;
      refreshVehiclePosition(v);
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      el.style.transition = "";
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      rebuildOcc();
      refreshVehiclePosition(v);
      if (lastDelta !== 0) {
        moves++;
        updateHUD();
        checkWin();
      }
    }

    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
  }

  function attemptNudge(dir) {
    if (won || !selectedId) return;
    const v = vehicles.find((x) => x.id === selectedId);
    if (!v) return;
    let dr = 0, dc = 0;
    if (v.dir === "H" && (dir === "left" || dir === "right")) {
      dc = dir === "right" ? 1 : -1;
    } else if (v.dir === "V" && (dir === "up" || dir === "down")) {
      dr = dir === "down" ? 1 : -1;
    } else {
      return;
    }
    const newRow = v.row + dr;
    const newCol = v.col + dc;
    if (!canPlace(v, newRow, newCol)) return;
    v.row = newRow;
    v.col = newCol;
    rebuildOcc();
    refreshVehiclePosition(v);
    moves++;
    updateHUD();
    checkWin();
  }

  window.addEventListener("keydown", (e) => {
    const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    if (map[e.key]) {
      e.preventDefault();
      attemptNudge(map[e.key]);
    }
  });

  function checkWin() {
    const target = vehicles.find((v) => v.target);
    if (!target) return;
    if (target.col + target.len - 1 >= GRID - 1) {
      won = true;
      const el = boardEl.querySelector(`.vehicle[data-id="${target.id}"]`);
      if (el) {
        el.style.transition = "left 0.4s ease";
        el.style.left = (GRID * cellSize + 30) + "px";
      }
      const elapsed = Date.now() - startTime;
      const lvl = LEVELS[currentLevelIndex];
      const prevBest = bestScores[lvl.id];
      if (!prevBest || moves < prevBest.moves || (moves === prevBest.moves && elapsed < prevBest.time)) {
        bestScores[lvl.id] = { moves, time: elapsed };
        saveBest();
      }
      setTimeout(() => showWin(elapsed), 350);
    }
  }

  function showWin(elapsed) {
    winStats.textContent = `${moves} moves · ${formatTime(elapsed)}`;
    winOverlay.hidden = false;
    buildLevelBar();
    nextBtn.disabled = currentLevelIndex >= LEVELS.length - 1;
    nextBtn.style.opacity = nextBtn.disabled ? 0.5 : 1;
  }

  function hideWin() {
    winOverlay.hidden = true;
  }

  resetBtn.addEventListener("click", () => loadLevel(currentLevelIndex));
  replayBtn.addEventListener("click", () => loadLevel(currentLevelIndex));
  nextBtn.addEventListener("click", () => {
    if (currentLevelIndex < LEVELS.length - 1) loadLevel(currentLevelIndex + 1);
  });

  window.addEventListener("resize", () => {
    renderVehicles();
  });

  buildLevelBar();
  loadLevel(0);
})();
