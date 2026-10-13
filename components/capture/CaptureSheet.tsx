'use client';

/**
 * CaptureSheet: the universal capture entry (spec §6).
 * Supports text typing, clipboard paste (text or image), and camera/file
 * upload. Submitting creates a `captures` row, uploads any file to Storage
 * under the user's folder, and starts AI processing.
 *
 * UX: optimistic "Processing…" state → CapturePreview card when the row
 * reaches awaiting_confirmation.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Image as ImageIcon, PaperPlaneTilt, X } from '@phosphor-icons/react';
import { createClient } from '@/lib/supabase/client';
import { submitCapture } from '@/lib/actions/capture';
import { useCaptureStore } from '@/lib/stores/app-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CapturePreview } from '@/components/capture/CapturePreview';
import { cn } from '@/lib/utils/cn';

export function CaptureSheet({
  mode,
  onClose,
}: {
  mode: 'text' | 'image' | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastCaptureId, setLastCaptureId] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const addPending = useCaptureStore((s) => s.addPending);

  const open = mode !== null || lastCaptureId !== null;

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Clipboard paste: auto-detect images (spec §6).
  React.useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            setFile(new File([blob], `paste-${Date.now()}.png`, { type: blob.type }));
            setPreviewUrl(URL.createObjectURL(blob));
            setText((t) => t || '');
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open]);

  function pickFile(asCamera: boolean) {
    const input = fileRef.current;
    if (!input) return;
    if (asCamera) input.setAttribute('capture', 'environment');
    else input.removeAttribute('capture');
    input.click();
  }

  async function submit() {
    if (!text.trim() && !file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      let storagePath: string | undefined;

      if (file) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');
        const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
        storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('captures')
          .upload(storagePath, file, { upsert: false, contentType: file.type });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      }

      const res = await submitCapture({
        raw_text: text.trim() || undefined,
        storage_path: storagePath,
        input_type: file ? 'image' : text.trim() ? 'text' : 'text',
      });
      if (!res.ok || !res.data) throw new Error(res.error ?? 'Could not save capture');

      addPending(res.data.id);
      setLastCaptureId(res.data.id);
      setText('');
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save capture');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-t-2xl border-t border-line bg-surface p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Capture</p>
          <button
            type="button"
            aria-label="Close capture"
            onClick={() => {
              setLastCaptureId(null);
              onClose();
            }}
            className="rounded-full p-1.5 text-muted hover:bg-black/[0.05]"
          >
            <X size={16} />
          </button>
        </div>

        {lastCaptureId ? (
          <CapturePreview
            captureId={lastCaptureId}
            onDone={() => {
              setLastCaptureId(null);
              onClose();
              router.refresh();
            }}
          />
        ) : (
          <>
            <div className="relative">
              <Textarea
                autoFocus={mode === 'text'}
                placeholder="What's on your mind?"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[120px] resize-none pr-12"
              />
              <button
                type="button"
                aria-label="Attach image"
                onClick={() => pickFile(false)}
                className="absolute bottom-3 right-3 rounded-full p-2 text-muted hover:bg-black/[0.05] hover:text-ink"
              >
                <ImageIcon size={18} />
              </button>
            </div>

            {mode === 'image' ? (
              <div className="mt-3 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => pickFile(true)}>
                  <Camera size={15} /> Take photo
                </Button>
                <Button variant="outline" size="sm" onClick={() => pickFile(false)}>
                  <ImageIcon size={15} /> Choose file
                </Button>
              </div>
            ) : null}

            {previewUrl ? (
              <div className="relative mt-3 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Attachment preview" className="max-h-48 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  aria-label="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}

            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

            <Button
              className={cn('mt-4 w-full')}
              onClick={() => void submit()}
              disabled={busy || (!text.trim() && !file)}
            >
              <PaperPlaneTilt size={16} />
              {busy ? 'Saving…' : 'Capture'}
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  setPreviewUrl(URL.createObjectURL(f));
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
