'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name || email.split('@')[0], timezone: 'Asia/Colombo' },
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      router.push('/dashboard');
      router.refresh();
      return;
    }
    setInfo('Check your inbox to confirm your email, then sign in.');
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-grove">Shanaya OS</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your OS</h1>
        <p className="mt-1 text-sm text-muted">
          Capture everything. Confirm before anything changes.
        </p>
      </div>

      <form onSubmit={signUp} className="grid gap-4">
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </Field>
        <Field label="Email" htmlFor="su-email" required>
          <Input
            id="su-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field
          label="Password"
          htmlFor="su-password"
          required
          helper="At least 8 characters."
        >
          <Input
            id="su-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {info ? <p className="text-sm text-grove">{info}</p> : null}

        <Button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-8 text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-grove underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
