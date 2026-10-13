'use client';

/**
 * Memory search: semantic (pgvector cosine) when available, SQL text
 * fallback otherwise. Every memory shows its source capture.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import type { MemoryRow } from '@/lib/supabase/types';
import { createMemory, searchMemories, type SearchHit } from '@/lib/actions/memory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, EmptyState } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils/dates';

const KINDS = ['decision', 'lesson', 'preference', 'fact', 'experience'] as const;

export function MemoryView({ memories }: { memories: MemoryRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<SearchHit[] | null>(null);
  const [mode, setMode] = React.useState<'vector' | 'text'>('text');
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<string>('fact');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) {
      setHits(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const res = await searchMemories(query.trim());
    setSearching(false);
    if (!res.ok) {
      setSearchError(res.error ?? 'Search failed');
      return;
    }
    setHits(res.data?.hits ?? []);
    setMode(res.data?.mode ?? 'text');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    const res = await createMemory({ kind, title: title.trim(), body: body.trim() });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.error ?? 'Could not save');
      return;
    }
    setOpen(false);
    setTitle('');
    setBody('');
    router.refresh();
  }

  const displayed: (MemoryRow & { similarity?: number })[] =
    hits !== null && hits.length > 0 ? hits : memories;

  return (
    <div className="mx-auto grid max-w-[560px] gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Memory</h1>
          <p className="text-sm text-muted">
            {memories.length} memories · semantic search over {mode === 'vector' ? 'embeddings' : 'text'}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Save a memory</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <Field label="Kind" htmlFor="m-kind">
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger id="m-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k[0]!.toUpperCase() + k.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Title" htmlFor="m-title" required>
                <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </Field>
              <Field label="Body" htmlFor="m-body" required>
                <Textarea
                  id="m-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  required
                />
              </Field>
              {formError ? <p className="text-sm text-danger">{formError}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save memory'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <form onSubmit={(e) => void search(e)} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Fuzzy search: what did I decide about internships?"
          aria-label="Search memories"
        />
        <Button type="submit" variant="outline" disabled={searching}>
          <MagnifyingGlass size={16} />
          {searching ? '…' : 'Search'}
        </Button>
      </form>

      {searchError ? <p className="text-sm text-danger">{searchError}</p> : null}
      {hits !== null && hits.length === 0 ? (
        <p className="text-sm text-muted">No memories match that query.</p>
      ) : null}

      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="No memories yet. Capture a decision or a lesson worth keeping." />
        </div>
      ) : (
        <ul className="grid gap-3">
          {displayed.map((m) => (
            <li key={m.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{m.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  {typeof m.similarity === 'number' ? (
                    <span className="font-mono text-[10px] tabular text-grove">
                      {Math.round(m.similarity * 100)}% match
                    </span>
                  ) : null}
                  <Badge variant="secondary">{m.kind}</Badge>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted">{m.body}</p>
              <div className="mt-2 flex items-center justify-between font-mono text-[11px] tabular text-muted">
                <span>{formatDate(m.created_at)}</span>
                {m.source_capture_id ? (
                  <button
                    type="button"
                    onClick={() => router.push('/inbox')}
                    className="text-grove underline-offset-4 hover:underline"
                  >
                    from capture
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
