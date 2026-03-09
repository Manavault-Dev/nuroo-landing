import { NextRequest, NextResponse } from 'next/server'

const MAX_MEDIA_BYTES = 15 * 1024 * 1024 // 15MB

function isAllowedUrl(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase()
  const isPrivate =
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^::1$/.test(host)
  if (isPrivate) return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  return parsed.protocol === 'https:'
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  avi: 'video/x-msvideo',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
}

/**
 * Firebase Storage (and other CDNs) sometimes serve files as
 * application/octet-stream even when they are images/videos.
 * Try to resolve the real MIME type from the URL path's file extension.
 */
function resolveContentType(url: string, upstreamType: string): string {
  // If Firebase returned a real typed content-type, trust it
  if (
    upstreamType &&
    upstreamType !== 'application/octet-stream' &&
    !upstreamType.startsWith('text/')
  ) {
    return upstreamType
  }

  try {
    // Firebase Storage URLs look like:
    // https://firebasestorage.googleapis.com/v0/b/project/o/homework%2Fuid%2FtaskId%2Fphoto.jpg?alt=media&token=...
    const parsed = new URL(url)
    // The file path is the last segment of the /o/ path, URL-encoded
    const oIndex = parsed.pathname.indexOf('/o/')
    const rawPath = oIndex !== -1 ? parsed.pathname.slice(oIndex + 3) : parsed.pathname
    const decoded = decodeURIComponent(rawPath)
    const ext = decoded.split('.').pop()?.toLowerCase().split('?')[0] ?? ''
    if (ext && EXT_MIME[ext]) return EXT_MIME[ext]
  } catch {
    // ignore
  }

  return upstreamType || 'application/octet-stream'
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return new NextResponse('Missing url', { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }

  if (!isAllowedUrl(parsed)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const upstream = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'image/*,video/*,*/*;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; NurooMediaProxy/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      referrerPolicy: 'no-referrer',
      // Request full resource; do not send Range so we get 200 with full body
      // (Firebase can return 206 with 1 byte if Range is sent, breaking display)
    })

    if (!upstream.ok) {
      return new NextResponse('Upstream error', { status: upstream.status })
    }

    const rawContentType = upstream.headers.get('content-type') || 'application/octet-stream'
    let contentType = resolveContentType(url, rawContentType)
    const reader = upstream.body
    if (!reader) {
      return new NextResponse('No body', { status: 502 })
    }

    const chunks: Uint8Array[] = []
    let total = 0
    const reader_ = reader.getReader()
    while (true) {
      const { done, value } = await reader_.read()
      if (done) break
      if (value) {
        total += value.length
        if (total > MAX_MEDIA_BYTES) break
        chunks.push(value)
      }
    }
    const buffer = await new Blob(chunks as BlobPart[]).arrayBuffer()

    const isHeic =
      contentType === 'image/heic' ||
      contentType === 'image/heif' ||
      url.toLowerCase().includes('.heic') ||
      url.toLowerCase().includes('.heif')

    let body: ArrayBuffer | Uint8Array = buffer
    if (isHeic) {
      try {
        const heicConvert = await import('heic-convert')
        const inputBuf = Buffer.from(buffer)
        const jpegBuffer = await (heicConvert.default || heicConvert)({
          buffer: inputBuf,
          format: 'JPEG',
          quality: 0.92,
        })
        const out = Buffer.isBuffer(jpegBuffer)
          ? jpegBuffer
          : Buffer.from(jpegBuffer as ArrayBuffer)
        body = new Uint8Array(out)
        contentType = 'image/jpeg'
      } catch (e) {
        console.warn('[media-proxy] HEIC convert failed, returning original:', e)
      }
    }

    const responseBody: ArrayBuffer =
      body instanceof ArrayBuffer
        ? body
        : (body.buffer as ArrayBuffer).slice(body.byteOffset, body.byteOffset + body.byteLength)
    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[media-proxy] fetch error:', err)
    return new NextResponse('Proxy error', { status: 502 })
  }
}
