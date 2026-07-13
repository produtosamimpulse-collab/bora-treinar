import { describe, it, expect } from 'vitest'
import { translateDayLabel } from './label-i18n'

describe('translateDayLabel', () => {
  it('translates legacy English split labels', () => {
    expect(translateDayLabel('Push')).toBe('Empurrar')
    expect(translateDayLabel('Pull')).toBe('Puxar')
    expect(translateDayLabel('Legs')).toBe('Pernas')
    expect(translateDayLabel('Upper')).toBe('Superior')
    expect(translateDayLabel('Lower')).toBe('Inferior')
  })

  it('translates legacy "Full Body N" labels preserving the number', () => {
    expect(translateDayLabel('Full Body 1')).toBe('Corpo Inteiro 1')
    expect(translateDayLabel('Full Body 3')).toBe('Corpo Inteiro 3')
  })

  it('passes through labels that are already in Portuguese', () => {
    expect(translateDayLabel('Empurrar')).toBe('Empurrar')
    expect(translateDayLabel('Corpo Inteiro 2')).toBe('Corpo Inteiro 2')
  })

  it('passes through unrecognized labels unchanged', () => {
    expect(translateDayLabel('Dia Especial')).toBe('Dia Especial')
  })
})
