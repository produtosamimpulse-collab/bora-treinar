import { describe, it, expect } from 'vitest'
import { classifyExerciseName } from './exercise-catalog'

describe('classifyExerciseName', () => {
  it('classifies flat bench press as composto, not confusing it with incline', () => {
    expect(classifyExerciseName('Barbell Bench Press - Medium Grip')?.namePt).toBe('Supino reto')
    expect(classifyExerciseName('Barbell Bench Press - Medium Grip')?.mechanic).toBe('composto')
  })

  it('classifies incline bench press separately from flat', () => {
    expect(classifyExerciseName('Incline Dumbbell Press')?.namePt).toBe('Supino inclinado')
  })

  it('classifies a fly movement as isolado, distinct from press', () => {
    expect(classifyExerciseName('Incline Dumbbell Flyes')?.namePt).toBe('Crucifixo reto/inclinado')
    expect(classifyExerciseName('Incline Dumbbell Flyes')?.mechanic).toBe('isolado')
  })

  it('classifies lat pulldown as composto and straight-arm pulldown as isolado', () => {
    expect(classifyExerciseName('Wide-Grip Lat Pulldown')?.namePt).toBe('Puxada frontal')
    expect(classifyExerciseName('Wide-Grip Lat Pulldown')?.mechanic).toBe('composto')
    expect(classifyExerciseName('Straight-Arm Pulldown')?.namePt).toBe('Pulldown com corda')
    expect(classifyExerciseName('Straight-Arm Pulldown')?.mechanic).toBe('isolado')
  })

  it('classifies squat and leg extension correctly', () => {
    expect(classifyExerciseName('Barbell Full Squat')?.mechanic).toBe('composto')
    expect(classifyExerciseName('Leg Extension')?.mechanic).toBe('isolado')
  })

  it('returns null for a name matching nothing in the catalog', () => {
    expect(classifyExerciseName('Tire Flip')).toBeNull()
    expect(classifyExerciseName('Bosu Ball Balance Hold')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(classifyExerciseName('BARBELL BENCH PRESS')?.namePt).toBe('Supino reto')
  })
})
