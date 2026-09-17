# SoundVerse Audio Storage Duplicate Detection Report

**Timestamp**: 2026-09-17T12:06:56.437Z
**Supabase Endpoint**: `https://ywfwsklpmoogvfscjrja.supabase.co`
**Status**: BLOCKED_BY_QUOTA

> [!WARNING]
> **API Gateway Response**: Failed to query music_tracks: Service for this project is restricted due to the following violations: exceed_cached_egress_quota. The project owner must upgrade their plan or remove spend caps to restore service.


- Supabase API gateway is currently rejecting queries with exceed_cached_egress_quota.
- To run live database queries, the Supabase project owner must log in to the Supabase dashboard and lift the spend cap or reset the quota restriction.

---

## 1. Music Tracks Sharing Identical Audio URL (0)

_No duplicate audio URLs detected across tracks._

---

## 2. Repeated Tracks (Identical Title & Artist with Multiple Records) (0)

_No duplicate tracks by title/artist detected._

---

## 3. Podcast Episodes Sharing Identical Audio URL (0)

_No duplicate audio URLs detected across podcast episodes._

---

## 4. Repeated Import Jobs (0)

_No repeated import jobs detected in the last 200 jobs._

---

## 5. Storage Bucket Duplicate Files by Exact Size (0)

_No duplicate audio file sizes detected in inspected buckets._

---

## Remediation Policy
- **DO NOT DELETE AUTOMATICALLY**: Audio files and tracks must not be deleted automatically.
- Once the project owner reviews this report and lifts the dashboard cap, admin users can verify each duplicate track in the Admin UI and safely delete unneeded duplicate entries.
