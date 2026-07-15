import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bora Treinar!',
    short_name: 'Bora Treinar!',
    description: 'Seu personal trainer com IA',
    start_url: '/plano',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#c8ff00',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
