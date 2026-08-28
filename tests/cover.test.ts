import { describe, it, expect } from 'vitest';
import { coverGradient } from '../web/lib/cover';

describe('coverGradient', () => {
  it('is deterministic for the same id', () => {
    expect(coverGradient('abc123')).toBe(coverGradient('abc123'));
  });

  it('differs between ids', () => {
    expect(coverGradient('abc123')).not.toBe(coverGradient('xyz789'));
  });

  it('returns a css linear-gradient value', () => {
    expect(coverGradient('abc123')).toMatch(/^linear-gradient\(/);
  });

  it('handles an empty id without throwing', () => {
    expect(typeof coverGradient('')).toBe('string');
  });
});
