import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
const temp = path.resolve('audit/tmp')
fs.mkdirSync(temp, { recursive: true })
process.env.TEMP = temp
process.env.TMP = temp
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: 0, workers: 2, timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'audit/test-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:3100', channel: 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.SOUNDVERSE_EXTERNAL_SERVER ? undefined : {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3100 --strictPort',
    url: 'http://127.0.0.1:3100', reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://soundverse-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture' }
  }
})
