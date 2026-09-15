import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Load the project environment without replacing existing process variables.
dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true,
})

export const botName = 'Music of the Heart'
