'use client';

/**
 * Assistant chat (spec §15).
 *
 * Flow: user message → /ai-assistant Edge Function (Gemini + tools) →
 * either a plain reply or a PROPOSAL. Mutating proposals render as editable
 * preview cards; Confirm calls the server action that re-validates and
 * executes (with conflict detection). The AI never writes directly.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkle, PaperPlaneTilt, Check } from '@phosphor-icons/react';
import {
  confirmProposal,
  persistChatMessage,
  sendAssistantMessage,
  type AssistantProposal,
} from '@/lib/actions/assistant';
import type { OverlappingEvent } from '@/lib/calendar/conflicts';
import { ConflictDialog } from '@/components/calendar/ConflictDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: AssistantProposal;
  local?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  create_task: 'Create a task',
  update_task: 'Update a task',
  create_event: 'Create an event',
  update_event: 'Update an event',
  create_project: 'Create a project',
  create_note: 'Save a note',
  create_memory: 'Save a memory',
  create_reminder: 'Set a reminder',
};

const SUGGESTIONS = [
  { label: 'What do I have today?', message: 'What do I have today?' },
  { label: 'What is on my schedule this week?', message: 'What is on my schedule this week?' },
  { label: 'Add a task from what I just said', message: 'Add a task for me based on what I just told you.' },
  { label: 'Create an event for me', message: 'Create an event for me.' },
  { label: 'Create a project', message: 'Create a project for me.' },
  { label: 'Remind me about something', message: 'Remind me about something later.' },
];

export function AssistantChat({ initialMessages }: { initialMessages: AssistantMessage[] }) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<AssistantMessage[]>(initialMessages);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [argText, setArgText] = React.useState('');
  const [conflict, setConflict] = React.useState<OverlappingEvent[] | null>(null);
  const [pendingProposal, setPendingProposal] = React.useState<AssistantProposal | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const history = React.useMemo(
    () =>
      messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages],
  );

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    setInput('');

    const localUser = `u-${Date.now()}`;
    setMessages((m) => [...m, { id: localUser, role: 'user', content: text, local: true }]);
    void persistChatMessage('user', text);

    const res = await sendAssistantMessage(text, history);
    setBusy(false);

    if (!res.ok) {
      setError(res.error ?? 'The assistant is unavailable right now');
      return;
    }

    const outcome = res.data;
    if (!outcome) return;

    const reply: AssistantMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: outcome.reply || (outcome.proposal ? '' : 'I could not produce a reply.'),
      proposal: outcome.proposal,
      local: true,
    };
    setMessages((m) => [...m, reply]);
    void persistChatMessage(
      'assistant',
      reply.content || `[proposal: ${outcome.proposal?.name ?? 'unknown'}]`,
      outcome.proposal ?? null,
    );
  }

  async function confirm(proposal: AssistantProposal, message: string) {
    setBusy(true);
    setError(null);
    const res = await confirmProposal(proposal);
    setBusy(false);

    if (!res.ok) {
      setError(res.error ?? 'Could not run that action');
      return;
    }
    if (res.data?.status === 'conflict') {
      setPendingProposal(proposal);
      setConflict(res.data.overlapping);
      return;
    }

    setMessages((m) => [
      ...m,
      {
        id: `x-${Date.now()}`,
        role: 'assistant',
        content: `Done: ${TOOL_LABELS[proposal.name] ?? proposal.name}.`,
        local: true,
      },
    ]);
    void persistChatMessage('assistant', `Done: ${TOOL_LABELS[proposal.name] ?? proposal.name}.`);
    void message;
    router.refresh();
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-180px)] max-w-[560px] flex-col gap-3">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Assistant</h1>
        <p className="text-sm text-muted">
          Proposes, never writes. You confirm every change.
        </p>
      </header>

      <div className="grid gap-1.5">
        {SUGGESTIONS.slice(0, 3).map((s) => (
          <button
            key={s.message}
            type="button"
            onClick={() => {
              setInput(s.message);
            }}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm text-ink hover:bg-black/[0.03] focus:border-grove focus:outline-none focus:ring-2 focus:ring-grove"
          >
            <span className="text-grove">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
            Ask anything: “What&apos;s happening tomorrow?” or “Remind me to submit the report on
            Friday at 4pm”.
          </div>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                m.role === 'user'
                  ? 'bg-grove text-white dark:text-black'
                  : 'border border-line bg-surface text-ink',
              )}
            >
              {m.content ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : m.proposal ? (
                <p className="flex items-center gap-1.5 text-muted">
                  <Sparkle size={13} /> Proposed an action
                </p>
              ) : null}

              {m.proposal ? (
                <ProposalCard
                  proposal={m.proposal}
                  busy={busy}
                  editing={editing === m.id}
                  onEdit={() => {
                    setEditing(m.id);
                    setArgText(JSON.stringify(m.proposal?.args ?? {}, null, 2));
                  }}
                  onArgChange={setArgText}
                  argText={argText}
                  onConfirm={(p) => void confirm(p, m.content)}
                />
              ) : null}
            </div>
          </div>
        ))}

        {busy ? (
          <div className="flex justify-start">
            <div className="w-40 space-y-2 rounded-2xl border border-line bg-surface p-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form onSubmit={(e) => void send(e)} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask or instruct…"
          aria-label="Message the assistant"
          className="min-h-[48px] max-h-32 resize-none"
        />
        <Button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          <PaperPlaneTilt size={16} />
        </Button>
      </form>

      <ConflictDialog
        open={conflict !== null}
        overlapping={conflict ?? []}
        onKeepBoth={() => {
          const proposal = pendingProposal;
          setConflict(null);
          setPendingProposal(null);
          if (proposal) {
            void confirm(
              { ...proposal, args: { ...proposal.args, force: true } },
              '',
            );
          }
        }}
        onEditTimes={() => {
          setConflict(null);
          setPendingProposal(null);
        }}
        onCancel={() => {
          setConflict(null);
          setPendingProposal(null);
        }}
      />
    </div>
  );
}

function ProposalCard({
  proposal,
  busy,
  editing,
  argText,
  onEdit,
  onArgChange,
  onConfirm,
}: {
  proposal: AssistantProposal;
  busy: boolean;
  editing: boolean;
  argText: string;
  onEdit: () => void;
  onArgChange: (v: string) => void;
  onConfirm: (p: AssistantProposal) => void;
}) {
  const [localError, setLocalError] = React.useState<string | null>(null);

  function parseArgs(): AssistantProposal | null {
    try {
      const parsed = JSON.parse(argText) as Record<string, unknown>;
      setLocalError(null);
      return { name: proposal.name, args: parsed };
    } catch {
      setLocalError('Invalid JSON');
      return null;
    }
  }

  const entries = Object.entries(proposal.args);

  return (
    <div className="mt-2 rounded-xl border border-line bg-canvas p-3">
      <p className="text-xs font-semibold text-ink">
        {TOOL_LABELS[proposal.name] ?? proposal.name}
      </p>

      {!editing ? (
        <ul className="mt-1.5 grid gap-1 font-mono text-[11px] tabular text-muted">
          {entries.map(([k, v]) => (
            <li key={k} className="truncate">
              <span className="text-ink">{k}</span>: {JSON.stringify(v)}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <Textarea
            value={argText}
            onChange={(e) => onArgChange(e.target.value)}
            aria-label="Edit proposed arguments"
            className="mt-2 min-h-[120px] font-mono text-[11px]"
          />
          {localError ? <p className="mt-1 text-[11px] text-danger">{localError}</p> : null}
        </>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            if (editing) {
              const next = parseArgs();
              if (next) onConfirm(next);
            } else {
              onConfirm(proposal);
            }
          }}
        >
          <Check size={14} /> Confirm
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          {editing ? 'Done editing' : 'Edit'}
        </Button>
      </div>
    </div>
  );
}
