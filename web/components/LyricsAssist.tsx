import { useState } from 'react';
import { LYRICS_PROMPT_MAX, type LyricsVariant } from '../lib/api';
import { useLyrics } from '../hooks/useLyrics';
import { SpinnerIcon } from './icons';

interface Props {
  onPick: (variant: LyricsVariant) => void;
  onClose: () => void;
}

export function LyricsAssist({ onPick, onClose }: Props) {
  const [prompt, setPrompt] = useState('');
  const { state, variants, error, start, reset } = useLyrics();
  const busy = state === 'working';

  return (
    <div className="assist-panel">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor="lyrics-brief" className="field-label" style={{ marginBottom: 0 }}>
          บอกธีมสั้น ๆ แล้วให้ AI แต่งให้
        </label>
        <span className="text-xs tabular-nums" style={{ color: 'var(--ink-3)' }}>
          {prompt.length} / {LYRICS_PROMPT_MAX}
        </span>
      </div>

      <textarea
        id="lyrics-brief"
        className="input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={LYRICS_PROMPT_MAX}
        rows={2}
        disabled={busy}
        placeholder="เพลงคิดถึงบ้าน คนทำงานกรุงเทพ กลับต่างจังหวัดปีละครั้ง"
      />

      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}

      {state === 'done' && (
        <ul className="assist-list">
          {variants.map((v, i) => (
            <li key={`${v.title}-${i}`}>
              <button
                type="button"
                className="assist-option"
                onClick={() => { onPick(v); onClose(); }}
              >
                <span className="assist-option-title">{v.title || 'ไม่มีชื่อ'}</span>
                <span className="assist-option-body">{v.text.slice(0, 160)}…</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-assist"
          disabled={busy || !prompt.trim()}
          onClick={() => start(prompt)}
        >
          {busy ? (
            <><SpinnerIcon className="h-4 w-4 animate-spin" /> กำลังแต่ง…</>
          ) : state === 'done' ? 'แต่งใหม่อีกชุด' : 'แต่งเนื้อเพลง'}
        </button>
        <button
          type="button"
          className="cursor-pointer text-sm"
          style={{ color: 'var(--ink-3)' }}
          onClick={() => { reset(); onClose(); }}
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
