#!/usr/bin/env node
"use strict";
/*
 * Generates the 100-level campaign for games/dinner-rush.
 *
 * Approach: for each level we CONSTRUCT one valid schedule first (assigning
 * every step a lane + start time with no conflicts, respecting dish step
 * order and cross-dish dependencies), then discard the placements and keep
 * only the puzzle shape (dishes/steps/resources/board length/dependencies).
 * Because a valid schedule was built, the puzzle is solvable by construction
 * -- the player just has to find a (possibly different) valid arrangement.
 * Every generated level is re-verified with the same engine.js the browser
 * game uses, against the constructor's own reference solution.
 *
 * Usage: node tools/generate-dinner-rush-levels.js > games/dinner-rush/levels-data.js
 */

const path = require("path");
const engine = require(path.join(__dirname, "..", "games", "dinner-rush", "engine.js"));

// ---------------------------------------------------------------------
// Recipe pool. Durations are all multiples of 5 (the board's grid step)
// so a dish's final step can always land exactly on a grid line.
// ---------------------------------------------------------------------
const POOL = [
  { id: "pancakes", name: "Pancakes", emoji: "🥞", meal: "breakfast", color: "#e8a13c",
    steps: [{ type: "counter", duration: 10, label: "Mix Batter" }, { type: "stovetop", duration: 10, label: "Griddle" }] },
  { id: "eggs", name: "Scrambled Eggs", emoji: "🍳", meal: "breakfast", color: "#f0c419",
    steps: [{ type: "counter", duration: 5, label: "Whisk" }, { type: "stovetop", duration: 5, label: "Cook" }] },
  { id: "bacon", name: "Bacon", emoji: "🥓", meal: "breakfast", color: "#c1666b",
    steps: [{ type: "counter", duration: 5, label: "Lay Out" }, { type: "stovetop", duration: 10, label: "Fry" }] },
  { id: "avocadotoast", name: "Avocado Toast", emoji: "🥑", meal: "breakfast", color: "#6a994e",
    steps: [{ type: "counter", duration: 10, label: "Toast & Mash" }] },
  { id: "oatmeal", name: "Oatmeal", emoji: "🥣", meal: "breakfast", color: "#a9744f",
    steps: [{ type: "counter", duration: 5, label: "Measure" }, { type: "stovetop", duration: 10, label: "Simmer" }] },
  { id: "frenchtoast", name: "French Toast", emoji: "🍞", meal: "breakfast", color: "#d4a373",
    steps: [{ type: "counter", duration: 10, label: "Dip" }, { type: "stovetop", duration: 15, label: "Griddle" }] },
  { id: "hashbrowns", name: "Hash Browns", emoji: "🥔", meal: "breakfast", color: "#e9b44c",
    steps: [{ type: "counter", duration: 10, label: "Shred" }, { type: "stovetop", duration: 15, label: "Fry" }] },
  { id: "omelette", name: "Omelette", emoji: "🍳", meal: "breakfast", color: "#f4a259",
    steps: [{ type: "counter", duration: 10, label: "Prep Fillings" }, { type: "stovetop", duration: 10, label: "Cook" }] },

  { id: "grilledcheese", name: "Grilled Cheese", emoji: "🧀", meal: "lunch", color: "#e8622c",
    steps: [{ type: "counter", duration: 5, label: "Butter & Assemble" }, { type: "stovetop", duration: 10, label: "Grill" }] },
  { id: "tomatosoup", name: "Tomato Soup", emoji: "🍅", meal: "lunch", color: "#3a86ff",
    steps: [{ type: "counter", duration: 10, label: "Chop & Blend" }, { type: "stovetop", duration: 15, label: "Simmer" }] },
  { id: "caesarsalad", name: "Caesar Salad", emoji: "🥗", meal: "lunch", color: "#588157",
    steps: [{ type: "counter", duration: 15, label: "Chop & Toss" }] },
  { id: "gardensalad", name: "Garden Salad", emoji: "🥬", meal: "lunch", color: "#3a9d5d",
    steps: [{ type: "counter", duration: 10, label: "Chop & Toss" }] },
  { id: "grilledcheeseclub", name: "Club Sandwich", emoji: "🥪", meal: "lunch", color: "#bc6c25",
    steps: [{ type: "counter", duration: 10, label: "Assemble" }, { type: "stovetop", duration: 5, label: "Toast" }] },
  { id: "quesadilla", name: "Quesadilla", emoji: "🫓", meal: "lunch", color: "#e9b44c",
    steps: [{ type: "counter", duration: 10, label: "Fill" }, { type: "stovetop", duration: 10, label: "Grill" }] },
  { id: "grilledchicken", name: "Grilled Chicken Breast", emoji: "🍗", meal: "lunch", color: "#c1666b",
    steps: [{ type: "counter", duration: 10, label: "Marinate" }, { type: "stovetop", duration: 15, label: "Grill" }] },
  { id: "friedrice", name: "Fried Rice", emoji: "🍚", meal: "lunch", color: "#e9c46a",
    steps: [{ type: "counter", duration: 10, label: "Prep" }, { type: "stovetop", duration: 15, label: "Stir-fry" }] },

  { id: "spaghetti", name: "Spaghetti", emoji: "🍝", meal: "dinner", color: "#e8622c",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "stovetop", duration: 10, label: "Boil Pasta" }] },
  { id: "meatsauce", name: "Meat Sauce", emoji: "🍲", meal: "dinner", color: "#c1121f",
    steps: [{ type: "counter", duration: 10, label: "Prep" }, { type: "stovetop", duration: 25, label: "Simmer" }] },
  { id: "garlicbread", name: "Garlic Bread", emoji: "🥖", meal: "dinner", color: "#e9b44c",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "oven", duration: 10, label: "Bake" }] },
  { id: "bakedziti", name: "Baked Ziti", emoji: "🫕", meal: "dinner", color: "#9c6644",
    steps: [{ type: "counter", duration: 15, label: "Assemble" }, { type: "oven", duration: 30, label: "Bake" }] },
  { id: "roastchicken", name: "Roast Chicken", emoji: "🍗", meal: "dinner", color: "#c1121f",
    steps: [{ type: "counter", duration: 15, label: "Prep" }, { type: "oven", duration: 75, label: "Roast" }, { type: "counter", duration: 15, label: "Rest" }] },
  { id: "beefstew", name: "Beef Stew", emoji: "🍖", meal: "dinner", color: "#7f4f24",
    steps: [{ type: "counter", duration: 15, label: "Prep" }, { type: "stovetop", duration: 45, label: "Simmer" }] },
  { id: "meatloaf", name: "Meatloaf", emoji: "🥩", meal: "dinner", color: "#9d0208",
    steps: [{ type: "counter", duration: 15, label: "Prep" }, { type: "oven", duration: 45, label: "Bake" }, { type: "counter", duration: 10, label: "Rest" }] },
  { id: "mashedpotatoes", name: "Mashed Potatoes", emoji: "🥔", meal: "dinner", color: "#e9b44c",
    steps: [{ type: "counter", duration: 10, label: "Prep" }, { type: "stovetop", duration: 20, label: "Boil" }, { type: "counter", duration: 5, label: "Mash" }] },
  { id: "roastedpotatoes", name: "Roasted Potatoes", emoji: "🥔", meal: "dinner", color: "#dda15e",
    steps: [{ type: "counter", duration: 10, label: "Prep" }, { type: "oven", duration: 35, label: "Roast" }] },
  { id: "ricepilaf", name: "Rice Pilaf", emoji: "🍚", meal: "dinner", color: "#e9c46a",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "stovetop", duration: 20, label: "Simmer" }] },
  { id: "greenbeans", name: "Green Beans", emoji: "🫛", meal: "dinner", color: "#3a9d5d",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "stovetop", duration: 10, label: "Sauté" }] },
  { id: "broccoli", name: "Steamed Broccoli", emoji: "🥦", meal: "dinner", color: "#2a9d8f",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "stovetop", duration: 10, label: "Steam" }] },
  { id: "carrots", name: "Roasted Carrots", emoji: "🥕", meal: "dinner", color: "#f3722c",
    steps: [{ type: "counter", duration: 10, label: "Prep" }, { type: "oven", duration: 25, label: "Roast" }] },
  { id: "corn", name: "Corn on the Cob", emoji: "🌽", meal: "dinner", color: "#f4d35e",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "stovetop", duration: 10, label: "Boil" }] },
  { id: "dinnerrolls", name: "Dinner Rolls", emoji: "🥐", meal: "dinner", color: "#e9b44c",
    steps: [{ type: "counter", duration: 15, label: "Shape & Proof" }, { type: "oven", duration: 20, label: "Bake" }] },
  { id: "gravy", name: "Gravy", emoji: "🥣", meal: "dinner", color: "#8a5a3d",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "stovetop", duration: 10, label: "Simmer" }] },
  { id: "cranberrysauce", name: "Cranberry Sauce", emoji: "🍒", meal: "dinner", color: "#9d0208",
    steps: [{ type: "counter", duration: 5, label: "Prep" }, { type: "stovetop", duration: 15, label: "Simmer" }] },
  { id: "grilledsalmon", name: "Grilled Salmon", emoji: "🐟", meal: "dinner", color: "#457b9d",
    steps: [{ type: "counter", duration: 10, label: "Season" }, { type: "stovetop", duration: 15, label: "Grill" }] },
  { id: "shrimpscampi", name: "Shrimp Scampi", emoji: "🍤", meal: "dinner", color: "#e76f51",
    steps: [{ type: "counter", duration: 10, label: "Prep" }, { type: "stovetop", duration: 10, label: "Sauté" }] },
  { id: "lasagna", name: "Lasagna", emoji: "🧆", meal: "dinner", color: "#9c6644",
    steps: [{ type: "counter", duration: 25, label: "Assemble" }, { type: "oven", duration: 45, label: "Bake" }, { type: "counter", duration: 10, label: "Rest" }] },
  { id: "stuffing", name: "Stuffing", emoji: "🍞", meal: "dinner", color: "#bc6c25",
    steps: [{ type: "counter", duration: 15, label: "Prep" }, { type: "oven", duration: 30, label: "Bake" }] },
  { id: "turkey", name: "Roast Turkey", emoji: "🦃", meal: "dinner", color: "#9d0208",
    steps: [{ type: "counter", duration: 20, label: "Prep" }, { type: "oven", duration: 180, label: "Roast" }, { type: "counter", duration: 20, label: "Rest" }] },
  { id: "devilledeggs", name: "Deviled Eggs", emoji: "🥚", meal: "dinner", color: "#f4d35e",
    steps: [{ type: "stovetop", duration: 10, label: "Boil" }, { type: "counter", duration: 15, label: "Fill" }] },

  { id: "cookies", name: "Chocolate Chip Cookies", emoji: "🍪", meal: "dessert", color: "#6f4518",
    steps: [{ type: "counter", duration: 15, label: "Mix Dough" }, { type: "oven", duration: 15, label: "Bake" }] },
  { id: "brownies", name: "Brownies", emoji: "🍫", meal: "dessert", color: "#4a2c2a",
    steps: [{ type: "counter", duration: 15, label: "Mix Batter" }, { type: "oven", duration: 30, label: "Bake" }] },
  { id: "applepie", name: "Apple Pie", emoji: "🥧", meal: "dessert", color: "#c17a3d",
    steps: [{ type: "counter", duration: 20, label: "Prep" }, { type: "oven", duration: 45, label: "Bake" }, { type: "counter", duration: 15, label: "Cool" }] },
  { id: "pumpkinpie", name: "Pumpkin Pie", emoji: "🎃", meal: "dessert", color: "#dd6e42",
    steps: [{ type: "counter", duration: 20, label: "Prep" }, { type: "oven", duration: 50, label: "Bake" }] },
  { id: "quiche", name: "Quiche", emoji: "🥧", meal: "dessert", color: "#e9b44c",
    steps: [{ type: "counter", duration: 20, label: "Prep" }, { type: "oven", duration: 35, label: "Bake" }] },
];

