import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SkuD Turbo Admin',
    short_name: 'SkuD Admin',
    description: 'Admin platform for managing SkuD Turbo clients, mentors and MT5 accounts.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0b0d',
    theme_color: '#0b0b0d',
    categories: ['finance', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
