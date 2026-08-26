import { useState } from 'react';
import { api, type GenerateBody, type Song } from '../lib/api';

// Custom mode only — V5 limits (kie.ai Suno API)
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

  // Custom mode: style+title always required. Lyrics required only when not instrumental.
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างเพลงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    background: 'var(--color-background)',
    borderColor: 'var(--color-border)',
  };
  const counter = 'mt-1 text-right text-xs';

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 overflow-y-auto rounded-xl border p-6"
      style={{ background: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Create</h2>
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--color-border)', color: '#c7d2fe' }}>
          Custom · V5
        </span>
      </div>

      <div>
        <label htmlFor="lyrics" className="mb-1 block text-sm font-medium">
          Lyrics <span className="font-normal" style={{ color: '#94a3b8' }}>(ใช้ [Verse]/[Chorus] ได้)</span>
        </label>
        <textarea
          id="lyrics"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={8}
          disabled={instrumental}
          maxLength={LYRICS_MAX}
          placeholder={'[Verse 1]\n...\n\n[Chorus]\n...'}
          className="w-full resize-y rounded-lg border px-3 py-2 text-base outline-none transition-colors duration-200 focus:ring-2 disabled:opacity-40"
          style={inputStyle}
        />
        <p className={counter} style={{ color: '#94a3b8' }}>
          {lyrics.length}/{LYRICS_MAX}
        </p>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => setInstrumental(e.target.checked)}
          className="h-4 w-4 accent-[#22c55e]"
        />
        Instrumental (ไม่มีคำร้อง)
      </label>

      <div>
        <label htmlFor="style" className="mb-1 block text-sm font-medium">
          Style of Music
        </label>
        <input
          id="style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          maxLength={STYLE_MAX}
          placeholder="lo-fi hip hop, mellow, vinyl crackle"
          className="min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
          style={inputStyle}
        />
        <p className={counter} style={{ color: '#94a3b8' }}>
          {style.length}/{STYLE_MAX}
        </p>
      </div>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="ชื่อเพลง"
          className="min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
          style={inputStyle}
        />
        <p className={counter} style={{ color: '#94a3b8' }}>
          {title.length}/{TITLE_MAX}
        </p>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer select-none" style={{ color: 'var(--color-accent)' }}>
          Exclude styles (ไม่เอาสไตล์ไหน)
        </summary>
        <input
          value={negativeTags}
          onChange={(e) => setNegativeTags(e.target.value)}
          placeholder="Heavy Metal, Upbeat Drums"
          className="mt-2 min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
          style={inputStyle}
        />
      </details>

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      {!canSubmit && !busy && (
        <p className="text-xs" style={{ color: '#94a3b8' }}>
          กรอก Style + Title{!instrumental && ' + Lyrics'} เพื่อสร้างเพลง
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-[44px] w-full cursor-pointer rounded-lg font-semibold transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#0f172a' }}
      >
        {busy ? '⏳ กำลังส่งคำขอ…' : '🎵 Create'}
      </button>
    </form>
  );
}
