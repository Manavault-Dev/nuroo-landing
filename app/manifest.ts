import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nuroo - AI-Powered Support for Children with Special Needs',
    short_name: 'Nuroo',
    description:
      'AI-powered exercises, NurooAi chat support, and progress tracking for children with special needs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#14b8a6',
    icons: [
      {
        src: '/logo.png',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
