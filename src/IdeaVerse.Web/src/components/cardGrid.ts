/**
 * The class for a grid of `count` cards, picking columns that fill every row so no card is left alone on the last one:
 * threes for multiples of three, pairs for other even counts, and as many as fit otherwise.
 */
export function cardGridClass(count: number): string {
  if (count % 3 === 0) {
    return count === 3 ? 'card-grid threes' : 'card-grid threes in-pairs';
  }
  return count % 2 === 0 ? 'card-grid pairs' : 'card-grid';
}
