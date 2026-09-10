import { describe, it, expect } from 'vitest';
import {
  defaultPersonaWindow, canExtend, canPersona, personaBlockReason, type Song,
} from '../web/lib/api';

const song = (over: Partial<Song> = {}): Song => ({
  id: 's1', taskId: 't1', title: 'สายฝน', prompt: '', style: 'dream pop', tags: 'calm',
  model: 'V5', instrumental: 0, status: 'SUCCESS', error: null, r2Key: 's1.mp3',
  imageKey: null, duration: 100, createdAt: '2026-09-09T00:00:00.000Z', sunoId: 'a1',
  variant: 1, parentSongId: null, continueAt: null, ...over,
});

describe('defaultPersonaWindow', () => {
  it('เพลงยาวพอ ได้ช่วง 0 ถึง 30', () => {
    expect(defaultPersonaWindow(100)).toEqual({ start: 0, end: 30 });
  });

  it('เพลงสั้นกว่า 30 วินาที ใช้ทั้งเพลง', () => {
    expect(defaultPersonaWindow(22)).toEqual({ start: 0, end: 22 });
  });

  it('ไม่รู้ความยาว ใช้ค่าตั้งต้นของ kie', () => {
    expect(defaultPersonaWindow(null)).toEqual({ start: 0, end: 30 });
  });

  it('เพลงสั้นกว่าช่วงต่ำสุด 10 วินาที ยังคืนทั้งเพลง (ให้ฝั่ง server ปฏิเสธ)', () => {
    expect(defaultPersonaWindow(6)).toEqual({ start: 0, end: 6 });
  });
});

describe('canExtend', () => {
  it('เพลงที่สำเร็จและมี sunoId ต่อได้', () => {
    expect(canExtend(song())).toBe(true);
  });

  it('เพลงที่ยังไม่สำเร็จ ต่อไม่ได้', () => {
    expect(canExtend(song({ status: 'PENDING' }))).toBe(false);
  });

  it('เพลงที่ไม่มี sunoId ต่อไม่ได้', () => {
    expect(canExtend(song({ sunoId: null }))).toBe(false);
  });
});

describe('canPersona / personaBlockReason', () => {
  it('เพลง V5 ที่มี sunoId ทำ persona ได้ และไม่มีเหตุผลขัดขวาง', () => {
    expect(canPersona(song())).toBe(true);
    expect(personaBlockReason(song())).toBeNull();
  });

  it('เพลง V3_5 ทำไม่ได้ พร้อมบอกเหตุผล', () => {
    const s = song({ model: 'V3_5' });
    expect(canPersona(s)).toBe(false);
    expect(personaBlockReason(s)).toContain('V3_5');
  });

  it('เพลงที่ไม่มี sunoId ทำไม่ได้ พร้อมบอกเหตุผลที่ผู้ใช้เข้าใจได้', () => {
    const s = song({ sunoId: null });
    expect(canPersona(s)).toBe(false);
    expect(personaBlockReason(s)).toContain('รหัสแทร็ก');
  });

  it('เพลงที่ยังสร้างไม่เสร็จ ทำไม่ได้', () => {
    expect(canPersona(song({ status: 'PENDING' }))).toBe(false);
  });
});
