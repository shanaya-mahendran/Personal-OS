'use client';

/**
 * ScheduleImporter: CSV upload/paste + validation + diff preview + import.
 * Never calculates times; only stores what the user provides (spec §9).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText } from '@phosphor-icons/react';
import { parseScheduleCsv, validateSchedule, PRAYER_COLUMNS } from '@/lib/prayer/validation';
import { importSchedule, previewScheduleImport, type ImportPreview } from '@/lib/actions/prayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface ManualRow {
  date: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export function ScheduleImporter({
  existingYears,
}: {
  existingYears: { year: number; days: number }[];
}) {
  const router = useRouter();
  const [year, setYear] = React.useState(() => new Date().getFullYear());
  const [rows, setRows] = React.useState<ManualRow[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [replaceAck, setReplaceAck] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'csv' | 'manual'>('csv');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const existing = existingYears.find((y) => y.year === year);

  function handleCsvText(text: string) {
    const { rows: parsed, errors: parseErrors } = parseScheduleCsv(text);
    setErrors(parseErrors.slice(0, 20));
    setRows(parsed);
    setPreview(null);
    setDone(null);
  }

  async function readFile(file: File) {
    const text = await file.text();
    handleCsvText(text);
  }

  async function runPreview(force: boolean) {
    setBusy(true);
    setPreview(null);
    setErrors([]);
    const res = await previewScheduleImport({ year, rows, replace: force || !existing });
    setBusy(false);
    if (!res.ok) {
      setErrors([res.error ?? 'Preview failed']);
      return;
    }
    setPreview(res.data ?? null);
  }

  async function runImport() {
    setBusy(true);
    const res = await importSchedule({ year, rows, replace: true });
    setBusy(false);
    if (!res.ok) {
      setErrors([res.error ?? 'Import failed']);
      return;
    }
    setDone(`Imported ${res.data?.inserted ?? rows.length} days for ${year}`);
    setPreview(null);
    router.refresh();
  }

  const validation = rows.length > 0 ? validateSchedule(rows, year) : null;

  function addManualRow() {
    setRows((r) => [
      ...r,
      { date: '', fajr: '', dhuhr: '', asr: '', maghrib: '', isha: '' },
    ]);
  }

  function updateRow(idx: number, key: keyof ManualRow, value: string) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }

  return (
    <div className="mx-auto grid max-w-[640px] gap-4">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Prayer schedule
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Import annual schedule</h1>
        <p className="text-sm text-muted">
          Columns: <span className="font-mono text-xs">date,fajr,dhuhr,asr,maghrib,isha</span> ·
          365/366 rows · 24h HH:MM · no calculation, ever.
        </p>
      </header>

      <Field
        label="Schedule year"
        htmlFor="sched-year"
        helper={existing ? `${existing.days} days already exist for this year` : undefined}
      >
        <Input
          id="sched-year"
          type="number"
          min={2000}
          max={2100}
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
            setPreview(null);
            setReplaceAck(false);
            setDone(null);
          }}
          className="max-w-[160px]"
        />
      </Field>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === 'csv' ? 'default' : 'outline'}
          onClick={() => setTab('csv')}
        >
          <FileText size={14} /> CSV
        </Button>
        <Button
          size="sm"
          variant={tab === 'manual' ? 'default' : 'outline'}
          onClick={() => setTab('manual')}
        >
          Manual grid
        </Button>
      </div>

      {tab === 'csv' ? (
        <Card>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> Upload CSV
              </Button>
              <span className="text-xs text-muted">or paste the CSV below</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
            <textarea
              aria-label="Paste CSV"
              placeholder={'date,fajr,dhuhr,asr,maghrib,isha\n2026-01-01,05:12,12:15,15:40,18:05,19:20'}
              onChange={(e) => handleCsvText(e.target.value)}
              className="mt-3 h-28 w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-grove"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="text-muted">
                  {PRAYER_COLUMNS.map((c) => (
                    <th key={c} className="px-2 pb-2 font-medium">
                      {c}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-t border-line">
                    {PRAYER_COLUMNS.map((col) => (
                      <td key={col} className="px-1 py-1">
                        <input
                          aria-label={`row ${idx + 1} ${col}`}
                          value={row[col]}
                          onChange={(e) => updateRow(idx, col, e.target.value)}
                          placeholder={col === 'date' ? 'YYYY-MM-DD' : 'HH:MM'}
                          className="w-full rounded-lg border border-line bg-canvas px-2 py-1.5 font-mono text-xs tabular outline-none focus:ring-2 focus:ring-grove"
                        />
                      </td>
                    ))}
                    <td className="px-1">
                      <button
                        type="button"
                        aria-label={`Remove row ${idx + 1}`}
                        onClick={() => setRows((r) => r.filter((_, i) => i !== idx))}
                        className="px-2 text-muted hover:text-danger"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={addManualRow}>
            Add row
          </Button>
        </div>
      )}

      {validation ? (
        <div
          className={cn(
            'rounded-xl border px-3 py-2.5 text-sm',
            validation.ok
              ? 'border-grove/30 bg-grove-tint text-grove'
              : 'border-warning/40 bg-warning/[0.07] text-warning',
          )}
        >
          <p className="font-medium">
            {validation.ok
              ? `Valid: ${validation.rows.length} rows for ${year}`
              : `${validation.errors.length} problem${validation.errors.length === 1 ? '' : 's'} found`}
          </p>
          {validation.errors.slice(0, 5).map((e) => (
            <p key={e} className="mt-1 font-mono text-[11px]">
              {e}
            </p>
          ))}
          {validation.warnings.slice(0, 3).map((w) => (
            <p key={w} className="mt-1 font-mono text-[11px] opacity-80">
              warning: {w}
            </p>
          ))}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="rounded-xl border border-danger/40 bg-danger/[0.06] px-3 py-2.5 text-sm text-danger">
          {errors.map((e) => (
            <p key={e} className="font-mono text-[11px]">
              {e}
            </p>
          ))}
        </div>
      ) : null}

      {existing && existing.days > 0 ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={replaceAck}
            onChange={(e) => setReplaceAck(e.target.checked)}
            className="h-4 w-4 accent-[var(--grove)]"
          />
          Replace the existing {year} schedule ({existing.days} days)
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy || rows.length === 0 || Boolean(existing && !replaceAck)}
          onClick={() => void runPreview(Boolean(replaceAck))}
        >
          {busy ? 'Working…' : 'Preview changes'}
        </Button>
        <Button disabled={!preview || busy} onClick={() => void runImport()}>
          {busy ? 'Importing…' : 'Confirm import'}
        </Button>
      </div>

      {done ? <p className="text-sm text-grove">{done}</p> : null}

      {preview ? (
        <Card>
          <CardContent>
            <CardTitle>Import preview</CardTitle>
            <ul className="mt-2 grid gap-1 font-mono text-xs tabular text-ink">
              <li>added: {preview.added}</li>
              <li>updated: {preview.updated}</li>
              <li>unchanged: {preview.unchanged}</li>
            </ul>
            {preview.sample.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted">Sample differences</p>
                <ul className="grid gap-1 text-xs">
                  {preview.sample.map((s) => (
                    <li key={s.date} className="font-mono tabular">
                      {s.date}: {s.before ?? '—'} → <span className="text-grove">{s.after}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {existingYears.length > 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Imported years (archived, read-only)
          </p>
          <ul className="grid gap-1 font-mono text-xs tabular text-ink">
            {existingYears.map((y) => (
              <li key={y.year}>
                {y.year} · {y.days} days
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
