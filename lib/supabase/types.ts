/**
 * Hand-maintained database types (mirrors `supabase gen types typescript`).
 * Regenerate via `npm run db:types` when migrations change.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<TRow extends { user_id: string }> = {
  Row: TRow;
  /** Insert payloads: every column optional except the ownership key. */
  Insert: Partial<TRow> & Pick<TRow, 'user_id'>;
  Update: Partial<TRow>;
  Relationships: [];
};

type TableNoUser<TRow> = {
  Row: TRow;
  Insert: Partial<TRow>;
  Update: Partial<TRow>;
  Relationships: [];
};

// ── Enums ────────────────────────────────────────────────────────────────────
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EventStatus = 'scheduled' | 'cancelled' | 'completed';
export type CaptureInputType = 'text' | 'image' | 'voice' | 'document' | 'paste';
export type CaptureStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'rejected'
  | 'failed';
export type MemoryKind = 'decision' | 'lesson' | 'preference' | 'fact' | 'experience';
export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type CareerType = 'internship' | 'full_time' | 'part_time' | 'contract';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type CareerStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'technical'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type KarateFocus =
  | 'kata'
  | 'kumite'
  | 'conditioning'
  | 'technique'
  | 'grading'
  | 'competition';
export type EntertainmentCategory =
  | 'movie'
  | 'tv'
  | 'anime'
  | 'game'
  | 'music'
  | 'youtube'
  | 'book'
  | 'social';
export type MusicMood =
  | 'focus'
  | 'calm'
  | 'energetic'
  | 'happy'
  | 'sad'
  | 'social'
  | 'travel'
  | 'custom';
export type IdeaStatus = 'seed' | 'exploring' | 'parked' | 'promoted';
export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';
export type AuditSource = 'user' | 'ai' | 'system';
export type ChatRole = 'user' | 'assistant';
export type BrandingPlatform = 'linkedin' | 'github' | 'portfolio';
export type BrandingStatus = 'idea' | 'draft' | 'ready' | 'published' | 'archived';
export type FamilyKind = 'gathering' | 'visit' | 'task' | 'celebration' | 'other';

