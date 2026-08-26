import { useState } from 'react';
import { api, MODELS, type GenerateBody, type Song } from '../lib/api';

const PROMPT_MAX_SIMPLE = 3000;
const PROMPT_MAX_CUSTOM = 5000;
const STYLE_MAX = 1000;
const TITLE_MAX = 80;

interface Props {
  onCreated: (song: Song) => void;
}

export function CreatePanel({ onCreated }: Props) {
  const [prompt, setPrompt] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');
  const [model, setModel] = useState<string>('V4_5');
  const [negativeTags, setNegativeTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // customMode when any advanced field is used (matches worker/kie mapping)
  const customMode = Boolean(style || title);
  const promptMax = customMode ? PROMPT_MAX_CUSTOM : PROMPT_MAX_SIMPLE;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const body: GenerateBody = {
        prompt,
        instrumental,
        model,
        ...(customMode ? { style, title } : {}),
        ...(negativeTags ? { negativeTags } : {}),
      };
      const created = await api<{ id: string; status: 'PENDING' }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated({
        id: created.id,
        taskId: '',
        title: title || prompt.slice(0, 60),
        prompt,
        style,
        tags: '',
        model,
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

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 overflow-y-auto rounded-xl border p-6"
      style={{ background: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
    >
      <h2 className="text-lg font-semibold">สร้างเพลง</h2>

      <div>
        <label htmlFor="prompt" className="mb-1 block text-sm font-medium">
          Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          maxLength={customMode ? undefined : PROMPT_MAX_SIMPLE}
          placeholder={instrumental ? 'บรรยายดนตรีที่อยากได้…' : 'ใส่เนื้อร้อง (custom mode) หรือบรรยายเพลงที่อยากได้…'}
          className="w-full resize-y rounded-lg border px-3 py-2 text-base outline-none transition-colors duration-200 focus:ring-2"
          style={inputStyle}
        />
        <p className="mt-1 text-right text-xs" style={{ color: '#94a3b8' }}>
          {prompt.length}/{promptMax}
        </p>
      </div>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => setInstrumental(e.target.checked)}
          className="h-4 w-4 accent-[#22c55e]"
        />
        เพลงประกอบ (ไม่มีคำร้อง)
      </label>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="cursor-pointer text-left text-sm font-medium underline-offset-2 hover:underline"
        style={{ color: 'var(--color-accent)' }}
        aria-expanded={advanced}
      >
        {advanced ? '▾ โหมดพื้นฐาน' : '▸ โหมดขั้นสูง (style / title / model)'}
      </button>

      {advanced && (
        <>
          <div>
            <label htmlFor="style" className="mb-1 block text-sm font-medium">
              Style
            </label>
            <input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Folk, Acoustic, Nostalgic"
              className="min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
              style={inputStyle}
            />
            <p className="mt-1 text-right text-xs" style={{ color: '#94a3b8' }}>
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
              className="min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
              style={inputStyle}
            />
            <p className="mt-1 text-right text-xs" style={{ color: '#94a3b8' }}>
              {title.length}/{TITLE_MAX}
            </p>
          </div>

          <div>
            <label htmlFor="model" className="mb-1 block text-sm font-medium">
              Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
              style={inputStyle}
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="neg" className="mb-1 block text-sm font-medium">
              Negative tags (สไตล์ที่ไม่เอา)
            </label>
            <input
              id="neg"
              value={negativeTags}
              onChange={(e) => setNegativeTags(e.target.value)}
              placeholder="Heavy Metal, Upbeat Drums"
              className="min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
              style={inputStyle}
            />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !prompt.trim()}
        className="min-h-[44px] w-full cursor-pointer rounded-lg font-semibold transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#0f172a' }}
      >
        {busy ? '⏳ กำลังส่งคำขอ…' : '🎵 สร้างเพลง'}
      </button>
    </form>
  );
}
