/**
 * Browser-only: extract dominant saturated color from an image src.
 * Works for data URIs (file uploads) and cross-origin-enabled URLs.
 */

import { hexToHsl, hslToHex } from './colorUtils'

/**
 * Load an image into a canvas and sample pixel colors.
 * Returns null if the image cannot be sampled (CORS, tainted canvas, etc).
 */
async function samplePixels(src: string): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const img = new Image()
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 64
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        resolve(data)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Bucket hue into 12 segments of 30° each.
 * Returns the most frequent hue bucket that has high saturation.
 */
function findDominantHue(pixels: Uint8ClampedArray): [number, number, number] | null {
  // hue bucket → [count, total_sat, total_light, sample_h, sample_s, sample_l]
  const buckets: Array<[number, number, number, number, number, number]> = Array.from(
    { length: 12 },
    () => [0, 0, 0, 0, 0, 0]
  )

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]
    if (a < 128) continue // skip transparent

    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const l = (max + min) / 2
    if (l < 0.08 || l > 0.92) continue // skip near-black and near-white
    if (max === min) continue // skip grays

    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (s < 0.2) continue // skip low-saturation

    let h = 0
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
    const hDeg = h * 360

    const bi = Math.floor(hDeg / 30)
    buckets[bi][0]++
    buckets[bi][1] += s
    buckets[bi][2] += l
    if (buckets[bi][0] === 1) {
      buckets[bi][3] = hDeg
      buckets[bi][4] = s
      buckets[bi][5] = l
    }
  }

  // Find best bucket: count × average_saturation
  let best = -1
  let bestScore = 0
  for (let i = 0; i < 12; i++) {
    const [count, totalSat] = buckets[i]
    if (count === 0) continue
    const avgSat = totalSat / count
    const score = count * avgSat
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }

  if (best === -1) return null

  const [count, totalSat, totalLight, firstH] = buckets[best]
  const avgSat = Math.min(100, Math.round((totalSat / count) * 100))
  const avgLight = Math.round((totalLight / count) * 100)
  // Clamp hue to center of bucket, use sample for precision
  return [
    Math.round(firstH),
    Math.max(35, Math.min(80, avgSat)),
    Math.max(30, Math.min(65, avgLight)),
  ]
}

/**
 * Extract the dominant vibrant color from an image URL or data URI.
 * Returns a hex string like '#2563eb', or null on failure.
 */
export async function extractDominantColor(src: string): Promise<string | null> {
  if (!src) return null
  const pixels = await samplePixels(src)
  if (!pixels) return null
  const hsl = findDominantHue(pixels)
  if (!hsl) return null
  return hslToHex(hsl[0], hsl[1], hsl[2])
}

/**
 * Convert a File to a data URI so we can use it with the canvas without CORS issues.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Hue distance (0–180) between two hex colors.
 * Used to find closest preset.
 */
export function hueDistance(hex1: string, hex2: string): number {
  const [h1] = hexToHsl(hex1)
  const [h2] = hexToHsl(hex2)
  const d = Math.abs(h1 - h2)
  return d > 180 ? 360 - d : d
}
