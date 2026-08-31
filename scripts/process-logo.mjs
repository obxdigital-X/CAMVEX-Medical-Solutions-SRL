import sharp from "sharp"
import { readFile, writeFile } from "node:fs/promises"

const SRC = "public/assets/camvex-logo-color.png"

// Load raw pixels
const img = sharp(SRC).ensureAlpha()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info

// Threshold: pixels that are near-white become transparent.
const out = Buffer.from(data)
const WHITE = 236 // anything brighter than this on all channels is treated as background
let minX = width,
  minY = height,
  maxX = 0,
  maxY = 0

for (let i = 0; i < width * height; i++) {
  const o = i * channels
  const r = data[o],
    g = data[o + 1],
    b = data[o + 2]
  const isWhite = r >= WHITE && g >= WHITE && b >= WHITE
  if (isWhite) {
    out[o + 3] = 0 // fully transparent
  } else {
    // track bounding box of visible content
    const x = i % width
    const y = Math.floor(i / width)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
}

// Small padding around the content
const pad = 12
minX = Math.max(0, minX - pad)
minY = Math.max(0, minY - pad)
maxX = Math.min(width - 1, maxX + pad)
maxY = Math.min(height - 1, maxY + pad)
const cropW = maxX - minX + 1
const cropH = maxY - minY + 1

const base = sharp(out, { raw: { width, height, channels } }).extract({
  left: minX,
  top: minY,
  width: cropW,
  height: cropH,
})

// 1) Color transparent version (header)
await base.clone().png().toFile("public/assets/camvex-logo-transparent.png")

// 2) White transparent version (footer): keep alpha, force RGB to white
const { data: cData, info: cInfo } = await base.clone().raw().toBuffer({ resolveWithObject: true })
const white = Buffer.from(cData)
for (let i = 0; i < cInfo.width * cInfo.height; i++) {
  const o = i * cInfo.channels
  if (white[o + 3] > 0) {
    white[o] = 255
    white[o + 1] = 255
    white[o + 2] = 255
  }
}
await sharp(white, { raw: { width: cInfo.width, height: cInfo.height, channels: cInfo.channels } })
  .png()
  .toFile("public/assets/camvex-logo-white.png")

console.log(`Done. Cropped to ${cropW}x${cropH} (from ${width}x${height})`)
