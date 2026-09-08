import fs from 'node:fs'
const edit = (path, fn) => fs.writeFileSync(path, fn(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '')))
edit('src/App.jsx', s => {
 s=s.replace("import React from 'react'", "import React, { lazy, Suspense } from 'react'").replace('import { LibraryProvider }', 'import { LibraryProvider, useLibrary }')
 for (const name of ['HomePage','MusicLibrary','PodcastBrowse','PodcastDetail','Profile','SearchPage','LibraryPage','AdminPage','SettingsPage']) s=s.replace(new RegExp(`import ${name} from '([^']+)'`),(_,path)=>`const ${name} = lazy(() => import('${path}'))`)
 s=s.replace('function AppRoutes() {', `function AdminRoute() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminPage /> : <div role="alert">You do not have access to administration.</div>
}
function AudioBridge({ children }) {
  const { session } = useAuth()
  const { recordProgress, getResumeTime } = useLibrary()
  return <AudioProvider storageKey={\`soundverse_player:\${session.user.id}\`} onProgress={recordProgress} getResumeTime={getResumeTime}>{children}</AudioProvider>
}
function AppRoutes() {`)
 s=s.replace('element={<AdminPage />}', 'element={<AdminRoute />}').replace('const { session, loading } = useAuth()', 'const { session, loading, error } = useAuth()')
 s=s.replace('<LandingPage onShowAuth={() => setShowAuth(true)} />', '{error && <div className="v2-status-banner" role="alert">{error}</div>}\n        <LandingPage onShowAuth={() => setShowAuth(true)} />')
 s=s.replace('<AppShell>\n      <AppRoutes />\n    </AppShell>', '<LibraryProvider key={session.user.id}><AudioBridge><AppShell><Suspense fallback={<div className="v2-page-loading">Loading page…</div>}><AppRoutes /></Suspense></AppShell></AudioBridge></LibraryProvider>')
 return s.replace(/        <LibraryProvider>\s*<AudioProvider>\s*<AppContent \/>\s*<\/AudioProvider>\s*<\/LibraryProvider>/, '        <AppContent />')
})
edit('src/components/layout/AppShell.jsx', s => s.replace("import React from 'react'", "import React from 'react'\nimport { useLibrary } from '../../contexts/LibraryContext'\nimport { useAuth } from '../../contexts/AuthContext'").replace('export default function AppShell({ children }) {', 'export default function AppShell({ children }) {\n  const { error, syncError, loadPublicLibrary, syncActivity } = useLibrary()\n  const { error: authError } = useAuth()').replace('{children}', `{authError && <div role="alert" className="v2-status-banner">{authError}</div>}
            {error && <div role="alert" className="v2-status-banner">Unable to load part of your library: {error} <button onClick={loadPublicLibrary}>Retry</button></div>}
            {syncError && <div role="status" className="v2-status-banner">{syncError} <button onClick={syncActivity}>Retry sync</button></div>}
            {children}`))
