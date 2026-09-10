import { useState } from 'react';
import {
  canExtend, canPersona, defaultPersonaWindow, fmtDuration, personaBlockReason,
  PERSONA_SEGMENT_MAX, PERSONA_SEGMENT_MIN, type Song,
} from '../lib/api';
import { CoverArt } from './CoverArt';
import { ExtendPanel } from './ExtendPanel';

interface Props {
  song: Song;
  parent: Song | null;
  personaName: string | null;
  onClose: () => void;
  onSelectSong: (id: string) => void;
  onExtended: (songs: Song[]) => void;
  onCreatePersona: (song: Song, input: {
    name: string; description: string; vocalStart: number; vocalEnd: number; style: string;
  }) => Promise<void>;
}

export function SongDetail({
  song, parent, personaName, onClose, onSelectSong, onExtended, onCreatePersona,
}: Props) {
  const [open, setOpen] = useState<'none' | 'extend' | 'persona'>('none');

  const [name, setName] = useState('');
  const [desc, setDesc] = useState([song.tags, song.style].filter(Boolean).join(', '));
  const [pStyle, setPStyle] = useState('');
  const [start, setStart] = useState(() => defaultPersonaWindow(song.duration).start);
  const [end, setEnd] = useState(() => defaultPersonaWindow(song.duration).end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = personaBlockReason(song);
  const extensible = canExtend(song);
  const alreadyMade = personaName !== null;
  const maxTime = typeof song.duration === 'number' ? song.duration : PERSONA_SEGMENT_MAX;
  const span = end - start;
  const spanOk = span >= PERSONA_SEGMENT_MIN && span <= PERSONA_SEGMENT_MAX;

  const submitPersona = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreatePersona(song, {
        name, description: desc, vocalStart: start, vocalEnd: end, style: pStyle,
      });
      setOpen('none');
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้าง persona ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="song-detail" aria-label={`รายละเอียด ${song.title || 'เพลงที่ยังไม่ได้ตั้งชื่อ'}`}>
      <div className="song-detail-head">
        <div className="song-detail-cover"><CoverArt song={song} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="song-detail-title">
            {song.title || <span style={{ color: 'var(--ink-3)' }}>ยังไม่ได้ตั้งชื่อ</span>}
          </h2>
          <p className="song-detail-meta">
            {[song.tags || song.style, fmtDuration(song.duration), song.model]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="ปิดแผงรายละเอียด">
          ✕
        </button>
      </div>

      {parent && (
        <button type="button" className="lineage-link" onClick={() => onSelectSong(parent.id)}>
          ต่อจาก · {parent.title || 'เพลงที่ยังไม่ได้ตั้งชื่อ'}
          {song.continueAt !== null && ` (วินาทีที่ ${fmtDuration(song.continueAt)})`}
        </button>
      )}

      {song.prompt.trim() && (
        <section className="song-detail-lyrics">
          <h3 className="song-detail-section">เนื้อเพลง</h3>
          <pre className="lyrics-body">{song.prompt}</pre>
        </section>
      )}

      <div className="song-detail-actions">
        <button
          type="button"
          className="btn-outline"
          disabled={!extensible}
          title={extensible ? undefined : 'เพลงนี้สร้างก่อนระบบเก็บรหัสแทร็ก จึงต่อเพลงไม่ได้'}
          onClick={() => setOpen(open === 'extend' ? 'none' : 'extend')}
        >
          ต่อเพลง
        </button>
        <button
          type="button"
          className="btn-outline btn-outline-pink"
          disabled={!canPersona(song) || alreadyMade}
          title={alreadyMade ? `ทำแล้วในชื่อ “${personaName}”` : blocked ?? undefined}
          onClick={() => setOpen(open === 'persona' ? 'none' : 'persona')}
        >
          ทำ persona
        </button>
      </div>

      {(blocked || alreadyMade) && (
        <p className="song-detail-note">
          {alreadyMade ? `เพลงนี้ทำ persona ไปแล้วในชื่อ “${personaName}”` : blocked}
        </p>
      )}

      {open === 'extend' && (
        <ExtendPanel song={song} onCreated={onExtended} onClose={() => setOpen('none')} />
      )}

      {open === 'persona' && (
        <div className="detail-panel">
          <h4 className="detail-panel-title">ทำ persona จากเพลงนี้</h4>
          <p className="detail-panel-note">
            เลือกช่วงที่ให้ระบบฟัง ยาวได้ {PERSONA_SEGMENT_MIN}–{PERSONA_SEGMENT_MAX} วินาที
            เลือกท่อนที่เป็นตัวแทนของเพลงมากที่สุด
          </p>

          <div>
            <label htmlFor={`pn-${song.id}`} className="field-label">ชื่อ persona</label>
            <input id={`pn-${song.id}`} className="input" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="เสียงฝนเชียงใหม่" />
          </div>

          <div>
            <label htmlFor={`pd-${song.id}`} className="field-label">คำอธิบาย</label>
            <textarea id={`pd-${song.id}`} className="input" rows={3} value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="แนวดนตรี อารมณ์ เครื่องดนตรี ลักษณะเสียงร้อง" />
          </div>

          <div>
            <label htmlFor={`ps-${song.id}`} className="field-label">แท็บแนวเพลง (ไม่บังคับ)</label>
            <input id={`ps-${song.id}`} className="input" value={pStyle}
              onChange={(e) => setPStyle(e.target.value)} placeholder="Dream Pop" />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="field-label" style={{ marginBottom: 0 }}>ช่วงที่ให้ฟัง</span>
              <span className="text-xs tabular-nums"
                style={{ color: spanOk ? 'var(--ink-3)' : 'var(--danger)' }}>
                {fmtDuration(start)} – {fmtDuration(end)} ({Math.round(span)} วินาที)
              </span>
            </div>
            <label htmlFor={`pst-${song.id}`} className="sr-only">จุดเริ่ม</label>
            <input id={`pst-${song.id}`} type="range" min={0} max={Math.max(0, maxTime - PERSONA_SEGMENT_MIN)}
              step={0.5} value={start} className="w-full accent-[#be185d]"
              onChange={(e) => {
                const v = Number(e.target.value);
                setStart(v);
                if (end - v < PERSONA_SEGMENT_MIN) setEnd(Math.min(maxTime, v + PERSONA_SEGMENT_MIN));
                if (end - v > PERSONA_SEGMENT_MAX) setEnd(Math.min(maxTime, v + PERSONA_SEGMENT_MAX));
              }} />
            <label htmlFor={`pe-${song.id}`} className="sr-only">จุดจบ</label>
            <input id={`pe-${song.id}`} type="range" min={PERSONA_SEGMENT_MIN} max={maxTime}
              step={0.5} value={end} className="w-full accent-[#be185d]"
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnd(v);
                if (v - start < PERSONA_SEGMENT_MIN) setStart(Math.max(0, v - PERSONA_SEGMENT_MIN));
                if (v - start > PERSONA_SEGMENT_MAX) setStart(Math.max(0, v - PERSONA_SEGMENT_MAX));
              }} />
          </div>

          {error && <p role="alert" className="error-box">{error}</p>}

          <div className="flex gap-2">
            <button type="button" className="btn-assist"
              disabled={busy || !name.trim() || !desc.trim() || !spanOk}
              onClick={() => void submitPersona()}>
              {busy ? 'กำลังสร้าง…' : 'สร้าง persona'}
            </button>
            <button type="button" className="cursor-pointer text-sm"
              style={{ color: 'var(--ink-3)' }} onClick={() => setOpen('none')}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
