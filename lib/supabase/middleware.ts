const PUBLIC_PATHS = [
  '/login',
  '/api/keep-alive',
  '/icon.jpg',
  '/apple-icon.jpg',
  '/manifest.webmanifest',
  '/og-image.jpg',
  '/icon-192.jpg',
  '/icon-512.jpg',
]

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname)
}