// ---------------------------------------------------------------------
// Seeded RNG (mulberry32) — deterministic per level for reproducibility.
// ---------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

// ---------------------------------------------------------------------
// Difficulty curve: level 1..100 -> {dishCount, resources, wantDependency}
// ---------------------------------------------------------------------
function difficultyFor(n) {
  const t = (n - 1) / 99; // 0..1
  const dishCount = Math.min(6, 2 + Math.floor(t * 5)); // 2..6 (wait, caps at 6 -> adjust below)
  const oven = n < 15 ? 0 : n < 70 ? 1 : 2;
  const stovetop = n < 8 ? 1 : n < 45 ? 2 : 3;
  const counter = n < 6 ? 2 : n < 40 ? 3 : n < 75 ? 4 : 5;
  const wantDependency = n >= 25 ? (n >= 70 ? 2 : 1) : 0;
  const slackFactor = Math.max(0.35, 1.3 - t); // more slack (easier) early, tighter later
  return { dishCount, resources: { oven, stovetop, counter }, wantDependency, slackFactor };
}

function totalDuration(dish) {
  return dish.steps.reduce((s, st) => s + st.duration, 0);
}

// ---------------------------------------------------------------------
// Pick dishes for a level, respecting: count(final-step type == T) <= resources[T]
// ---------------------------------------------------------------------
function pickDishes(rng, dishCount, resources) {
  const order = shuffle(POOL, rng);
  const chosen = [];
  const finalTypeCount = { oven: 0, stovetop: 0, counter: 0 };
  for (const dish of order) {
    if (chosen.length >= dishCount) break;
    const finalType = dish.steps[dish.steps.length - 1].type;
    if (finalTypeCount[finalType] + 1 > resources[finalType]) continue;
    chosen.push(dish);
    finalTypeCount[finalType]++;
  }
  return chosen;
}

