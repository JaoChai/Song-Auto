import { useState } from 'react';
import { api, type GenerateBody, type Song } from '../lib/api';

const LYRICS_MAX = 5000;
const STYLE_MAX = 1000;
const TITLE_MAX = 80;

interface Props {
  onCreated: (song: Song) => void;
}

export function CreatePanel({ onCreated }: Props) {
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [negativeTags, setNegativeTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(style.trim() && title.trim() && (instrumental || lyrics.trim())) && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const body: GenerateBody & { customMode: true } = {
        prompt: instrumental ? '' : lyrics,
        style,
        title,
        instrumental,
        model: 'V5',
        ...(negativeTags ? { negativeTags } : {}),
      };
      const created = await api<{ id: string; status: 'PENDING' }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated({
        id: created.id,
        taskId: '',
        title,
        prompt: lyrics,
        style,
        tags: '',
        model: 'V5',
        instrumental: instrumental ? 1 : 0,
        status: 'PENDING',
        error: null,
        r2Key: null,
        duration: null,
        createdAt: new Date().toISOString(),
      });
      setLyrics(''); setStyle(''); setTitle(''); setInstrumental(false); setNegativeTags('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างเพลงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card flex h-full flex-col gap-6 p-7">
      {/* Lyrics */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="lyrics" className="text-sm font-medium">Lyrics</label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {lyrics.length.toLocaleString()} / {LYRICS_MAX.toLocaleString()}
          </span>
        </div>
        <textarea
          id="lyrics"
          className="input"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={10}
          disabled={instrumental}
          maxLength={LYRICS_MAX}
          placeholder={'[Verse 1]\n…\n\n[Chorus]\n…'}
        />
      </div>

      {/* Instrumental */}
      <label className="-mt-3 flex cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--text-2)' }}>
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => setInstrumental(e.target.checked)}
          className="h-4 w-4 accent-[#22c55e]"
        />
        Instrumental — ไม่มีคำร้อง
      </label>

      <div className="h-px shrink-0" style={{ background: 'var(--border)' }} />

      {/* Style */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="style" className="text-sm font-medium">Style of music</label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {style.length} / {STYLE_MAX}
          </span>
        </div>
        <input
          id="style"
          className="input"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          maxLength={STYLE_MAX}
          placeholder="dream pop, ethereal, lush reverb"
        />
      </div>

      {/* Title */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="title" className="text-sm font-medium">Title</label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
            {title.length} / {TITLE_MAX}
          </span>
        </div>
        <input
          id="title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="ชื่อเพลง"
        />
      </div>

      {/* Exclude styles — collapsed */}
      <details className="text-sm">
        <summary className="cursor-pointer select-none list-none" style={{ color: 'var(--text-3)' }}>
          Exclude styles (optional)
        </summary>
        <input
          className="input mt-3"
          value={negativeTags}
          onChange={(e) => setNegativeTags(e.target.value)}
          placeholder="heavy metal, upbeat drums"
        />
      </details>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-primary mt-auto inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Creating…
          </>
        ) : (
          'Create song'
        )}
      </button>
    </form>
  );
}
