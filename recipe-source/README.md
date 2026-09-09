# Recipe source

`boston-cooking-school-cookbook.html` is the full text of **The Boston
Cooking-School Cook Book** by Fannie Merritt Farmer, first published 1896.
Fannie Farmer died in 1915, so the work is in the public domain.

Downloaded from Project Gutenberg:
https://www.gutenberg.org/ebooks/65061

`tools/curate-recipes.js` parses this file into structured recipes
(name, ingredients, instructions) and curates a modern-friendly subset.
`tools/generate-dinner-rush-levels.js` turns that curated set into the
100-level campaign in `levels-data.js`. Every ingredient
and every instruction step a player sees in the game is Fannie Farmer's
real text — nothing in the puzzle content is invented.

To regenerate after editing the curation rules:

```
node tools/curate-recipes.js > tools/curated-recipes.json
node tools/generate-dinner-rush-levels.js > levels-data.js
```
