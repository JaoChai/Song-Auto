import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadDraft, saveDraft, EMPTY_DRAFT, type Draft } from '../web/lib/draft';

const KEY = 'song-auto:draft';

/** in-memory stand-in — vitest runs in node, where localStorage does not exist */
function fakeStorage(over: Partial<Storage> = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
    ...over,
  } as Storage;
}

const useStorage = (s: Storage | undefined) => {
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
};

const filled: Draft = {
  lyrics: '[Verse 1]\nฝนตกที่หน้าต่าง',
  style: 'dream pop, ethereal',
  title: 'สายฝน',
  instrumental: true,
  negativeTags: 'heavy metal',
  personaId: 'persona_123',
  personaModel: 'voice_persona',
  vocalGender: 'f',
  styleWeight: '0.65',
  weirdnessConstraint: '0.2',
  audioWeight: '0.8',
};

describe('draft', () => {
  beforeEach(() => useStorage(fakeStorage()));
  afterEach(() => useStorage(undefined));

  it('reads back everything it saved', () => {
    saveDraft(filled);
    expect(loadDraft()).toEqual(filled);
  });

  it('returns an empty draft when nothing was saved', () => {
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('returns an empty draft when the stored value is not valid JSON', () => {
    globalThis.localStorage.setItem(KEY, '{not json');
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('returns an empty draft when the stored value is not an object', () => {
    globalThis.localStorage.setItem(KEY, '"just a string"');
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('drops fields of the wrong type but keeps the valid ones', () => {
    globalThis.localStorage.setItem(
      KEY,
      JSON.stringify({ lyrics: 42, style: 'lo-fi', instrumental: 'yes' }),
    );
    expect(loadDraft()).toEqual({ ...EMPTY_DRAFT, style: 'lo-fi' });
  });

  it('does not throw when storage refuses to write', () => {
    useStorage(fakeStorage({ setItem: () => { throw new Error('QuotaExceededError'); } }));
    expect(() => saveDraft(filled)).not.toThrow();
  });

  it('works when there is no storage at all', () => {
    useStorage(undefined);
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
    expect(() => saveDraft(filled)).not.toThrow();
  });

  it('reads a draft saved before personas existed as "no persona"', () => {
    globalThis.localStorage.setItem(
      KEY,
      JSON.stringify({ lyrics: 'a', style: 'b', title: 'c', instrumental: false, negativeTags: '' }),
    );
    const d = loadDraft();
    expect(d.personaId).toBe('');
    expect(d.personaModel).toBe('');
    expect(d.style).toBe('b');
  });

  it('drops an unknown personaModel', () => {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ personaId: 'p', personaModel: 'nonsense' }));
    expect(loadDraft().personaModel).toBe('');
  });

  it('reads a draft saved before vocal/style tuning existed as unset', () => {
    globalThis.localStorage.setItem(
      KEY,
      JSON.stringify({ lyrics: 'a', style: 'b', title: 'c', instrumental: false, negativeTags: '' }),
    );
    const d = loadDraft();
    expect(d.vocalGender).toBe('');
    expect(d.styleWeight).toBe('');
    expect(d.weirdnessConstraint).toBe('');
    expect(d.audioWeight).toBe('');
  });

  it('drops an unknown vocalGender', () => {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ vocalGender: 'nonsense' }));
    expect(loadDraft().vocalGender).toBe('');
  });
});
