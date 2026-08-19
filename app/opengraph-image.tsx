import { ImageResponse } from 'next/og'
import { getSiteHostname } from '@/lib/seo/site'

export const runtime = 'edge'
export const alt = 'Nuroo | Маркетплейс детского развития'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const hostname = getSiteHostname()

  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 50%, #f0f9ff 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Logo area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: 'white', fontSize: '28px', fontWeight: 800 }}>N</div>
        </div>
        <div style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a' }}>Nuroo</div>
      </div>

      {/* Headline */}
      <div
        style={{
          fontSize: '64px',
          fontWeight: 800,
          color: '#0f172a',
          lineHeight: 1.1,
          marginBottom: '24px',
          maxWidth: '800px',
        }}
      >
        Всё для развития ребёнка в одном месте
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: '28px',
          color: '#475569',
          maxWidth: '700px',
          lineHeight: 1.4,
          marginBottom: '48px',
        }}
      >
        Специалисты · Детские центры · Программы · Мастер-классы
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {['Логопеды', 'Психологи', 'Дефектологи', 'Детские центры'].map((tag) => (
          <div
            key={tag}
            style={{
              background: '#f0fdfa',
              border: '1.5px solid #99f6e4',
              borderRadius: '100px',
              padding: '10px 20px',
              fontSize: '20px',
              color: '#0d9488',
              fontWeight: 600,
            }}
          >
            {tag}
          </div>
        ))}
      </div>

      {/* URL */}
      <div
        style={{
          position: 'absolute',
          bottom: '48px',
          right: '80px',
          fontSize: '22px',
          color: '#94a3b8',
          fontWeight: 500,
        }}
      >
        {hostname}
      </div>
    </div>,
    { ...size }
  )
}
