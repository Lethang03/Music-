import fs from 'node:fs'
const p='supabase/migrations/20260907_soundverse_completion.sql';let s=fs.readFileSync(p,'utf8').replace('grant update (display_name,', 'grant update (id, display_name,');fs.writeFileSync(p,s)
const c='playwright.config.js';s=fs.readFileSync(c,'utf8').replace("testDir: './tests',", "testDir: './tests', testMatch: '**/*.spec.js',");fs.writeFileSync(c,s)
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.scripts['test:db']='node audit/check-database.mjs';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n')
