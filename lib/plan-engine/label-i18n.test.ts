import { describe, it, expect } from 'vitest'
import { translateDayLabel } from './label-i18n'

describe('translateDayLabel', () => {
  it('translates legacy English split labels to the current descriptive names', () => {
    expect(translateDayLabel('Push')).toBe('Peito, Ombros e Tríceps')
    expect(translateDayLabel('Pull')).toBe('Costas e Bíceps')
    expect(translateDayLabel('Legs')).toBe('Pernas e Glúteos')
    expect(translateDayLabel('Upper')).toBe('Peito, Costas e Ombros')
    expect(translateDayLabel('Lower')).toBe('Pernas e Glúteos')
  })

  it('translates the short Portuguese labels from the first localization round', () => {
    expect(translateDayLabel('Empurrar')).toBe('Peito, Ombros e Tríceps')
    expect(translateDayLabel('Puxar')).toBe('Costas e Bíceps')
    expect(translateDayLabel('Pernas')).toBe('Pernas e Glúteos')
    expect(translateDayLabel('Superior')).toBe('Peito, Costas e Ombros')
    expect(translateDayLabel('Inferior')).toBe('Pernas e Glúteos')
  })

  it('translates legacy "Full Body N" labels preserving the number', () => {
    expect(translateDayLabel('Full Body 1')).toBe('Corpo Inteiro 1')
    expect(translateDayLabel('Full Body 3')).toBe('Corpo Inteiro 3')
  })

  it('passes through labels that already use the current descriptive names', () => {
    expect(translateDayLabel('Peito, Ombros e Tríceps')).toBe('Peito, Ombros e Tríceps')
    expect(translateDayLabel('Corpo Inteiro 2')).toBe('Corpo Inteiro 2')
  })

  it('passes through unrecognized labels unchanged', () => {
    expect(translateDayLabel('Dia Especial')).toBe('Dia Especial')
  })
})