// ---------------------------------------------------------------------
// Construct one valid schedule for a candidate level. Returns the
// {level, placements} pair on success, or null if this attempt failed
// (caller retries with more slack/board time).
// ---------------------------------------------------------------------
function tryConstruct(dishes, resources, boardMinutes, dependencies, gridStep, debug) {
  const laneOccupied = {}; // laneId -> [{start,end}]
  const lanes = [];
  ["oven", "stovetop", "counter"].forEach((type) => {
    for (let i = 1; i <= resources[type]; i++) {
      const id = type + i;
      lanes.push({ id, type });
      laneOccupied[id] = [];
    }
  });

  function fits(laneId, start, end) {
    return laneOccupied[laneId].every((iv) => !(start < iv.end && iv.start < end));
  }
  function reserve(laneId, start, end) {
    laneOccupied[laneId].push({ start, end });
  }
  function findLane(type, start, end) {
    const candidates = lanes.filter((l) => l.type === type);
    for (const l of candidates) {
      if (fits(l.id, start, end)) return l.id;
    }
    return null;
  }

  // topological order: dependency sources before dependents
  const dishIds = dishes.map((d) => d.id);
  const order = dishIds.slice();
  dependencies.forEach((dep) => {
    const si = order.indexOf(dep.afterDish);
    const di = order.indexOf(dep.dish);
    if (si > di) {
      order.splice(si, 1);
      order.splice(order.indexOf(dep.dish), 0, dep.afterDish);
    }
  });

  const placements = new Map();
  const stepEnd = {}; // "dishId.step" -> absolute end time, for dependency lookups

  for (const dishId of order) {
    const dish = dishes.find((d) => d.id === dishId);
    const n = dish.steps.length;
    const starts = new Array(n);

    for (let i = n - 1; i >= 0; i--) {
      const dur = dish.steps[i].duration;
      const upperBound = i === n - 1 ? boardMinutes : starts[i + 1]; // step must END by here

      let lowerBound = 0; // step must START no earlier than here
      const dep = dependencies.find((d) => d.dish === dishId && d.step === i);
      if (dep) {
        const reqMin = stepEnd[dep.afterDish + "." + dep.afterStep];
        if (reqMin === undefined) return null; // source not placed yet -> bad topo order
        lowerBound = Math.ceil(reqMin / gridStep) * gridStep;
      }

      if (lowerBound > upperBound - dur) {
        if (debug) console.error(`    ${dishId}.${i} infeasible window start∈[${lowerBound},${upperBound - dur}]`);
        return null; // genuinely no room for this step given its neighbors -> caller retries
      }

      // Search backward from the latest possible start (touching the next
      // step) down to lowerBound, so a busy resource (e.g. the oven already
      // hosting a long roast) just pushes this step earlier, opening a gap.
      let placedStart = null;
      let placedLane = null;
      for (let s = upperBound - dur; s >= lowerBound; s -= gridStep) {
        const laneId = findLane(dish.steps[i].type, s, s + dur);
        if (laneId) { placedStart = s; placedLane = laneId; break; }
      }
      if (placedStart === null) {
        if (debug) console.error(`    ${dishId}.${i} no free ${dish.steps[i].type} lane in [${lowerBound},${upperBound - dur}]`);
        return null;
      }

      reserve(placedLane, placedStart, placedStart + dur);
      starts[i] = placedStart;
      placements.set(engine.stepKey(dishId, i), { laneId: placedLane, start: placedStart });
      stepEnd[dishId + "." + i] = placedStart + dur;
    }
  }

  return placements;
}

