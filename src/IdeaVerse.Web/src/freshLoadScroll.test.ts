import { scrollKey, startFreshLoadsAtTop } from './freshLoadScroll';

const key = 'react-router-scroll-positions';
const load = (type: NavigationTimingType) => ({ type }) as PerformanceNavigationTiming;

describe('Scroll positions', () => {
  beforeEach(() => sessionStorage.setItem(key, JSON.stringify({ 'first:/': 600, 'first:/pricing': 1100, abc123: 400 })));
  afterEach(() => sessionStorage.clear());

  it('keeps the first page of each load under its own path, and other pages under their history key', () => {
    expect(scrollKey({ key: 'default', pathname: '/pricing' })).toBe('first:/pricing');
    expect(scrollKey({ key: 'abc123', pathname: '/pricing' })).toBe('abc123');
  });

  it('forgets where a page opened afresh was left, keeping the others', () => {
    startFreshLoadsAtTop('/', load('navigate'));

    expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ 'first:/pricing': 1100, abc123: 400 });
  });

  it.each(['reload', 'back_forward'] as const)('keeps it on %s, so the page returns to where it was', (type) => {
    startFreshLoadsAtTop('/', load(type));

    expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual({ 'first:/': 600, 'first:/pricing': 1100, abc123: 400 });
  });
});
