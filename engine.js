(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.DinnerRushEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // A level is one real recipe:
  //   { id, recipeName, ingredients: [string], decoys: [string],
  //     steps: [{ text, station: 'counter'|'stovetop'|'oven' }] }

  function pantryCards(level) {
    return [...level.ingredients, ...level.decoys];
  }

  // selected: Set of ingredient strings currently chosen in the pantry grid.
  function pantryState(level, selected) {
    const correctSet = new Set(level.ingredients);
    let foundCorrect = 0;
    let wrongSelected = 0;
    selected.forEach((ing) => {
      if (correctSet.has(ing)) foundCorrect++;
      else wrongSelected++;
    });
    return {
      foundCorrect,
      wrongSelected,
      total: level.ingredients.length,
      solved: foundCorrect === level.ingredients.length && wrongSelected === 0,
    };
  }

  // placements: Map stepIndex(number) -> station string, the player's
  // current tentative placement for every step they've dropped into a zone.
  function stationsState(level, placements) {
    let correctCount = 0;
    let wrongCount = 0;
    placements.forEach((station, idx) => {
      if (level.steps[idx] && level.steps[idx].station === station) correctCount++;
      else wrongCount++;
    });
    return {
      correctCount,
      wrongCount,
      total: level.steps.length,
      solved: correctCount === level.steps.length && wrongCount === 0,
    };
  }

  return { pantryCards, pantryState, stationsState };
});
