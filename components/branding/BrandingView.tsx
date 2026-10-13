'use client';

/**
 * Personal Branding (spec §13): sub-tabs per platform (LinkedIn / GitHub /
 * Portfolio) with manually recorded metrics, plus the content pipeline
 * Idea → Draft → Ready → Published → Archived.
 *
 * Metrics are only displayed when the user actually recorded them.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowRight } from '@phosphor-icons/react';
import type { BrandingContentRow, BrandingMetricRow, BrandingPlatform, BrandingStatus } from '@/lib/supabase/types';
import { createBrandingContent, updateBrandingStatus } from '@/lib/actions/modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, EmptyState } from '@/components/ui/field';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

const PLATFORMS: BrandingPlatform[] = ['linkedin', 'github', 'portfolio'];
const PIPELINE: BrandingStatus[] = ['idea', 'draft', 'ready', 'published', 'archived'];

export function BrandingView({
  content,
  metrics,
}: {
  content: BrandingContentRow[];
  metrics: BrandingMetricRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [platform, setPlatform] = React.useState<BrandingPlatform>('linkedin');
  const [title, setTitle] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createBrandingContent({
      platform,
      title: title.trim(),
      status: 'idea',
      url: '',
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save');
      return;
    }
    setOpen(false);
    setTitle('');
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Personal branding</h1>
          <p className="text-sm text-muted">
            {content.filter((c) => c.status !== 'archived').length} items in flight
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> New content
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New content item</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void submit(e)} className="grid gap-3">
              <Field label="Platform" htmlFor="b-platform">
                <Select value={platform} onValueChange={(v) => setPlatform(v as BrandingPlatform)}>
                  <SelectTrigger id="b-platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="portfolio">Portfolio</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Title" htmlFor="b-title" required>
                <Input
                  id="b-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Post idea"
                />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Create'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Tabs defaultValue="linkedin">
        <TabsList>
          {PLATFORMS.map((p) => (
            <TabsTrigger key={p} value={p}>
              {p === 'github' ? 'GitHub' : p[0]!.toUpperCase() + p.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        {PLATFORMS.map((p) => {
          const items = content.filter((c) => c.platform === p);
          const latest = metrics.find((m) => m.platform === p);
          return (
            <TabsContent key={p} value={p}>
              <section className="rounded-2xl border border-line bg-surface p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Recorded metrics
                </p>
                {latest ? (
                  <>
                    <p className="font-mono text-[11px] tabular text-muted">
                      captured {formatDate(latest.metric_date)}
                    </p>
                    <ul className="mt-1 grid gap-1 font-mono text-sm tabular text-ink">
                      {Object.entries(
                        (latest.data ?? {}) as Record<string, string | number>,
                      ).map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span className="text-muted">{k}</span>
                          <span>{String(v)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    No metrics recorded for {p}. Numbers appear only when you log them.
                  </p>
                )}
              </section>

              <div className="mt-3 grid gap-3">
                {PIPELINE.map((stage) => {
                  const stageItems = items.filter((c) => c.status === stage);
                  if (stageItems.length === 0 && stage === 'archived') return null;
                  return (
                    <section key={stage} className="rounded-2xl border border-line bg-surface p-3">
                      <p className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                        {stage}
                        <span className="font-mono tabular">{stageItems.length}</span>
                      </p>
                      {stageItems.length === 0 ? (
                        <p className="py-2 text-center text-[11px] text-muted">Empty</p>
                      ) : (
                        <ul className="hairline-divide">
                          {stageItems.map((c) => {
                            const idx = PIPELINE.indexOf(c.status);
                            const next = PIPELINE[idx + 1];
                            const prev = idx > 0 ? PIPELINE[idx - 1] : null;
                            return (
                              <li key={c.id} className="flex items-center gap-2 py-2">
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                  {c.title}
                                  {c.url ? (
                                    <a
                                      href={c.url}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="ml-2 text-[11px] text-grove"
                                    >
                                      link
                                    </a>
                                  ) : null}
                                </span>
                                {prev ? (
                                  <button
                                    type="button"
                                    aria-label={`Move back to ${prev}`}
                                    onClick={async () => {
                                      await updateBrandingStatus(c.id, prev);
                                      router.refresh();
                                    }}
                                    className="rounded-full p-1.5 text-muted hover:bg-black/[0.05] hover:text-ink"
                                  >
                                    <ArrowRight size={13} className="rotate-180" />
                                  </button>
                                ) : null}
                                {next ? (
                                  <button
                                    type="button"
                                    aria-label={`Move to ${next}`}
                                    onClick={async () => {
                                      await updateBrandingStatus(c.id, next);
                                      router.refresh();
                                    }}
                                    className={cn('rounded-full p-1.5 text-grove hover:bg-grove-tint')}
                                  >
                                    <ArrowRight size={13} />
                                  </button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {content.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState message="No content yet. Ideas count. Start one." />
        </div>
      ) : null}
    </div>
  );
}
