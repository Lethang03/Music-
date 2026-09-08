-- 1. Create table
BEGIN;
CREATE TABLE IF NOT EXISTS public.soundverse_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_key TEXT NOT NULL,
    item JSONB,
    activity_type TEXT DEFAULT 'playback',
    metadata JSONB,
    position NUMERIC DEFAULT 0,
    duration NUMERIC DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    liked BOOLEAN DEFAULT false,
    listened_seconds NUMERIC DEFAULT 0,
    played_at TIMESTAMP WITH TIME ZONE,
    listening_days JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, media_key)
);

-- 2. Indexes
-- Extend the earlier completion schema without replacing its keys or records.
ALTER TABLE public.soundverse_activity ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.soundverse_activity ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'playback';
ALTER TABLE public.soundverse_activity ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.soundverse_activity ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS soundverse_activity_id ON public.soundverse_activity(id);
CREATE UNIQUE INDEX IF NOT EXISTS soundverse_activity_user_media ON public.soundverse_activity(user_id, media_key);
CREATE INDEX IF NOT EXISTS idx_soundverse_activity_user_id ON public.soundverse_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_soundverse_activity_media_key ON public.soundverse_activity(media_key);

-- 3. RLS Policies
ALTER TABLE public.soundverse_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own activity" ON public.soundverse_activity;
CREATE POLICY "Users can manage their own activity"
ON public.soundverse_activity
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS soundverse_activity_guard ON public.soundverse_activity;
CREATE POLICY soundverse_activity_guard ON public.soundverse_activity
AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soundverse_activity TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
