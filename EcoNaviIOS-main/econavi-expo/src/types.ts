/**
 * Core data models for EcoNavi (Supabase-backed)
 */

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

export type CollectionVisibility = 'private' | 'public' | 'shared';

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  visibility: CollectionVisibility;
  share_code: string | null;
}

export interface CollectionMember {
  id: string;
  collection_id: string;
  user_id: string;
  role: 'viewer' | 'contributor' | 'owner';
  created_at: string;
}

export interface SavedPlace {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string;
  collection_id: string | null;
}

// Payloads for inserts
export interface CollectionInsert {
  user_id: string;
  name: string;
  visibility?: CollectionVisibility;
  share_code?: string;
}

export interface CollectionMemberInsert {
  collection_id: string;
  user_id: string;
  role: 'viewer' | 'contributor' | 'owner';
}
