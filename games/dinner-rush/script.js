(function () {
  "use strict";

  const LEVELS = [
    {
      id: "lunch", name: "Quick Lunch", difficulty: "Easy",
      boardMinutes: 30, gridStep: 5,
      resources: { oven: 0, stovetop: 2, counter: 2 },
      dishes: [
        { id: "grilledcheese", name: "Grilled Cheese", emoji: "🧀", color: "#e8622c",
          steps: [
            { type: "counter", duration: 5, label: "Butter & Assemble" },
            { type: "stovetop", duration: 10, label: "Grill" },
          ] },
        { id: "tomatosoup", name: "Tomato Soup", emoji: "🍅", color: "#3a86ff",
          steps: [
            { type: "counter", duration: 10, label: "Chop & Blend" },
            { type: "stovetop", duration: 15, label: "Simmer" },
          ] },
      ],
      dependencies: [],
    },
    {
      id: "family", name: "Family Dinner", difficulty: "Medium",
      boardMinutes: 40, gridStep: 5,
      resources: { oven: 1, stovetop: 2, counter: 2 },
      dishes: [
        { id: "spaghetti", name: "Spaghetti", emoji: "🍝", color: "#e8622c",
          steps: [
            { type: "counter", duration: 5, label: "Prep" },
            { type: "stovetop", duration: 10, label: "Boil Pasta" },
          ] },
        { id: "meatsauce", name: "Meat Sauce", emoji: "🍲", color: "#c1121f",
          steps: [
            { type: "counter", duration: 8, label: "Prep" },
            { type: "stovetop", duration: 25, label: "Simmer" },
          ] },
        { id: "garlicbread", name: "Garlic Bread", emoji: "🥖", color: "#e9b44c",
          steps: [
            { type: "counter", duration: 5, label: "Prep" },
            { type: "oven", duration: 10, label: "Bake" },
          ] },
        { id: "salad", name: "Side Salad", emoji: "🥗", color: "#3a9d5d",
          steps: [
            { type: "counter", duration: 10, label: "Chop & Toss" },
          ] },
      ],
      dependencies: [],
    },
    {
      id: "holiday", name: "Holiday Roast", difficulty: "Hard",
      boardMinutes: 180, gridStep: 5,
      resources: { oven: 1, stovetop: 2, counter: 3 },
      dishes: [
        { id: "pie", name: "Apple Pie", emoji: "🥧", color: "#c17a3d",
          steps: [
            { type: "counter", duration: 20, label: "Prep" },
            { type: "oven", duration: 45, label: "Bake" },
            { type: "counter", duration: 15, label: "Cool" },
          ] },
        { id: "chicken", name: "Roast Chicken", emoji: "🍗", color: "#c1121f",
          steps: [
            { type: "counter", duration: 15, label: "Prep" },
            { type: "oven", duration: 75, label: "Roast" },
            { type: "counter", duration: 15, label: "Rest" },
          ] },
        { id: "potatoes", name: "Mashed Potatoes", emoji: "🥔", color: "#e9b44c",
          steps: [
            { type: "counter", duration: 10, label: "Prep" },
            { type: "stovetop", duration: 20, label: "Boil" },
            { type: "counter", duration: 5, label: "Mash" },
          ] },
        { id: "beans", name: "Green Beans", emoji: "🫛", color: "#3a9d5d",
          steps: [
            { type: "counter", duration: 5, label: "Prep" },
            { type: "stovetop", duration: 10, label: "Sauté" },
          ] },
        { id: "gravy", name: "Gravy", emoji: "🥣", color: "#8a5a3d",
          steps: [
            { type: "counter", duration: 5, label: "Prep" },
            { type: "stovetop", duration: 10, label: "Simmer" },
          ] },
      ],
      dependencies: [
        { dish: "gravy", step: 0, afterDish: "chicken", afterStep: 1 },
      ],
    },
  ];

  const RESOURCE_LABELS = { oven: "Oven", stovetop: "Burner", counter: "Counter" };
  const PX_PER_MIN = 18;
  const ROW_H = 42;
  const LABEL_W = 84;

  const levelBarEl = document.getElementById("levelBar");
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

  const STORAGE_KEY = "dinnerrush.solved.v1";
  const solved = loadSolved();

  let currentLevelIndex = 0;
  let level = null;
  let lanes = [];
  // placements: Map "dishId.stepIndex" -> { laneId, start }
  let placements = new Map();
  let won = false;

  function loadSolved() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveSolved() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(solved)); }
    catch (e) { /* ignore */ }
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
        btn.textContent = lvl.name;
        btn.dataset.index = i;
        if (solved[lvl.id]) btn.classList.add("solved");
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

  function buildLanes(lvl) {
    const out = [];
    ["oven", "stovetop", "counter"].forEach((type) => {
      const count = lvl.resources[type] || 0;
      for (let i = 1; i <= count; i++) {
        out.push({
          id: type + i,
          type,
          label: count > 1 ? `${RESOURCE_LABELS[type]} ${i}` : RESOURCE_LABELS[type],
        });
      }
    });
    return out;
  }

  function stepKey(dishId, stepIndex) {
    return dishId + "." + stepIndex;
  }

  function getDish(dishId) {
    return level.dishes.find((d) => d.id === dishId);
  }

  function loadLevel(index) {
    currentLevelIndex = index;
    level = LEVELS[index];
    lanes = buildLanes(level);
    placements = new Map();
    won = false;
    hideWin();
    render();
    highlightActiveLevelBtn();
  }

  // ---------- Validity computation ----------
  function computeValidity() {
    const invalid = new Set(); // stepKeys
    // Lane overlap check (pairwise, per lane)
    lanes.forEach((lane) => {
      const items = [];
      placements.forEach((p, key) => {
        if (p.laneId === lane.id) {
          const [dishId, idxStr] = key.split(".");
          const step = getDish(dishId).steps[Number(idxStr)];
          items.push({ key, start: p.start, end: p.start + step.duration });
        }
      });
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          if (items[i].start < items[j].end && items[j].start < items[i].end) {
            invalid.add(items[i].key);
            invalid.add(items[j].key);
          }
        }
      }
    });

    // Dish step ordering
    level.dishes.forEach((dish) => {
      for (let i = 0; i < dish.steps.length - 1; i++) {
        const aKey = stepKey(dish.id, i);
        const bKey = stepKey(dish.id, i + 1);
        const a = placements.get(aKey);
        const b = placements.get(bKey);
        if (a && b) {
          const aEnd = a.start + dish.steps[i].duration;
          if (b.start < aEnd) {
            invalid.add(aKey);
            invalid.add(bKey);
          }
        }
      }
    });

    // Cross-dish dependencies
    level.dependencies.forEach((dep) => {
      const fromKey = stepKey(dep.afterDish, dep.afterStep);
      const toKey = stepKey(dep.dish, dep.step);
      const from = placements.get(fromKey);
      const to = placements.get(toKey);
      if (from && to) {
        const fromDish = getDish(dep.afterDish);
        const fromEnd = from.start + fromDish.steps[dep.afterStep].duration;
        if (to.start < fromEnd) {
          invalid.add(fromKey);
          invalid.add(toKey);
        }
      }
    });

    // Per-dish readiness
    const dishState = {};
    level.dishes.forEach((dish) => {
      const total = dish.steps.length;
      let placedCount = 0;
      let anyInvalid = false;
      dish.steps.forEach((step, i) => {
        const key = stepKey(dish.id, i);
        if (placements.has(key)) placedCount++;
        if (invalid.has(key)) anyInvalid = true;
      });
      let state = "empty";
      let offBy = null;
      if (placedCount === total) {
        const lastKey = stepKey(dish.id, total - 1);
        const last = placements.get(lastKey);
        const lastDur = dish.steps[total - 1].duration;
        offBy = level.boardMinutes - (last.start + lastDur);
        if (anyInvalid) state = "conflict";
        else if (offBy === 0) state = "ready";
        else state = "early";
      } else if (placedCount > 0) {
        state = "partial";
      }
      dishState[dish.id] = { state, offBy, placedCount, total };
    });

    return { invalid, dishState };
  }

  // ---------- Rendering ----------
  function render() {
    renderBoard();
    const { invalid, dishState } = computeValidity();
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
  function attachChipDrag(el, dishId, stepIndex, fromTray) {
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
    const wasPlaced = placements.has(key);
    const prevPlacement = wasPlaced ? { ...placements.get(key) } : null;

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
      solved[level.id] = true;
      saveSolved();
      buildLevelBar();
      setTimeout(showWin, 200);
    }
  }

  function showWin() {
    winStats.textContent = `${level.name} complete — every dish hit the table hot!`;
    winOverlay.hidden = false;
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
  serveBtn.addEventListener("click", () => {
    const { invalid, dishState } = computeValidity();
    checkWin(dishState, invalid);
    if (!won) {
      serveBtn.classList.add("invalid");
      setTimeout(() => serveBtn.classList.remove("invalid"), 600);
    }
  });

  buildLevelBar();
  loadLevel(0);
})();
