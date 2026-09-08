import fs from 'node:fs'
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')))
edit('src/contexts/LibraryContext.jsx',s=>s.replace("    const query = id ? supabase.from('playlists').update(fields).eq('id', id).eq('user_id', userId) : supabase.from('playlists').insert({ ...fields, user_id: userId })", `    const existing = catalog.playlists.find(p => p.id === id)
    let query
    if (id) {
      const versioned = Number.isInteger(existing?.revision)
      query = supabase.from('playlists').update({ ...fields, ...(versioned ? { revision: existing.revision + 1 } : {}) }).eq('id', id).eq('user_id', userId)
      if (versioned) query = query.eq('revision', existing.revision)
    } else query = supabase.from('playlists').insert({ ...fields, user_id: userId })`).replace('    if (error) throw error\n    if (currentUser.current === userId) setCatalog(c => ({ ...c, playlists: id', "    if (error) throw new Error(error.code === 'PGRST116' ? 'This playlist changed elsewhere. Refresh before saving again.' : error.message)\n    if (!data?.id) throw new Error('This playlist changed elsewhere. Refresh before saving again.')\n    if (currentUser.current === userId) setCatalog(c => ({ ...c, playlists: id"))
edit('supabase/migrations/20260907_soundverse_completion.sql',s=>s.replace("alter table public.playlists add column if not exists description", "alter table public.playlists add column if not exists revision integer not null default 0;\nalter table public.playlists add column if not exists description"))
edit('tests/fixtures.js',s=>s.replace("created_at: new Date().toISOString(), track_ids: []", "...(table === 'playlists' ? { created_at: new Date().toISOString(), track_ids: [], revision: 0 } : {})"))
edit('.eslintrc.cjs',s=>s.replace("'test-results']", "'test-results', 'audit/tmp']"))
