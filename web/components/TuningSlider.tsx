import { useId } from 'react';
import { InfoIcon } from './icons';

interface Props {
  label: string;
  hint: string;
  /** '' = ยังไม่ได้ตั้งค่า (ไม่ส่งไป kie — ให้ kie ใช้ค่าเริ่มต้นของมันเอง) */
  value: string;
  onChange: (value: string) => void;
  /** ช่วงค่า ตั้งต้นเป็น 0–1 ตามพารามิเตอร์ที่ไม่บังคับของ kie */
  min?: number;
  max?: number;
  step?: number;
  /** แปลงค่าเป็นข้อความมุมขวา ตั้งต้นเป็นเปอร์เซ็นต์ */
  format?: (value: number) => string;
}

const TICKS = Array.from({ length: 11 });

const asPercent = (value: number): string => `${Math.round(value * 100)}%`;

/** สไลเดอร์แบบมีขีดบอกตำแหน่ง ใช้สำหรับพารามิเตอร์ที่ไม่บังคับของ kie.ai */
export function TuningSlider({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = asPercent,
}: Props) {
  const id = useId();
  const isSet = value !== '';
  // ยังไม่ตั้งค่า = วาง thumb กลางช่วงไว้เฉย ๆ ค่านั้นไม่ถูกส่งไปไหน
  const midpoint = (min + max) / 2;
  const current = isSet ? Number(value) : midpoint;

  return (
    <div className="tune-slider" data-set={isSet}>
      <div className="tune-slider-head">
        <label htmlFor={id} className="tune-slider-label">
          {label}
          <span className="tune-slider-info" title={hint} aria-label={hint}>
            <InfoIcon className="h-3.5 w-3.5" />
          </span>
        </label>
        <span className="tune-slider-value">
          <span className="tune-slider-pct">{isSet ? format(current) : 'อัตโนมัติ'}</span>
          {isSet && (
            <button type="button" className="tune-slider-reset" onClick={() => onChange('')}>
              อัตโนมัติ
            </button>
          )}
        </span>
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
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="tune-slider-input"
        />
      </div>
    </div>
  );
}
