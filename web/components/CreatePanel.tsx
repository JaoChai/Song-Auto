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
      setLyrics('');
      setStyle('');
      setTitle('');
      setInstrumental(false);
      setNegativeTags('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างเพลงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="glass flex h-full flex-col gap-5 overflow-y-auto rounded-2xl p-6">
      {/* header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Create a song</h2>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-dim)' }}>
          Custom mode · Suno V5
        </p>
      </div>

      {/* Lyrics */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="lyrics" className="text-sm font-medium">
            Lyrics
          </label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
            {lyrics.length.toLocaleString()} / {LYRICS_MAX.toLocaleString()}
          </span>
        </div>
        <textarea
          id="lyrics"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={9}
          disabled={instrumental}
          maxLength={LYRICS_MAX}
          placeholder={'[Verse 1]\nWrite your words here…\n\n[Chorus]\nSoar above the noise'}
          className="w-full resize-y rounded-xl border px-4 py-3 text-[15px] leading-relaxed outline-none transition-colors duration-200 placeholder:text-white/25 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/30 disabled:opacity-35"
        />
      </div>

      {/* Instrumental toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={instrumental}
        onClick={() => setInstrumental((v) => !v)}
        className="pressable flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3"
        style={{ borderColor: instrumental ? '#7c3aed66' : 'rgba(255,255,255,0.08)' }}
      >
        <span className="flex flex-col items-start">
          <span className="text-sm font-medium">Instrumental</span>
          <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
            เพลงประกอบ ไม่มีคำร้อง
          </span>
        </span>
        <span
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
          style={{ background: instrumental ? 'var(--color-primary)' : 'rgba(255,255,255,0.12)' }}
        >
          <span
            className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: instrumental ? 'translateX(22px)' : 'translateX(2px)' }}
          />
        </span>
      </button>

      {/* Style */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="style" className="text-sm font-medium">
            Style of music
          </label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
            {style.length} / {STYLE_MAX}
          </span>
        </div>
        <input
          id="style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          maxLength={STYLE_MAX}
          placeholder="dream pop, ethereal, lush reverb"
          className="min-h-[46px] w-full rounded-xl border px-4 text-[15px] outline-none transition-colors duration-200 placeholder:text-white/25 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/30"
        />
      </div>

      {/* Title */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
            {title.length} / {TITLE_MAX}
          </span>
        </div>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="ชื่อเพลง"
          className="min-h-[46px] w-full rounded-xl border px-4 text-[15px] outline-none transition-colors duration-200 placeholder:text-white/25 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/30"
        />
      </div>

      {/* Advanced: exclude styles — progressive disclosure */}
      <details className="group rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <summary
          className="cursor-pointer select-none text-sm font-medium list-none"
          style={{ color: 'var(--color-text-dim)' }}
        >
          <span className="inline-flex w-full items-center justify-between">
            Exclude styles
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform duration-200 group-open:rotate-180">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </summary>
        <input
          value={negativeTags}
          onChange={(e) => setNegativeTags(e.target.value)}
          placeholder="heavy metal, upbeat drums"
          className="mt-3 min-h-[44px] w-full rounded-lg border bg-transparent px-3 text-sm outline-none transition-colors duration-200 placeholder:text-white/20 focus:border-[#7c3aed]/60"
        />
      </details>

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(220,38,38,0.12)', color: '#f87171' }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="pressable mt-auto min-h-[52px] w-full cursor-pointer rounded-xl text-base font-semibold shadow-[0_8px_30px_rgba(124,58,237,0.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        style={{
          background: canSubmit
            ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)'
            : 'rgba(255,255,255,0.08)',
          color: '#fff',
        }}
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Creating…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Create song
          </span>
        )}
      </button>
    </form>
  );
}
