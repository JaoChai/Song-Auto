import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';

/** Password gate — wraps app content; shown when any api call returns 401. */
export function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth', { method: 'POST', body: JSON.stringify({ password }) });
      onAuthed();
    } catch {
      setError('รหัสผ่านไม่ถูกต้อง');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* ambient light blobs */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full"
        style={{ background: 'rgba(124,58,237,0.16)', filter: 'blur(90px)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full"
        style={{ background: 'rgba(99,102,241,0.12)', filter: 'blur(90px)' }}
      />

      <form
        onSubmit={submit}
        className="glass relative w-full max-w-sm rounded-2xl p-8 shadow-2xl rise-in"
      >
        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl mx-auto"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
            <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" stroke="#fff" strokeWidth="1.6" fill="none" />
            <circle cx="6" cy="18" r="3" fill="#fff" />
            <circle cx="18" cy="16" r="3" fill="#fff" />
          </svg>
        </div>

        <h1 className="text-center text-2xl font-semibold tracking-tight">Song-Auto</h1>
        <p className="mt-1 mb-7 text-center text-sm" style={{ color: 'var(--color-text-dim)' }}>
          AI Music Studio · Suno V5
        </p>

        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          รหัสผ่าน
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          className="min-h-[46px] w-full rounded-xl border bg-transparent px-4 text-base outline-none transition-colors duration-200 focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/30"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        />
        {error && (
          <p className="mt-2 text-sm" role="alert" style={{ color: '#f87171' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="pressable mt-6 min-h-[48px] w-full cursor-pointer rounded-xl text-base font-semibold shadow-[0_8px_30px_rgba(124,58,237,0.35)] transition-opacity hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)', color: '#fff' }}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </svg>
              กำลังเข้าสู่ระบบ…
            </span>
          ) : (
            'เข้าสู่ระบบ'
          )}
        </button>
      </form>
    </div>
  );
}
