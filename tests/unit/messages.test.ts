import { describe, expect, it } from 'vitest';
import { isRuntimeMessage } from '../../src/shared/messages.ts';

describe('isRuntimeMessage()', () => {
  it.each([
    { type: 'handled-count', count: 0 },
    { type: 'handled-count', count: 3 },
    { type: 'show-once', reveal: true },
    { type: 'show-once', reveal: false },
    { type: 'page-state' },
    { type: 'page-state', extra: 'ignored' },
  ])('accepts %j', (message) => {
    expect(isRuntimeMessage(message)).toBe(true);
  });

  it.each([
    undefined,
    null,
    42,
    'show-once',
    true,
    () => ({ type: 'page-state' }),
    {},
    { type: 'nope' },
    { type: 42 },
    { type: null },
    { type: 'handled-count' },
    { type: 'handled-count', count: '3' },
    { type: 'handled-count', count: NaN },
    { type: 'handled-count', count: Infinity },
    { type: 'handled-count', count: -Infinity },
    { type: 'handled-count', count: null },
    { type: 'show-once' },
    { type: 'show-once', reveal: 'yes' },
    { type: 'show-once', reveal: 1 },
    { type: 'PAGE-STATE' },
    { count: 3 },
  ])('rejects %j', (message) => {
    expect(isRuntimeMessage(message)).toBe(false);
  });

  it('accepts an array only if it carries a valid type property (arrays have none)', () => {
    expect(isRuntimeMessage([])).toBe(false);
    expect(isRuntimeMessage(['page-state'])).toBe(false);
  });
});
