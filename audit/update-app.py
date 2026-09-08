from pathlib import Path
p=Path('src/App.jsx');s=p.read_text(encoding='utf-8-sig')
s=s.replace("import React from 'react'", "import React, { lazy, Suspense } from 'react'")
s=s.replace("import { LibraryProvider }", "import { LibraryProvider, useLibrary }")
for name in ['HomePage','MusicLibrary','PodcastBrowse','PodcastDetail','Profile','SearchPage','LibraryPage','AdminPage','SettingsPage']:
 import re
 s=re.sub(r"import "+name+r" from '([^']+)'",lambda m: "const "+name+" = lazy(() => import('"+m[1]+"'))",s)
s=s.replace('function AppRoutes() {', "function AdminRoute() {\n  const { isAdmin } = useAuth()\n  return isAdmin ? <AdminPage /> : <div role=\"alert\">You do not have access to administration.</div>\n}\n\nfunction AudioBridge({ children }) {\n  const { session } = useAuth()\n  const { recordProgress, getResumeTime } = useLibrary()\n  return <AudioProvider storageKey={`soundverse_player:${session.user.id}`} onProgress={recordProgress} getResumeTime={getResumeTime}>{children}</AudioProvider>\n}\n\nfunction AppRoutes() {")
s=s.replace('element={<AdminPage />}', 'element={<AdminRoute />}')
s=s.replace('const { session, loading } = useAuth()', 'const { session, loading, error } = useAuth()')
s=s.replace('<LandingPage onShowAuth={() => setShowAuth(true)} />','{error && <div className="v2-status-banner" role="alert">{error}</div>}\n        <LandingPage onShowAuth={() => setShowAuth(true)} />')
s=s.replace('<AppShell>\n      <AppRoutes />\n    </AppShell>', '<LibraryProvider key={session.user.id}>\n      <AudioBridge><AppShell><Suspense fallback={<div className="v2-page-loading">Loading page…</div>}><AppRoutes /></Suspense></AppShell></AudioBridge>\n    </LibraryProvider>')
s=s.replace('        <LibraryProvider>\n          <AudioProvider>\n            <AppContent />\n          </AudioProvider>\n        </LibraryProvider>', '        <AppContent />')
p.write_text(s,encoding='utf8')
p=Path('src/components/layout/AppShell.jsx');s=p.read_text(encoding='utf-8-sig').replace("import React from 'react'", "import React from 'react'\nimport { useLibrary } from '../../contexts/LibraryContext'\nimport { useAuth } from '../../contexts/AuthContext'")
s=s.replace('export default function AppShell({ children }) {', 'export default function AppShell({ children }) {\n  const { error, syncError, loadPublicLibrary, syncActivity } = useLibrary()\n  const { error: authError } = useAuth()')
s=s.replace('{children}', '{authError && <div role="alert" className="v2-status-banner">{authError}</div>}\n            {error && <div role="alert" className="v2-status-banner">Unable to load part of your library: {error} <button onClick={loadPublicLibrary}>Retry</button></div>}\n            {syncError && <div role="status" className="v2-status-banner">{syncError} <button onClick={syncActivity}>Retry sync</button></div>}\n            {children}')
p.write_text(s,encoding='utf8')
