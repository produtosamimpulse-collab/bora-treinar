import { describe, it, expect } from 'vitest'
import { isPublicPath } from './middleware'

describe('isPublicPath', () => {
  it('treats /login as public', () => {
    expect(isPublicPath('/login')).toBe(true)
  })

  it('treats other paths as protected', () => {
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/treino')).toBe(false)
  })

  it('treats the favicon, manifest, and share-preview assets as public', () => {
    expect(isPublicPath('/icon.png')).toBe(true)
    expect(isPublicPath('/apple-icon.png')).toBe(true)
    expect(isPublicPath('/manifest.webmanifest')).toBe(true)
    expect(isPublicPath('/og-image.png')).toBe(true)
    expect(isPublicPath('/icon-192.png')).toBe(true)
    expect(isPublicPath('/icon-512.png')).toBe(true)
  })
})
