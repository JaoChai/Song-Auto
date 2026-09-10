export type PersonaModel = '' | 'style_persona' | 'voice_persona';
export type VocalGender = '' | 'm' | 'f';

/** ค่าที่ผู้ใช้กรอกในฟอร์มสร้างเพลง — เก็บไว้ข้ามการสร้างและข้ามการรีเฟรช */
export interface Draft {
  lyrics: string;
  style: string;
  title: string;
  instrumental: boolean;
  negativeTags: string;
  personaId: string;
  personaModel: PersonaModel;
  vocalGender: VocalGender;
  /** เก็บเป็นสตริงเพื่อแยกค่าว่าง (ไม่ระบุ = ไม่ส่งไป kie) จาก "0" */
  styleWeight: string;
  weirdnessConstraint: string;
  audioWeight: string;
}

const KEY = 'song-auto:draft';

export const EMPTY_DRAFT: Draft = {
  lyrics: '',
  style: '',
  title: '',
  instrumental: false,
  negativeTags: '',
  personaId: '',
  personaModel: '',
  vocalGender: '',
  styleWeight: '',
  weirdnessConstraint: '',
  audioWeight: '',
};

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const personaModel = (value: unknown): PersonaModel =>
  value === 'style_persona' || value === 'voice_persona' ? value : '';

const vocalGender = (value: unknown): VocalGender =>
  value === 'm' || value === 'f' ? value : '';

/** อ่าน draft ที่เก็บไว้ ทุกความล้มเหลว (ไม่มี storage / JSON พัง / ชนิดผิด) คืน EMPTY_DRAFT */
export function loadDraft(): Draft {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_DRAFT;
    const d = parsed as Record<string, unknown>;
    return {
      lyrics: str(d.lyrics),
      style: str(d.style),
      title: str(d.title),
      instrumental: d.instrumental === true,
      negativeTags: str(d.negativeTags),
      personaId: str(d.personaId),
      personaModel: personaModel(d.personaModel),
      vocalGender: vocalGender(d.vocalGender),
      styleWeight: str(d.styleWeight),
      weirdnessConstraint: str(d.weirdnessConstraint),
      audioWeight: str(d.audioWeight),
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

/** บันทึก draft — storage ใช้ไม่ได้ (โหมดส่วนตัว / quota เต็ม) ไม่ถือเป็น error */
export function saveDraft(draft: Draft): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(draft));
  } catch {
    // ไม่มีที่เก็บ — ฟอร์มยังทำงานได้ปกติ แค่ไม่จำ
  }
}
