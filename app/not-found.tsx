'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Deterministic particles — no hydration mismatch
const PARTICLES = [
  { id: 0,  x: 8,  y: 15, r: 1.5, dur: 9,  del: 0   },
  { id: 1,  x: 22, y: 72, r: 1,   dur: 13, del: 1.2 },
  { id: 2,  x: 38, y: 8,  r: 2,   dur: 7,  del: 0.5 },
  { id: 3,  x: 55, y: 85, r: 1.5, dur: 11, del: 2   },
  { id: 4,  x: 70, y: 30, r: 1,   dur: 8,  del: 0.8 },
  { id: 5,  x: 85, y: 60, r: 2,   dur: 15, del: 3   },
  { id: 6,  x: 12, y: 50, r: 1,   dur: 10, del: 1.5 },
  { id: 7,  x: 92, y: 18, r: 1.5, dur: 12, del: 0.3 },
  { id: 8,  x: 48, y: 92, r: 1,   dur: 6,  del: 2.5 },
  { id: 9,  x: 65, y: 5,  r: 2,   dur: 14, del: 1   },
  { id: 10, x: 3,  y: 88, r: 1,   dur: 9,  del: 3.5 },
  { id: 11, x: 78, y: 78, r: 1.5, dur: 11, del: 0.7 },
  { id: 12, x: 30, y: 38, r: 1,   dur: 7,  del: 4   },
  { id: 13, x: 95, y: 45, r: 2,   dur: 16, del: 1.8 },
  { id: 14, x: 50, y: 55, r: 1,   dur: 8,  del: 2.2 },
]

// Orbit dots
const ORBIT_DOTS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  angle: (i / 8) * 360,
}))

export default function NotFound() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(110px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(110px) rotate(-360deg); }
        }
        @keyframes float-y {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-18px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50%      { opacity: 0.7; }
        }
        @keyframes gradient-pan {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .text-gradient-404 {
          background: linear-gradient(135deg, #14b8a6, #2dd4bf, #5eead4, #0d9488);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradient-pan 4s ease infinite;
        }
        .ring { animation: pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.4, 1) infinite; }
        .ring-2 { animation: pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.4, 1) 0.8s infinite; }
        .ring-3 { animation: pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.4, 1) 1.6s infinite; }
        .float { animation: float-y 4s ease-in-out infinite; }
        .orbit-wrap { animation: orbit linear infinite; }
        .spin-ring { animation: spin-slow 20s linear infinite; }
      `}</style>

      <div className="relative min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden">

        {/* Background particles */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
          {PARTICLES.map((p) => (
            <circle
              key={p.id}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r={p.r}
              fill="#14b8a6"
              style={{
                animation: `twinkle ${p.dur}s ease-in-out ${p.del}s infinite`,
                opacity: 0.15,
              }}
            />
          ))}
        </svg>

        {/* Ambient glow blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full bg-primary-400/8 blur-[80px] pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full bg-teal-500/8 blur-[60px] pointer-events-none" />

        {/* Main content */}
        <div
          className="relative z-10 flex flex-col items-center text-center px-6"
          style={{
            transition: 'opacity 0.7s ease, transform 0.7s ease',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          {/* Radar + 404 */}
          <div className="relative mb-10 float">
            {/* Pulse rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border border-primary-500/40 ring" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border border-primary-500/30 ring-2" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full border border-primary-500/20 ring-3" />
            </div>

            {/* Spinning dashed ring */}
            <div className="absolute inset-[-40px] flex items-center justify-center">
              <div
                className="w-[220px] h-[220px] rounded-full border border-dashed border-primary-600/20 spin-ring"
              />
            </div>

            {/* Orbit dots */}
            <div className="absolute inset-0 flex items-center justify-center">
              {ORBIT_DOTS.map((dot) => (
                <div
                  key={dot.id}
                  className="absolute"
                  style={{
                    width: '8px',
                    height: '8px',
                  }}
                >
                  <div
                    className="orbit-wrap"
                    style={{
                      animationDuration: `${8 + dot.id * 0.3}s`,
                      animationDelay: `${-dot.id * 1.1}s`,
                      transformOrigin: '4px 4px',
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-primary-400"
                      style={{ opacity: 0.3 + (dot.id % 3) * 0.25 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 404 text */}
            <div className="relative flex items-center justify-center w-40 h-40">
              <span
                className="text-gradient-404 select-none"
                style={{
                  fontSize: '6rem',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.05em',
                }}
              >
                404
              </span>
            </div>
          </div>

          {/* Copy */}
          <div className="max-w-md">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              Страница потерялась
            </h1>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-2">
              Мы специализируемся на развитии детей, а не на поиске пропавших страниц.
            </p>
            <p className="text-slate-500 text-sm mb-10">
              Но если страницы нет — значит, впереди что-то лучшее.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors duration-200 shadow-lg shadow-primary-900/40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15v-5.25a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75V21.75H3.75A.75.75 0 013 21V9.75z" />
                </svg>
                На главную
              </Link>
              <Link
                href="/b2b"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 text-slate-300 border border-white/10 font-medium hover:bg-white/10 hover:text-white transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                В кабинет
              </Link>
            </div>
          </div>

          {/* Bottom hint */}
          <p className="mt-12 text-xs text-slate-700 tracking-widest uppercase">
            nuroo · детская платформа развития
          </p>
        </div>
      </div>
    </>
  )
}
