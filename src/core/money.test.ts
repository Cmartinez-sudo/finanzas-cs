import { describe, expect, it } from 'vitest';
import {
  centsToInput,
  fmtBs,
  fmtTasa,
  fmtUSD,
  parseDecimal,
  parseMonto,
  roundHalfAway,
  splitProportional,
  sumCents,
  toCents,
} from './money';

describe('parseDecimal', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1234,5', 1234.5],
    ['$ 20', 20],
    ['20', 20],
    ['1.500', 1500], // one separator + 3 digits = thousands, as before
    ['1,500', 1500],
    ['12,50', 12.5],
    ['919,82', 919.82],
    ['1.234.567', 1234567],
    ['0.125', 0.125], // was 125 in the old parser
    [',75', 0.75],
    ['Bs 36.793,00', 36793],
    ['-15', -15],
  ])('%s → %d', (s, n) => expect(parseDecimal(s)).toBeCloseTo(n, 10));

  it.each(['', '   ', 'abc', null, undefined, '.'])('rejects %s', (s) => expect(parseDecimal(s)).toBeNull());
});

describe('parseMonto', () => {
  it('returns integer cents', () => {
    expect(parseMonto('12,34')).toBe(1234);
    expect(parseMonto('0.1')).toBe(10);
    expect(parseMonto('1.005,5')).toBe(100550);
  });
  it('avoids float drift (0.1 + 0.2)', () => {
    expect((parseMonto('0,1') as number) + (parseMonto('0,2') as number)).toBe(30);
  });
});

describe('rounding', () => {
  it('rounds half away from zero', () => {
    expect(roundHalfAway(0.5)).toBe(1);
    expect(roundHalfAway(-0.5)).toBe(-1);
    expect(roundHalfAway(2.4999)).toBe(2);
  });
  it('toCents handles classic float cases', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(33.765)).toBe(3377);
    expect(toCents(-2.675)).toBe(-268);
  });
  it('sums cents ignoring empties', () => expect(sumCents([100, null, 250, undefined])).toBe(350));
});

describe('splitProportional', () => {
  it('always adds up to the total', () => {
    const parts = splitProportional(200_000, [3300, 3000]);
    expect(parts.reduce((a, b) => a + b)).toBe(200_000);
  });
  it('rounds to whole dollars when asked, like the old casaShare', () => {
    // total 2000 (casa 1942 + imprevisto 58), incomes 3300 / 3000 → Carlos round(1047.62) = 1048
    expect(splitProportional(200_000, [3300, 3000], 100)).toEqual([104_800, 95_200]);
  });
  it('splits evenly when there are no weights', () =>
    expect(splitProportional(1001, [0, 0])).toEqual([501, 500]));
});

describe('formatting', () => {
  it('formats dollars', () => {
    expect(fmtUSD(123_456)).toBe('$1,234.56');
    expect(fmtUSD(123_400)).toBe('$1,234');
    expect(fmtUSD(123_450, 'whole')).toBe('$1,235');
    expect(fmtUSD(5, 'exact')).toBe('$0.05');
    expect(fmtUSD(-12_000)).toBe('−$120');
    expect(fmtUSD(123_456, 'compact')).toBe('$1.2K');
    expect(fmtUSD(41_200, 'compact')).toBe('$412');
  });
  it('formats bolívares and rates the Venezuelan way', () => {
    expect(fmtBs(3_679_280)).toBe('Bs 36.792,80');
    expect(fmtTasa(919.82)).toBe('919,82');
    expect(fmtTasa(null)).toBe('—');
  });
  it('prints inputs without thousands separators', () => {
    expect(centsToInput(123_456)).toBe('1234,56');
    expect(centsToInput(330_000)).toBe('3300');
    expect(centsToInput(0)).toBe('');
  });
});
