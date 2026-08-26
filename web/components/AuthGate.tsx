import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';

/** Password gate — wraps app content; shown when any api call returns 401. */
export function AuthGate({ onAuthed, children }: { onAuthed: () => void; children: ReactNode }) {
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
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border p-8"
        style={{ background: 'var(--color-muted)', borderColor: 'var(--color-border)' }}
      >
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Song-Auto</h1>
        <p className="mb-6 text-sm" style={{ color: '#94a3b8' }}>
          เข้าสู่ระบบด้วยรหัสผ่านทีม
        </p>

        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          รหัสผ่าน
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="min-h-[44px] w-full rounded-lg border px-3 text-base outline-none transition-colors duration-200 focus:ring-2"
          style={{ background: 'var(--color-background)', borderColor: 'var(--color-border)' }}
        />
        {error && (
          <p className="mt-2 text-sm" style={{ color: 'var(--color-destructive)' }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-6 min-h-[44px] w-full cursor-pointer rounded-lg font-medium text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#0f172a' }}
        >
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
