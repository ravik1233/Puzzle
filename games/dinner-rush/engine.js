(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.DinnerRushEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // A level is one real recipe:
  //   { id, recipeName, ingredients: [string], decoys: [string], steps: [string] }
  // ingredients/steps are in their correct (original) order/set; decoys are
  // wrong ingredients mixed into the pantry grid.

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

  // order: array of step strings in the player's current arrangement
  // (must be a permutation of level.steps for a meaningful check).
  function methodState(level, order) {
    let correctPositions = 0;
    for (let i = 0; i < level.steps.length; i++) {
      if (order[i] === level.steps[i]) correctPositions++;
    }
    return {
      correctPositions,
      total: level.steps.length,
      solved: order.length === level.steps.length && correctPositions === level.steps.length,
    };
  }

  return { pantryCards, pantryState, methodState };
});
