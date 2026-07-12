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
})
