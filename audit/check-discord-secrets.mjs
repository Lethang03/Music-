// Prints paths, line numbers and categories only, never matched credentials.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const omitted = new Set(['.git', 'node_modules', '.npm-cache', '.agents', '.codex', 'playwright-report', 'test-results', 'tmp'])
const findings = []
function inspect(file, content) {
  if (content.includes('\0')) return
  content.split(/\r?\n/).forEach((line, index) => {
    const types = []
    if (/\b(?:mfa\.[\w-]{60,}|[\w-]{23,28}\.[\w-]{6}\.[\w-]{27,})\b/.test(line)) types.push('possible Discord token')
    if (/\bsb_secret_[A-Za-z0-9_-]{20,}/.test(line)) types.push('Supabase secret key')
    if (/\b(?:AIza[\w-]{30,}|sk-(?:proj-)?[\w-]{30,}|gh[pousr]_[\w]{30,})\b/.test(line)) types.push('possible API key')
    for (const jwt of line.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      try { if (JSON.parse(Buffer.from(jwt[0].split('.')[1], 'base64url')).role === 'service_role') types.push('Supabase service_role JWT') } catch { /* Not a JWT. */ }
    }
    const assignment = line.match(/^\s*(?:export\s+)?(?:DISCORD_TOKEN|SUPABASE_SERVICE_ROLE_KEY|[A-Z_]*API_KEY)\s*=\s*["']?([^\s"']+)/)
    if (assignment && assignment[1].length > 20 && !/YOUR[-_]|PLACEHOLDER|EXAMPLE|process\.env|import\.meta|\$\{/i.test(assignment[1])) types.push('credential assignment')
    for (const type of new Set(types)) findings.push({ file, line: index + 1, type })
  })
}
function walk(folder) {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    if (omitted.has(item.name) || item.isSymbolicLink()) continue
    const path = join(folder, item.name)
    if (item.isDirectory()) walk(path)
    else if (/\.(?:m?[jc]?[st]sx?|json|md|sql|ya?ml|toml|html|txt|env|example|config|local)$/.test(item.name) || item.name.startsWith('.env')) {
      inspect(path, readFileSync(path, 'utf8'))
    }
  }
}
walk('.')
const tracked = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
if (tracked.status !== 0) throw new Error('Cannot inspect Git index')
const envFiles = tracked.stdout.split('\0').filter(path => /(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.example') && !path.includes('node_modules/'))
for (const file of envFiles) console.log(`TRACKED ENV: ${file}`)
const committedEnv = spawnSync('git', ['show', 'HEAD:.env'], { encoding: 'utf8' })
if (committedEnv.status === 0) inspect('HEAD:.env', committedEnv.stdout)
let sourceFindings = 0
for (const finding of findings) {
  const ignored = !finding.file.startsWith('HEAD:') && spawnSync('git', ['check-ignore', '--quiet', '--', finding.file]).status === 0
  if (!ignored) sourceFindings++
  console.log(`${ignored ? 'IGNORED LOCAL SECRET' : 'SOURCE FINDING'}: ${finding.file}:${finding.line}: ${finding.type}`)
}
console.log(`Scan complete: ${sourceFindings} source findings; ${envFiles.length} tracked environment files. Ignored vendor/cache directories; HEAD .env checked, not full Git history.`)
process.exitCode = sourceFindings || envFiles.length ? 1 : 0
