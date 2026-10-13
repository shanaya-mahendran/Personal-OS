'use client';

/**
 * ConfirmDialog: the user-facing decision point for every AI proposal.
 * Edit → Confirm → (for events) conflict check runs server-side first.
 */
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Add to Shanaya OS',
  onConfirm,
  onEdit,
  onReject,
  busy,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onEdit?: () => void;
  onReject?: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </DialogHeader>
        <DialogFooter>
          {onReject ? (
            <Button variant="ghost" onClick={onReject} disabled={busy}>
              Discard
            </Button>
          ) : null}
          {onEdit ? (
            <Button variant="outline" onClick={onEdit} disabled={busy}>
              Edit
            </Button>
          ) : null}
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? 'Adding…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
