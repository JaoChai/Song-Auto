import { useCallback, useEffect, useRef, useState } from 'react';
import { pollLyrics, startLyrics, type LyricsVariant } from '../lib/api';

const POLL_INTERVAL_MS = 3_000;
const GIVE_UP_MS = 90_000;

type State = 'idle' | 'working' | 'done' | 'error';

/**
 * งานแต่งเนื้อเพลงมีอายุสั้นและไม่ถูกเก็บลงฐานข้อมูล ปิดแท็บกลางคันแล้วงานหายไปเฉย ๆ
 * ซึ่งยอมรับได้เพราะยิงใหม่ได้ทันที — เลิกถามเมื่อครบ 90 วินาที
 */
export function useLyrics() {
  const [state, setState] = useState<State>('idle');
  const [variants, setVariants] = useState<LyricsVariant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setState('idle');
    setVariants([]);
    setError(null);
  }, [stop]);

  const start = useCallback((prompt: string) => {
    stop();
    setState('working');
    setVariants([]);
    setError(null);
    startedAt.current = Date.now();
    // งานใหม่เริ่มทับเดิมได้ทุกเมื่อ (กด "แต่งใหม่อีกชุด") — ผลของงานเก่าที่ยังลอยอยู่
    // ต้องถูกทิ้ง ไม่งั้นมันจะกด stop ของงานใหม่และเทผลเก่าลงแผง
    const gen = startedAt.current;

    void startLyrics(prompt)
      .then(({ taskId }) => {
        if (startedAt.current !== gen) return;
        timer.current = setInterval(() => {
          if (Date.now() - startedAt.current > GIVE_UP_MS) {
            stop();
            setState('error');
            setError('รอนานเกินไป ลองกดแต่งใหม่อีกครั้ง');
            return;
          }
          void pollLyrics(taskId)
            .then((res) => {
              if (startedAt.current !== gen) return;
              if (res.status === 'SUCCESS') {
                stop();
                setVariants(res.variants);
                setState(res.variants.length > 0 ? 'done' : 'error');
                if (res.variants.length === 0) setError('ไม่ได้เนื้อเพลงกลับมา ลองใหม่อีกครั้ง');
              } else if (res.status === 'FAILED') {
                stop();
                setState('error');
                setError(res.error);
              }
              // PENDING — รอบหน้าถามใหม่
            })
            .catch(() => {
              /* ชั่วคราว — รอบหน้าถามใหม่ */
            });
        }, POLL_INTERVAL_MS);
      })
      .catch((e: unknown) => {
        if (startedAt.current !== gen) return;
        setState('error');
        setError(e instanceof Error ? e.message : 'เริ่มงานแต่งเนื้อเพลงไม่สำเร็จ');
      });
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { state, variants, error, start, reset };
}
