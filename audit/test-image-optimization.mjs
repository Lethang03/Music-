import assert from 'node:assert/strict'
import { optimizeImageFile } from '../src/lib/imageOptimization.js'

// 1. Non-image file handling
const textBlob = new Blob(['hello world'], { type: 'text/plain' })
const result1 = await optimizeImageFile(textBlob)
assert.equal(result1, textBlob, 'Non-image file should be returned as-is')

// 2. Null / undefined handling
assert.equal(await optimizeImageFile(null), null)
assert.equal(await optimizeImageFile(undefined), undefined)

// 3. SVG handling (should not be rasterized)
const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' })
const result3 = await optimizeImageFile(svgBlob)
assert.equal(result3, svgBlob, 'SVG image should remain vector without canvas rasterization')

console.log('PASS: imageOptimization unit checks succeeded.')

