import { useState } from 'react';
import { api } from '../lib/api';

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
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card rise-in w-full max-w-sm p-8">
        {/* wordmark */}
        <h1 className="text-center text-xl font-semibold tracking-tight">Song-Auto</h1>
        <p className="mt-1 mb-7 text-center text-sm" style={{ color: 'var(--text-2)' }}>
          AI Music Studio
        </p>

        <label htmlFor="password" className="field-label">
          รหัสผ่าน
        </label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
        />
        {error && (
          <p className="mt-2 text-sm" role="alert" style={{ color: '#f87171' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !password} className="btn-primary mt-6">
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
