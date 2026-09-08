(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.DinnerRushEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RESOURCE_LABELS = { oven: "Oven", stovetop: "Burner", counter: "Counter" };

  function stepKey(dishId, stepIndex) {
    return dishId + "." + stepIndex;
  }

  function getDish(level, dishId) {
    return level.dishes.find((d) => d.id === dishId);
  }

  function buildLanes(level) {
    const out = [];
    ["oven", "stovetop", "counter"].forEach((type) => {
      const count = level.resources[type] || 0;
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

  // placements: Map "dishId.stepIndex" -> { laneId, start }
  function computeValidity(level, placements) {
    const invalid = new Set();
    const lanes = buildLanes(level);

    lanes.forEach((lane) => {
      const items = [];
      placements.forEach((p, key) => {
        if (p.laneId === lane.id) {
          const [dishId, idxStr] = key.split(".");
          const step = getDish(level, dishId).steps[Number(idxStr)];
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

    (level.dependencies || []).forEach((dep) => {
      const fromKey = stepKey(dep.afterDish, dep.afterStep);
      const toKey = stepKey(dep.dish, dep.step);
      const from = placements.get(fromKey);
      const to = placements.get(toKey);
      if (from && to) {
        const fromDish = getDish(level, dep.afterDish);
        const fromEnd = from.start + fromDish.steps[dep.afterStep].duration;
        if (to.start < fromEnd) {
          invalid.add(fromKey);
          invalid.add(toKey);
        }
      }
    });

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

  function isSolved(level, placements) {
    const { invalid, dishState } = computeValidity(level, placements);
    if (invalid.size > 0) return false;
    return level.dishes.every((d) => dishState[d.id].state === "ready");
  }

  return { RESOURCE_LABELS, stepKey, getDish, buildLanes, computeValidity, isSolved };
});
