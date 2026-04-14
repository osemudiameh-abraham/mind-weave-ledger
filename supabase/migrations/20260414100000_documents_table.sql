-- Documents table for document intelligence pipeline
-- Architecture v5.5, Section 3.3

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  status text DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'completed', 'failed')),
  chunk_count integer DEFAULT 0,
  summary text,
  key_entities jsonb DEFAULT '[]',
  facts_extracted integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id, created_at DESC);

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_select ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY documents_insert ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY documents_update ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY documents_delete ON public.documents FOR DELETE USING (auth.uid() = user_id);
