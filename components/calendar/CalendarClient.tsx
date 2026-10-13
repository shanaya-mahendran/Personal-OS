'use client';

/**
 * Calendar page client shell: Month/Week tabs + new-event dialog.
 */
import * as React from 'react';
import { Plus } from '@phosphor-icons/react';
import type { EventRow } from '@/lib/supabase/types';
import { MonthView, type CalendarEntry } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { EventForm } from '@/components/calendar/EventForm';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function CalendarClient({
  events,
  timezone,
}: {
  events: EventRow[];
  timezone: string;
}) {
  const [open, setOpen] = React.useState(false);
  const entries = events as CalendarEntry[];

  return (
    <div className="grid gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted">{events.length} upcoming events</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={15} /> New event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New event</DialogTitle>
            </DialogHeader>
            <EventForm />
          </DialogContent>
        </Dialog>
      </header>

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>
        <TabsContent value="month">
          <MonthView events={entries} timezone={timezone} />
        </TabsContent>
        <TabsContent value="week">
          <WeekView events={entries} timezone={timezone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
