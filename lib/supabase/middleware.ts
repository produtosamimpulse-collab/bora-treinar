const PUBLIC_PATHS = [
  '/login',
  '/icon.png',
  '/apple-icon.png',
  '/manifest.webmanifest',
  '/og-image.png',
  '/icon-192.png',
  '/icon-512.png',
]

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname)
}
