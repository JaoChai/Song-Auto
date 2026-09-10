import { useState } from 'react';
import { extendSong, fmtDuration, type ExtendBody, type Song } from '../lib/api';
import { SpinnerIcon } from './icons';

interface Props {
  song: Song;
  onCreated: (songs: Song[]) => void;
  onClose: () => void;
}

/** จุดต่อตั้งต้น: 80% ของเพลง หรือ 30 วินาทีถ้าไม่รู้ความยาว */
const defaultContinueAt = (duration: number | null): number => {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 1) return 30;
  return Math.round(duration * 0.8 * 10) / 10;
};

export function ExtendPanel({ song, onCreated, onClose }: Props) {
  const [custom, setCustom] = useState(false);
  const [continueAt, setContinueAt] = useState(() => defaultContinueAt(song.duration));
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(song.style || song.tags || '');
  const [title, setTitle] = useState(song.title ? `${song.title} (ต่อ)` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const instrumental = song.instrumental === 1;
  const max = typeof song.duration === 'number' ? song.duration : 0;
  const ready = custom
    ? Boolean(style.trim() && title.trim() && (instrumental || prompt.trim()) && continueAt > 0)
    : true;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: ExtendBody = custom
        ? {
            defaultParamFlag: true,
            continueAt,
            style,
            title,
            ...(instrumental ? {} : { prompt }),
          }
        : { defaultParamFlag: false };
      const out = await extendSong(song.id, body);
      onCreated(out.songs);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ต่อเพลงไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-panel">
      <h4 className="detail-panel-title">ต่อเพลงนี้</h4>
      <p className="detail-panel-note">
        ได้เพลงใหม่สองเวอร์ชันในคลัง โมเดลใช้ {song.model} ตามเพลงต้นทาง เปลี่ยนไม่ได้
      </p>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--ink-2)' }}>
        <input
          type="checkbox"
          checked={custom}
          onChange={(e) => setCustom(e.target.checked)}
          className="h-4 w-4 accent-[#6d28d9]"
        />
        ปรับเอง (ไม่งั้นใช้ค่าเดิมของเพลงต้นทาง)
      </label>

      {custom && (
        <>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor={`at-${song.id}`} className="field-label" style={{ marginBottom: 0 }}>
                ต่อจากวินาทีที่
              </label>
              <span className="text-xs tabular-nums" style={{ color: 'var(--ink-3)' }}>
                {fmtDuration(continueAt)} / {fmtDuration(song.duration)}
              </span>
            </div>
            <input
              id={`at-${song.id}`}
              type="range"
              min={1}
              max={max > 1 ? Math.floor(max - 1) : 300}
              step={0.5}
              value={continueAt}
              onChange={(e) => setContinueAt(Number(e.target.value))}
              className="w-full accent-[#6d28d9]"
            />
          </div>

          {!instrumental && (
            <div>
              <label htmlFor={`p-${song.id}`} className="field-label">ให้ต่อไปทางไหน</label>
              <textarea
                id={`p-${song.id}`}
                className="input"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="ค่อย ๆ เบาลง แล้วจบด้วยเปียโนตัวเดียว"
              />
            </div>
          )}

          <div>
            <label htmlFor={`s-${song.id}`} className="field-label">แนวเพลง</label>
            <input id={`s-${song.id}`} className="input" value={style}
              onChange={(e) => setStyle(e.target.value)} maxLength={1000} />
          </div>

          <div>
            <label htmlFor={`t-${song.id}`} className="field-label">ชื่อเพลงใหม่</label>
            <input id={`t-${song.id}`} className="input" value={title}
              onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn-primary" style={{ minHeight: 40, fontSize: 14 }}
          disabled={busy || !ready} onClick={() => void submit()}>
          {busy ? (<><SpinnerIcon className="h-4 w-4 animate-spin" /> กำลังส่ง…</>) : 'ต่อเพลง'}
        </button>
        <button type="button" className="cursor-pointer text-sm" style={{ color: 'var(--ink-3)' }}
          onClick={onClose}>
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
