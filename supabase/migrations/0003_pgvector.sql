-- ============================================================================
-- 0003_pgvector.sql — semantic memory search
-- Gemini text-embedding-004 produces 768-dim vectors.
-- ============================================================================

create extension if not exists vector;

alter table public.memory_embeddings
  alter column embedding type vector(768);

create index if not exists memory_embeddings_embedding_idx
  on public.memory_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Helper used by Edge Functions / server: text -> embedding handled client-side
-- (Gemini), this function ranks an already-computed embedding.
create or replace function public.match_memories(
  query_embedding vector(768),
  match_count int default 10,
  query_text text default null
)
returns table (
  id uuid,
  kind memory_kind,
  title text,
  body text,
  source_capture_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.kind,
    m.title,
    m.body,
    m.source_capture_id,
    m.created_at,
    1 - (me.embedding <=> query_embedding) as similarity
  from public.memory_embeddings me
  join public.memories m on m.id = me.memory_id
  where m.user_id = auth.uid()
    and me.embedding is not null
  order by me.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- Convenience: text search variant used by the assistant when no embedding is
-- available (keeps search_memory functional without a network round trip).
create or replace function public.search_memories_text(
  query_text text,
  match_count int default 10
)
returns table (
  id uuid,
  kind memory_kind,
  title text,
  body text,
  source_capture_id uuid,
  created_at timestamptz,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.kind,
    m.title,
    m.body,
    m.source_capture_id,
    m.created_at,
    case
      when m.title @@ plainto_tsquery('english', query_text)
        or m.body @@ plainto_tsquery('english', query_text) then 1.0
      else 0.0
    end as similarity
  from public.memories m
  where m.user_id = auth.uid()
    and (
      m.title @@ plainto_tsquery('english', query_text)
      or m.body @@ plainto_tsquery('english', query_text)
      or m.title ilike '%' || query_text || '%'
      or m.body ilike '%' || query_text || '%'
    )
  order by similarity desc, m.created_at desc
  limit greatest(match_count, 1);
$$;
