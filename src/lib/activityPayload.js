const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

// Send the same writable columns for new and cloud-loaded rows. Mixing server
// defaults (id/created_at) into bulk upserts otherwise inserts nulls for new rows.
export function activityPayload(row, userId) {
  return {
    user_id: userId, media_key: row.media_key, item: row.item,
    position: nonnegative(row.position), duration: nonnegative(row.duration),
    completed: row.completed === true, liked: row.liked === true,
    listened_seconds: nonnegative(row.listened_seconds),
    listening_days: Array.isArray(row.listening_days) ? row.listening_days : [],
    played_at: row.played_at || null, updated_at: row.updated_at
  }
}
