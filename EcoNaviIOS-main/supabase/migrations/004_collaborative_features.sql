-- EcoNavi: Collaborative Collections and Profiles
-- Run after 002_saved_places_collections.sql

-- =============================================================================
-- 1. USER PROFILES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (true); -- Publicly viewable to find collaborators

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (new.id, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'avatar_url');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. COLLECTION UPDATES (Visibility & Sharing)
-- =============================================================================
-- Add visibility and share_code to collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE;

-- Index for lookup via share_code
CREATE INDEX IF NOT EXISTS idx_collections_share_code ON public.collections(share_code);

-- =============================================================================
-- 3. COLLECTION MEMBERS (Collaboration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.collection_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer', -- viewer, contributor, owner
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(collection_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_members_user_id ON public.collection_members(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_members_collection_id ON public.collection_members(collection_id);

ALTER TABLE public.collection_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own memberships
CREATE POLICY "members_select_own" ON public.collection_members
    FOR SELECT USING (auth.uid() = user_id);

-- Owners can manage members
CREATE POLICY "members_manage_as_owner" ON public.collection_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.collections
            WHERE collections.id = collection_id AND collections.user_id = auth.uid()
        )
    );

-- =============================================================================
-- 4. REFINED RLS POLICIES FOR COLLECTIONS & PLACES
-- =============================================================================

-- Drop old strict policies to replace them
DROP POLICY IF EXISTS "collections_select_own" ON public.collections;

-- New select policy: owner OR member OR public
CREATE POLICY "collections_select_accessible" ON public.collections
    FOR SELECT USING (
        auth.uid() = user_id OR 
        visibility = 'public' OR
        EXISTS (
            SELECT 1 FROM public.collection_members
            WHERE collection_id = public.collections.id AND user_id = auth.uid()
        )
    );

-- Saved Places are visible if you can see the collection they belong to
DROP POLICY IF EXISTS "saved_places_select_own" ON public.saved_places;

CREATE POLICY "saved_places_select_accessible" ON public.saved_places
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM public.collections
            WHERE collections.id = saved_places.collection_id AND (
                collections.visibility = 'public' OR
                EXISTS (
                    SELECT 1 FROM public.collection_members
                    WHERE collection_members.collection_id = collections.id AND collection_members.user_id = auth.uid()
                )
            )
        )
    );
