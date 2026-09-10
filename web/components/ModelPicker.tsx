import { MODELS, type KieModel } from '../lib/api';

interface Props {
  value: KieModel;
  onChange: (model: KieModel) => void;
}

/** คำอธิบายสั้น ๆ ของแต่ละรุ่น อ้างจากหน้า generate-music ของ kie.ai */
const DESCRIPTIONS: Record<KieModel, string> = {
  V6: 'มาตรฐาน เสียงร้องเป็นธรรมชาติ รายละเอียดแน่น',
  V6_WILD: 'กล้าและมีเอกลักษณ์กว่า เหมาะกับงานทดลอง',
  V6_MINI: 'เร็วและเบา แลกกับรายละเอียดที่น้อยลง',
};

export function ModelPicker({ value, onChange }: Props) {
  return (
    <div className="model-pick" role="radiogroup" aria-label="รุ่นของโมเดล">
      {MODELS.map((model) => (
        <label key={model} className="model-card" data-on={value === model}>
          <input
            type="radio"
            name="kieModel"
            className="sr-only"
            checked={value === model}
            onChange={() => onChange(model)}
          />
          <span className="model-card-name">{model}</span>
          <span className="model-card-desc">{DESCRIPTIONS[model]}</span>
        </label>
      ))}
    </div>
  );
}
