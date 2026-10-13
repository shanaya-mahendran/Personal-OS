'use client';

/**
 * ConflictDialog (spec §10): warns with both events' mono time ranges.
 * Actions: "Keep both" / "Edit new" / "Cancel".
 * The system never silently moves or deletes existing commitments.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Warning } from '@phosphor-icons/react';
import type { OverlappingEvent } from '@/lib/calendar/conflicts';
import { formatTime } from '@/lib/utils/dates';

export function ConflictDialog({
  open,
  overlapping,
  onKeepBoth,
  onEditTimes,
  onCancel,
}: {
  open: boolean;
  overlapping: OverlappingEvent[];
  onKeepBoth: () => void;
  onEditTimes: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warning size={18} weight="fill" className="text-warning" />
            Time conflict
          </DialogTitle>
          <DialogDescription>
            {overlapping.length === 1
              ? 'This overlaps with an existing commitment. Nothing was changed.'
              : `This overlaps with ${overlapping.length} existing commitments. Nothing was changed.`}
          </DialogDescription>
        </DialogHeader>

        <div className="hairline-divide rounded-xl border border-line bg-surface">
          {overlapping.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="truncate text-ink">{e.title}</span>
              <span className="font-mono text-xs tabular text-muted">
                {formatTime(e.start_at)}–{formatTime(e.end_at)}
              </span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onEditTimes}>
            Edit new
          </Button>
          <Button onClick={onKeepBoth}>Keep both</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
