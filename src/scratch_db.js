(async () => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  const fetchTable = async (table) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      if (res.ok) {
        console.log(`✅ Table exists: ${table}`)
        const data = await res.json()
        if (data.length > 0) console.log(`   Columns:`, Object.keys(data[0]).join(', '))
      } else {
        console.log(`❌ Table missing or RLS blocked: ${table} (${res.status})`)
      }
    } catch (e) {
      console.log(`Error checking ${table}:`, e.message)
    }
  }

  console.group('=== DB SCHEMA CHECK ===')
  await fetchTable('profiles')
  await fetchTable('playlists')
  await fetchTable('playlist_tracks')
  await fetchTable('favorites')
  await fetchTable('history')
  await fetchTable('music_tracks')
  await fetchTable('podcasts')
  await fetchTable('episodes')
  await fetchTable('settings')
  console.groupEnd()
})()

