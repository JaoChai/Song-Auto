/** ค่าที่ผู้ใช้กรอกในฟอร์มสร้างเพลง — เก็บไว้ข้ามการสร้างและข้ามการรีเฟรช */
export interface Draft {
  lyrics: string;
  style: string;
  title: string;
  instrumental: boolean;
  negativeTags: string;
}

const KEY = 'song-auto:draft';

export const EMPTY_DRAFT: Draft = {
  lyrics: '',
  style: '',
  title: '',
  instrumental: false,
  negativeTags: '',
};

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

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
