'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/dashboard';

  const [mode, setMode] = React.useState<'password' | 'magic'>('password');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback?next=${next}` },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo('Check your inbox for a sign-in link.');
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-grove">Shanaya OS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">
          Your external memory, one sign-in away.
        </p>
      </div>

      <form onSubmit={mode === 'password' ? signInWithPassword : sendMagicLink} className="grid gap-4">
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        {mode === 'password' ? (
          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {info ? <p className="text-sm text-grove">{info}</p> : null}

        <Button type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'password' ? 'magic' : 'password');
          setError(null);
        }}
        className="mt-4 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {mode === 'password' ? 'Use a magic link instead' : 'Use a password instead'}
      </button>

      <p className="mt-8 text-sm text-muted">
        No account yet?{' '}
        <Link href="/signup" className="font-medium text-grove underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
