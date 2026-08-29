import { useEffect, useState } from 'react';
import { api, type GenerateBody, type Persona, type Song } from '../lib/api';
import { loadDraft, saveDraft, type Draft } from '../lib/draft';
import { SpinnerIcon } from './icons';

const LYRICS_MAX = 5000;
const STYLE_MAX = 1000;
const TITLE_MAX = 80;

interface Props {
  personas: Persona[];
  personasLoaded: boolean;
  onCreated: (songs: Song[]) => void;
}

export function CreatePanel({ personas, personasLoaded, onCreated }: Props) {
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lyrics, style, title, instrumental, negativeTags, personaId, personaModel } = draft;

  // the draft is the only thing worth persisting — everything else is transient
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  // a persisted personaId can point at a persona that no longer exists (DB
  // cleared / different environment) — the <select> then falls back to
  // "ไม่ใช้ persona" with no matching <option>, so the draft must follow suit
  // or a stale personaId would ship silently on submit. Wait for the initial
  // fetch to settle first: personas starts empty while still loading, and
  // acting on that would wipe a legitimate personaId every page load.
  useEffect(() => {
    if (!personasLoaded) return;
    if (personaId && !personas.some((p) => p.personaId === personaId)) {
      setDraft((d) => ({ ...d, personaId: '', personaModel: '' }));
    }
  }, [personasLoaded, personas, personaId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSubmit = Boolean(style.trim() && title.trim() && (instrumental || lyrics.trim())) && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const body: GenerateBody = {
        // our own /api/generate row always stores a prompt (possibly empty);
        // kieGenerate (server-side) is what decides whether to forward it to kie.ai
        prompt: instrumental ? '' : lyrics,
        style,
        title,
        instrumental,
        model: 'V5',
        ...(negativeTags ? { negativeTags } : {}),
        ...(personaId && personaModel ? { personaId, personaModel } : {}),
      };
      const created = await api<{ songs: Song[] }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(created.songs);
      // the form deliberately keeps its values: tweak a word, create again
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างเพลงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col gap-6 p-6">
      {/* Instrumental */}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--text-2)' }}>
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => set('instrumental', e.target.checked)}
          className="h-4 w-4 accent-[#22c55e]"
        />
        Instrumental — ไม่มีคำร้อง
      </label>

      {/* Lyrics */}
      {!instrumental && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="lyrics" className="field-label" style={{ marginBottom: 0 }}>Lyrics</label>
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
              {lyrics.length.toLocaleString()} / {LYRICS_MAX.toLocaleString()}
            </span>
          </div>
          <textarea
            id="lyrics"
            className="input"
            value={lyrics}
            onChange={(e) => set('lyrics', e.target.value)}
            rows={10}
            maxLength={LYRICS_MAX}
            placeholder={'[Verse 1]\n…\n\n[Chorus]\n…'}
          />
        </div>
      )}

      <div className="h-px shrink-0" style={{ background: 'var(--border)' }} />

      {/* Style */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="style" className="field-label" style={{ marginBottom: 0 }}>Style of music</label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {style.length} / {STYLE_MAX}
          </span>
        </div>
        <input
          id="style"
          className="input"
          value={style}
          onChange={(e) => set('style', e.target.value)}
          maxLength={STYLE_MAX}
          placeholder="dream pop, ethereal, lush reverb"
        />
      </div>

      {/* Title */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="title" className="field-label" style={{ marginBottom: 0 }}>Title</label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {title.length} / {TITLE_MAX}
          </span>
        </div>
        <input
          id="title"
          className="input"
          value={title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="ชื่อเพลง"
        />
      </div>

      {/* Persona — ซ่อนทั้งก้อนถ้ายังไม่มีสักอัน ฟอร์มจะได้ไม่รกโดยไม่จำเป็น */}
      {personas.length > 0 && (
        <div>
          <label htmlFor="persona" className="field-label">ใช้ persona</label>
          <select
            id="persona"
            className="input"
            value={personaId}
            onChange={(e) => {
              const next = e.target.value;
              setDraft((d) => ({
                ...d,
                personaId: next,
                // เลือก persona ครั้งแรกให้ตั้งต้นที่แนวดนตรี · ยกเลิกแล้วล้างโหมดทิ้ง
                personaModel: next ? (d.personaModel || 'style_persona') : '',
              }));
            }}
          >
            <option value="">ไม่ใช้ persona</option>
            {personas.map((p) => (
              <option key={p.id} value={p.personaId}>{p.name}</option>
            ))}
          </select>

          {personaId && (
            <div className="mt-2 flex gap-4 text-sm" style={{ color: 'var(--text-2)' }}>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="personaModel"
                  className="accent-[#22c55e]"
                  checked={personaModel === 'style_persona'}
                  onChange={() => set('personaModel', 'style_persona')}
                />
                เอาแนวดนตรี
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="personaModel"
                  className="accent-[#22c55e]"
                  checked={personaModel === 'voice_persona'}
                  onChange={() => set('personaModel', 'voice_persona')}
                />
                เอาเสียงร้อง
              </label>
            </div>
          )}
        </div>
      )}

      {/* Exclude styles — collapsed */}
      <details className="text-sm">
        <summary className="cursor-pointer select-none list-none" style={{ color: 'var(--text-3)' }}>
          Exclude styles (optional)
        </summary>
        <input
          aria-label="Exclude styles"
          className="input mt-3"
          value={negativeTags}
          onChange={(e) => set('negativeTags', e.target.value)}
          placeholder="heavy metal, upbeat drums"
        />
      </details>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
          {error}
        </p>
      )}

      <div className="form-footer">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <SpinnerIcon className="h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            'Create song'
          )}
        </button>
      </div>
    </form>
  );
}
