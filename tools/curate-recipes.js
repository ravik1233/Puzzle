#!/usr/bin/env node
"use strict";
/*
 * Parses recipe-source/boston-cooking-school-cookbook.html (Fannie Farmer's
 * "The Boston Cooking-School Cook Book", 1896 -- public domain, via Project
 * Gutenberg #65061) into structured recipes, then curates a subset suitable
 * for the game: recognizable dishes, sane ingredient/step counts, nothing
 * that would read as off-putting to a modern audience.
 *
 * Usage: node tools/curate-recipes.js > tools/curated-recipes.json
 */

const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(
  path.join(__dirname, "..", "recipe-source", "boston-cooking-school-cookbook.html"),
  "utf8"
);

function stripTags(s) {
  return s
    .replace(/<span class='pageno'[^>]*>\d+<\/span>/g, "") // inline page-break markers fused into text, e.g. "cook 141twenty minutes"
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&frac12;/g, "½")
    .replace(/&frac14;/g, "¼")
    .replace(/&frac34;/g, "¾")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------
const blocks = html.split(/<h3 class='c018'>/).slice(1);
const parsed = [];

for (const block of blocks) {
  const nameEnd = block.indexOf("</h3>");
  if (nameEnd === -1) continue;
  const name = stripTags(block.slice(0, nameEnd));
  const rest = block.slice(nameEnd);

  const ingredientsMatch = rest.match(/<div class='lg-container-b[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  let ingredients = [];
  if (ingredientsMatch) {
    ingredients = [...ingredientsMatch[1].matchAll(/<div class='line'>([\s\S]*?)<\/div>/g)].map((m) => stripTags(m[1]));
  }

  const afterIngredients = ingredientsMatch ? rest.slice(rest.indexOf(ingredientsMatch[0]) + ingredientsMatch[0].length) : rest;
  const pMatch = afterIngredients.match(/<p class='c009'>([\s\S]*?)<\/p>/);
  const instructions = pMatch ? stripTags(pMatch[1]) : null;

  if (name && ingredients.length && instructions) {
    parsed.push({ name, ingredients, instructions });
  }
}

// ---------------------------------------------------------------------
// Split instructions into steps at natural clause boundaries (the
// original prose is written as semicolon/period-separated actions).
// ---------------------------------------------------------------------
function splitSteps(instructions) {
  const raw = instructions.split(/(?<=[.;])\s+(?=[A-Z])/);
  const steps = raw
    .map((s) => s.replace(/[.;]\s*$/, "").trim())
    .filter((s) => s.length >= 12 && s.split(" ").length >= 3);
  return steps;
}

// ---------------------------------------------------------------------
// Extract the core ingredient noun (strip leading quantity/unit words)
// for pantry matching + cross-recipe decoy pooling.
// ---------------------------------------------------------------------
const UNIT_WORDS = new Set([
  "cup", "cups", "teaspoon", "teaspoons", "tablespoon", "tablespoons",
  "pint", "pints", "quart", "quarts", "gallon", "gallons", "pound", "pounds",
  "lb", "lb.", "lbs", "lbs.", "ounce", "ounces", "oz", "oz.", "ozs", "ozs.", "can", "cans",
  "slice", "slices", "dozen", "bit", "bits", "sprig", "sprigs", "stalk",
  "stalks", "clove", "cloves", "leaf", "leaves", "of", "or", "to", "a", "an",
]);
function coreIngredient(line) {
  let s = line.replace(/[⅛¼⅓½⅔¾]/g, "").trim();

  // "Yolks 10 eggs" / "Whites 6 eggs" -> "Egg yolks" / "Egg whites"
  const yolkWhite = s.match(/^(Yolks?|Whites?)\s+\d/i);
  if (yolkWhite) return /yolk/i.test(yolkWhite[1]) ? "Egg yolks" : "Egg whites";

  // Repeatedly strip leading quantity numbers and unit words until stable.
  let prev;
  do {
    prev = s;
    s = s.replace(/^\d+[\d\s/.-]*/, "").trim();
    const words = s.split(" ");
    if (words.length > 1 && UNIT_WORDS.has(words[0].toLowerCase().replace(/\.$/, "") + (words[0].endsWith(".") ? "." : ""))) {
      words.shift();
      s = words.join(" ").trim();
    } else if (words.length > 1 && UNIT_WORDS.has(words[0].toLowerCase())) {
      words.shift();
      s = words.join(" ").trim();
    }
  } while (s !== prev && s.length > 0);

  s = s.replace(/^(of|a|an)\s+/i, "").trim();
  s = s.replace(/\s*\([^)]*\)\s*$/, "").trim(); // drop trailing parenthetical, e.g. "Flour (scant)"
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const REFERENCES_ANOTHER_RECIPE = /\b(same as|see |recipe for|directions for|as for|like )\b/i;

// ---------------------------------------------------------------------
// Curate: filter to a modern-friendly, well-shaped subset.
// ---------------------------------------------------------------------
const BLOCKLIST = [
  "brain", "tripe", "calf's foot", "calves' feet", "isinglass", "blood",
  "turtle", "tongue", "sweetbread", "kidney", "liver", "lard", "suet",
  "gelatin mould", "eel", "frog", "pig's", "hog's head", "singed", "entrail",
  "trichina", "rennet", "tallow",
];
function isModernFriendly(name, ingredients) {
  const text = (name + " " + ingredients.join(" ")).toLowerCase();
  return !BLOCKLIST.some((bad) => text.includes(bad));
}

const seen = new Set();
const curated = [];

for (const r of parsed) {
  if (seen.has(r.name)) continue;
  if (r.name === r.name.toUpperCase() && /[A-Z]/.test(r.name)) continue; // section header, not a dish (e.g. "MILK")
  if (r.ingredients.length < 3 || r.ingredients.length > 9) continue;
  if (r.ingredients.some((i) => i.includes("%"))) continue; // nutritional composition table, not a real ingredient list
  if (!/^[\d⅛¼⅓½⅔¾]/.test(r.ingredients[0]) && !/^(a|an|few|bit|salt|pepper|dash)\b/i.test(r.ingredients[0])) continue;
  if (!isModernFriendly(r.name, r.ingredients)) continue;
  const steps = splitSteps(r.instructions);
  if (steps.length < 2 || steps.length > 6) continue;
  if (r.name.length > 30) continue;
  if (/\b(I{2,}|III|IV|V)$/.test(r.name)) continue; // skip "Recipe III" style variants, keep "Recipe I" as the canonical one... actually skip these too for cleanliness
  if (/ I$/.test(r.name)) continue; // numbered variant naming looks odd in a level list; keep base name only
  if (steps.some((s) => REFERENCES_ANOTHER_RECIPE.test(s))) continue; // depends on another recipe -- not playable standalone

  const core = r.ingredients.map(coreIngredient).filter((c) => c.length >= 3 && c.length <= 24 && !/\d/.test(c) && /^[A-Z]/.test(c));
  if (core.length !== r.ingredients.length) continue; // skip if any ingredient failed to reduce cleanly
  if (new Set(core.map((c) => c.toLowerCase())).size !== core.length) continue; // skip duplicate core ingredients

  seen.add(r.name);
  curated.push({
    name: r.name,
    ingredients: core,
    steps,
  });
}

process.stderr.write(`Parsed ${parsed.length} recipes, curated ${curated.length}.\n`);
process.stdout.write(JSON.stringify(curated, null, 2));
