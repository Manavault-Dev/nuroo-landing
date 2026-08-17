import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Nuroo — Маркетплейс детского развития'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const mascotSrc = 'https://usenuroo.com/mascot-6.svg'

  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 45%, #e0f2fe 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left — text content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '72px 0 72px 80px',
          flex: '0 0 660px',
          zIndex: 2,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '40px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ color: 'white', fontSize: '26px', fontWeight: 800 }}>N</div>
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: '#0f172a' }}>Nuroo</div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '58px',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.1,
            marginBottom: '22px',
            maxWidth: '580px',
          }}
        >
          Всё для развития ребёнка — в одном месте
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: '#475569',
            maxWidth: '560px',
            lineHeight: 1.4,
            marginBottom: '40px',
          }}
        >
          Специалисты · Центры · Программы · Мастер-классы
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {['Логопеды', 'Психологи', 'Дефектологи', 'Детские центры'].map((tag) => (
            <div
              key={tag}
              style={{
                background: '#f0fdfa',
                border: '1.5px solid #99f6e4',
                borderRadius: '100px',
                padding: '8px 18px',
                fontSize: '18px',
                color: '#0d9488',
                fontWeight: 600,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>

      {/* Right — mascot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          paddingRight: '40px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mascotSrc}
          alt="Nuroo mascot"
          width={400}
          height={400}
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* URL bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '80px',
          fontSize: '20px',
          color: '#94a3b8',
          fontWeight: 500,
        }}
      >
        usenuroo.com
      </div>
    </div>,
    { ...size }
  )
}
