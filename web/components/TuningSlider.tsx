import { useId } from 'react';
import { InfoIcon } from './icons';

interface Props {
  label: string;
  hint: string;
  /** '' = ยังไม่ได้ตั้งค่า (ไม่ส่งไป kie — ให้ kie ใช้ค่าเริ่มต้นของมันเอง) */
  value: string;
  onChange: (value: string) => void;
}

const TICKS = Array.from({ length: 11 });

/** สไลเดอร์แบบมีขีดบอกตำแหน่ง ใช้สำหรับพารามิเตอร์ 0–1 ที่ไม่บังคับของ kie.ai */
export function TuningSlider({ label, hint, value, onChange }: Props) {
  const id = useId();
  const isSet = value !== '';
  const pct = Math.round(Number(isSet ? value : '0.5') * 100);

  return (
    <div className="tune-slider" data-set={isSet}>
      <div className="tune-slider-head">
        <label htmlFor={id} className="tune-slider-label">
          {label}
          <span className="tune-slider-info" title={hint} aria-label={hint}>
            <InfoIcon className="h-3.5 w-3.5" />
          </span>
        </label>
        <span className="tune-slider-pct">{isSet ? `${pct}%` : 'อัตโนมัติ'}</span>
      </div>
      <div className="tune-slider-track-wrap">
        <div className="tune-slider-ticks" aria-hidden="true">
          {TICKS.map((_, i) => (
            <span key={i} />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isSet ? value : 0.5}
          onChange={(e) => onChange(e.target.value)}
          className="tune-slider-input"
        />
      </div>
    </div>
  );
}