// ── Rows ─────────────────────────────────────────────────────────────────────
export type ProfileRow = {
  id: string;
  display_name: string | null;
  timezone: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type SettingsRow = {
  user_id: string;
  notification_prefs: Json;
  dashboard_prefs: Json;
  context_engine_enabled: boolean;
  location_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export type AreaRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ProjectRow = {
  id: string;
  user_id: string;
  area_id: string | null;
  title: string;
  description: string | null;
  goal: string | null;
  status: ProjectStatus;
  deadline_at: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  area_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  recurrence_rule: string | null;
  reminder_at: string | null;
  source_capture_id: string | null;
  created_at: string;
  updated_at: string;
}

export type EventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  location: string | null;
  organizer: string | null;
  source_id: string | null;
  status: EventStatus;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
}

export type EventSourceRow = {
  id: string;
  user_id: string;
  capture_id: string | null;
  type: string;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export type CaptureRow = {
  id: string;
  user_id: string;
  input_type: CaptureInputType;
  raw_text: string | null;
  storage_path: string | null;
  processing_status: CaptureStatus;
  ai_result: Json;
  confidence: Json;
  created_entity_type: string | null;
  created_entity_id: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export type AttachmentRow = {
  id: string;
  user_id: string;
  capture_id: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  area_id: string | null;
  project_id: string | null;
  tags: string[] | null;
  source_capture_id: string | null;
  created_at: string;
  updated_at: string;
}

export type IdeaRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  status: IdeaStatus;
  area_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MemoryRow = {
  id: string;
  user_id: string;
  kind: MemoryKind;
  title: string;
  body: string;
  source_capture_id: string | null;
  created_at: string;
  updated_at: string;
}

export type MemoryEmbeddingRow = {
  id: string;
  memory_id: string;
  embedding: number[] | string;
  created_at: string;
}

export type PrayerScheduleRow = {
  id: string;
  user_id: string;
  date: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  schedule_year: number;
  created_at: string;
  updated_at: string;
}

export type PrayerLogRow = {
  id: string;
  user_id: string;
  date: string;
  prayer: PrayerName;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CareerOpportunityRow = {
  id: string;
  user_id: string;
  company: string;
  role: string;
  type: CareerType | null;
  location: string | null;
  work_mode: WorkMode | null;
  salary: string | null;
  hours: string | null;
  requirements: string[] | null;
  url: string | null;
  contact: string | null;
  status: CareerStatus;
  deadline_at: string | null;
  notes: string | null;
  source_capture_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CareerApplicationRow = {
  id: string;
  user_id: string;
  opportunity_id: string;
  applied_at: string;
  resume_path: string | null;
  created_at: string;
  updated_at: string;
}

export type InterviewRow = {
  id: string;
  user_id: string;
  opportunity_id: string;
  scheduled_at: string;
  round: string | null;
  notes: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

export type VolunteeringRow = {
  id: string;
  user_id: string;
  organization: string;
  opportunity: string;
  role: string | null;
  date: string | null;
  hours: number | null;
  description: string | null;
  certificate_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type VolunteeringEventRow = {
  id: string;
  user_id: string;
  volunteering_id: string;
  event_date: string;
  hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  cadence: string;
  target: number | null;
  area_id: string | null;
  created_at: string;
  updated_at: string;
}

export type HabitLogRow = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  value: number | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export type MealRow = {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  description: string | null;
  home_cooked: boolean;
  skipped: boolean;
  created_at: string;
  updated_at: string;
}

export type WaterLogRow = {
  id: string;
  user_id: string;
  date: string;
  glasses: number;
  created_at: string;
  updated_at: string;
}

export type KarateSessionRow = {
  id: string;
  user_id: string;
  date: string;
  duration_min: number;
  focus: KarateFocus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type KarateGoalRow = {
  id: string;
  user_id: string;
  title: string;
  target_date: string | null;
  progress: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type EntertainmentLogRow = {
  id: string;
  user_id: string;
  date: string;
  category: EntertainmentCategory;
  title: string;
  duration_min: number;
  created_at: string;
  updated_at: string;
}

export type MusicSessionRow = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  track: string | null;
  artist: string | null;
  mood: MusicMood;
  created_at: string;
  updated_at: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  scheduled_at: string;
  sent_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
  updated_at: string;
}

export type AuditLogRow = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  source: AuditSource;
  ai_run_id: string | null;
  payload: Json;
  created_at: string;
  updated_at: string;
}

export type AiRunRow = {
  id: string;
  user_id: string;
  function_name: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  status: 'ok' | 'error';
  error: string | null;
  created_at: string;
}

export type ChatMessageRow = {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  tool_proposal: Json;
  created_at: string;
}

export type KnownPlaceRow = {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  context_hint: string | null;
  created_at: string;
  updated_at: string;
}

export type BrandingContentRow = {
  id: string;
  user_id: string;
  platform: BrandingPlatform;
  title: string;
  status: BrandingStatus;
  url: string | null;
  notes: string | null;
  published_at: string | null;
  source_capture_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandingMetricRow = {
  id: string;
  user_id: string;
  platform: BrandingPlatform;
  metric_date: string;
  data: Json;
  created_at: string;
  updated_at: string;
};

export type FamilyEventRow = {
  id: string;
  user_id: string;
  title: string;
  kind: FamilyKind;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ── Database ─────────────────────────────────────────────────────────────────
export type Database = {
  public: {
    Tables: {
      profiles: TableNoUser<ProfileRow> & {
        Insert: Partial<ProfileRow> & { id: string };
      };
      settings: TableNoUser<SettingsRow> & {
        Insert: Partial<SettingsRow> & { user_id: string };
      };
      areas: Table<AreaRow>;
      projects: Table<ProjectRow>;
      tasks: Table<TaskRow>;
      events: Table<EventRow>;
      event_sources: Table<EventSourceRow>;
      captures: Table<CaptureRow>;
      attachments: Table<AttachmentRow>;
      notes: Table<NoteRow>;
      ideas: Table<IdeaRow>;
      memories: Table<MemoryRow>;
      memory_embeddings: TableNoUser<MemoryEmbeddingRow>;
      prayer_schedules: Table<PrayerScheduleRow>;
      prayer_logs: Table<PrayerLogRow>;
      career_opportunities: Table<CareerOpportunityRow>;
      career_applications: Table<CareerApplicationRow>;
      interviews: Table<InterviewRow>;
      volunteering: Table<VolunteeringRow>;
      volunteering_events: Table<VolunteeringEventRow>;
      habits: Table<HabitRow>;
      habit_logs: Table<HabitLogRow>;
      meals: Table<MealRow>;
      water_logs: Table<WaterLogRow>;
      karate_sessions: Table<KarateSessionRow>;
      karate_goals: Table<KarateGoalRow>;
      entertainment_logs: Table<EntertainmentLogRow>;
      music_sessions: Table<MusicSessionRow>;
      notifications: Table<NotificationRow>;
      audit_logs: Table<AuditLogRow>;
      ai_runs: TableNoUser<AiRunRow> & {
        Insert: Partial<AiRunRow> & { user_id: string };
      };
      chat_messages: Table<ChatMessageRow>;
      known_places: Table<KnownPlaceRow>;
      branding_content: Table<BrandingContentRow>;
      branding_metrics: Table<BrandingMetricRow>;
      family_events: Table<FamilyEventRow>;
    };
    Views: Record<string, never>;
    Functions: {
      match_memories: {
        Args: { query_embedding: number[]; match_count?: number; query_text?: string };
        Returns: {
          id: string;
          kind: MemoryKind;
          title: string;
          body: string;
          source_capture_id: string | null;
          created_at: string;
          similarity: number;
        }[];
      };
      search_memories_text: {
        Args: { query_text: string; match_count?: number };
        Returns: {
          id: string;
          kind: MemoryKind;
          title: string;
          body: string;
          source_capture_id: string | null;
          created_at: string;
          similarity: number;
        }[];
      };
    };
    Enums: {
      task_status: TaskStatus;
      task_priority: TaskPriority;
      event_status: EventStatus;
      capture_input_type: CaptureInputType;
      capture_status: CaptureStatus;
      memory_kind: MemoryKind;
      prayer_name: PrayerName;
      career_status: CareerStatus;
      career_type: CareerType;
      work_mode: WorkMode;
      meal_type: MealType;
      karate_focus: KarateFocus;
      entertainment_category: EntertainmentCategory;
      music_mood: MusicMood;
      idea_status: IdeaStatus;
      audit_source: AuditSource;
    };
    CompositeTypes: Record<string, never>;
  };
}
