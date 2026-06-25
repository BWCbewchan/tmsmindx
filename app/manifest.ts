import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Teaching Portal System (TPS)',
    short_name: 'TPS',
    description: 'Hệ thống quản lý giảng dạy MindX',
    start_url: '/user/truyenthong',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#a1001f',
    lang: 'vi',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
