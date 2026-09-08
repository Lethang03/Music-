import fs from 'node:fs'
const p='playwright.config.js';let s=fs.readFileSync(p,'utf8').replace('  webServer: {', "  webServer: process.env.SOUNDVERSE_EXTERNAL_SERVER ? undefined : {");fs.writeFileSync(p,s)
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.scripts['test:e2e']='node audit/run-tests.mjs';fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n')