function buildDependencies(rng, dishes, wantCount) {
  // Both ends need >=2 steps: the source needs an interior (non-final) step
  // to depend on, and the target's dependent step (step 0) must not be its
  // own final step, since a final step's end is pinned to serve time.
  // Each dish participates in at most one dependency (as source or target),
  // so pairs can never form a cycle (A<->B) or a chain (A->B->C).
  //
  // Under the default (no-gap, touching-steps) construction, a dish's step0
  // naturally ends at (boardMinutes - <sum of its later steps' durations>).
  // For "target.step0 >= source.afterStep.end" to hold without shrinking
  // the target's own chain, the source's remaining duration after the
  // dependency point must be at least the target's remaining duration
  // after its first step -- otherwise "end before my own next step" and
  // "start after the source finishes" contradict each other no matter how
  // large the board is. Filtering for this up front avoids generating
  // dependency pairs that can never be satisfied.
  const eligible = dishes.filter((d) => d.steps.length >= 2);
  const deps = [];
  const used = new Set();
  const sources = shuffle(eligible, rng);
  for (const src of sources) {
    if (deps.length >= wantCount) break;
    if (used.has(src.id)) continue;
    const stepOptions = shuffle([...Array(src.steps.length - 1).keys()], rng);
    for (const afterStep of stepOptions) {
      const sourceTail = src.steps.slice(afterStep + 1).reduce((s, st) => s + st.duration, 0);
      const targets = shuffle(eligible.filter((d) => d.id !== src.id && !used.has(d.id)), rng);
      const target = targets.find((t) => {
        const targetRest = t.steps.slice(1).reduce((s, st) => s + st.duration, 0);
        return targetRest <= sourceTail;
      });
      if (target) {
        deps.push({ dish: target.id, step: 0, afterDish: src.id, afterStep });
        used.add(src.id);
        used.add(target.id);
        break;
      }
    }
  }
  return deps;
}

