import assert from 'node:assert/strict'
import { toFriendlyError } from '../src/lib/friendlyError.js'

// 1. Quota error
const quotaErr = { message: 'Service for this project is restricted due to the following violations: exceed_cached_egress_quota' }
assert.equal(toFriendlyError(quotaErr), 'SoundVerse bandwidth quota is temporarily limited. Please try again shortly.')

// 2. HTTP 402
const http402 = { status: 402, message: 'Payment Required' }
assert.equal(toFriendlyError(http402), 'SoundVerse bandwidth quota is temporarily limited. Please try again shortly.')

// 3. HTTP 429
const http429 = { status: 429, message: 'Too Many Requests' }
assert.equal(toFriendlyError(http429), 'Too many requests. Please wait a moment before retrying.')

// 4. Fixture error preservation
const fixtureErr = { message: 'Fixture music_tracks unavailable', code: 'PGRST205' }
assert.equal(toFriendlyError(fixtureErr), 'Fixture music_tracks unavailable')

// 5. Network error
const netErr = new Error('Failed to fetch')
assert.equal(toFriendlyError(netErr), 'Unable to connect to the server. Check your connection or retry.')

console.log('PASS: friendlyError mapping unit checks passed.')

