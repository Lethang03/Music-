import fs from 'node:fs'
const p='playwright.config.js';let s=fs.readFileSync(p,'utf8');s=s.replace("command: 'npm.cmd run dev -- --host 127.0.0.1 --port 3100 --strictPort'", "command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3100 --strictPort'");fs.writeFileSync(p,s)