const MEAL_NAMES = {
  breakfast: ["Sunday Brunch", "Morning Rush", "Breakfast Special"],
  lunch: ["Lunch Counter", "Midday Break", "Quick Bite"],
  dinner: ["Family Dinner", "Weeknight Table", "Home Cooking"],
  dessert: ["Sweet Finish", "Bake Sale", "Dessert Table"],
  mixed: ["Full Spread", "Big Night In", "The Whole Menu"],
};
function nameForLevel(n, dishes, rng) {
  const meals = new Set(dishes.map((d) => d.meal));
  const key = meals.size > 1 ? "mixed" : dishes[0].meal;
  const pool = MEAL_NAMES[key] || MEAL_NAMES.mixed;
  return `Stage ${n}: ${pick(pool, rng)}`;
}

function generateLevel(n) {
  const diff = difficultyFor(n);
  let dependencies = [];
  const debug = process.env.DEBUG_LEVEL === String(n);

  for (let attempt = 0; attempt < 12; attempt++) {
    const rng = mulberry32(n * 1000003 + attempt * 97);
    const dishCount = Math.max(2, diff.dishCount - Math.floor(attempt / 4));
    const resources = { ...diff.resources };
    const dishes = pickDishes(rng, dishCount, resources);
    if (dishes.length < 2) {
      if (debug) console.error(`attempt ${attempt}: only picked ${dishes.length} dishes`);
      continue;
    }

    dependencies = diff.wantDependency > 0 ? buildDependencies(rng, dishes, diff.wantDependency) : [];
    if (debug) console.error(`attempt ${attempt}: dishes=${dishes.map(d=>d.id).join(",")} deps=${JSON.stringify(dependencies)} resources=${JSON.stringify(resources)}`);

    const maxChain = Math.max(...dishes.map(totalDuration));
    const sumChain = dishes.reduce((s, d) => s + totalDuration(d), 0);
    let boardMinutes = Math.ceil(((maxChain + sumChain * diff.slackFactor * 0.3) / 5)) * 5;
    boardMinutes = Math.max(boardMinutes, 30);

    for (let boardTry = 0; boardTry < 6; boardTry++) {
      const placements = tryConstruct(dishes, resources, boardMinutes, dependencies, 5, debug);
      if (debug) console.error(`  boardTry ${boardTry} board=${boardMinutes} -> ${placements ? "OK" : "FAIL"}`);
      if (placements) {
        const level = {
          id: `stage-${n}`,
          name: nameForLevel(n, dishes, rng),
          boardMinutes,
          gridStep: 5,
          resources,
          dishes: dishes.map((d) => ({ id: d.id, name: d.name, emoji: d.emoji, color: d.color, steps: d.steps })),
          dependencies,
        };
        // Re-verify with the exact engine the browser uses.
        if (engine.isSolved(level, placements)) {
          return level;
        } else if (debug) {
          console.error("  constructed but engine.isSolved()=false!");
        }
      }
      boardMinutes += 30;
    }
  }
  throw new Error("Failed to generate level " + n);
}

// ---------------------------------------------------------------------
if (require.main === module) {
  const levels = [];
  for (let n = 1; n <= 100; n++) levels.push(generateLevel(n));

  process.stdout.write(
    "// AUTO-GENERATED by tools/generate-dinner-rush-levels.js — do not hand-edit.\n" +
    "// Regenerate with: node tools/generate-dinner-rush-levels.js > games/dinner-rush/levels-data.js\n" +
    "(function (root) {\n  root.DINNER_RUSH_LEVELS = " + JSON.stringify(levels, null, 2) + ";\n})(typeof self !== \"undefined\" ? self : this);\n"
  );
  process.stderr.write(`Generated ${levels.length} levels.\n`);
}

module.exports = { tryConstruct, POOL };
