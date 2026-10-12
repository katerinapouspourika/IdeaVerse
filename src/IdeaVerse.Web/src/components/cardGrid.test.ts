import { cardGridClass } from './cardGrid';

describe('cardGridClass', () => {
  it.each([
    [3, 'card-grid threes'],
    [6, 'card-grid threes in-pairs'],
    [2, 'card-grid pairs'],
    [4, 'card-grid pairs'],
    [5, 'card-grid'],
  ])('lays out %i cards so no row is left part-empty', (count, expected) => {
    expect(cardGridClass(count)).toBe(expected);
  });
});
