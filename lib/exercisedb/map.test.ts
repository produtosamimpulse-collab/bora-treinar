import { describe, it, expect } from 'vitest'
import { mapToExerciseRow } from './map'
import type { ExerciseDbExercise } from './client'

describe('mapToExerciseRow', () => {
  it('maps an ExerciseDB entry to the exercise table row shape', () => {
    const input: ExerciseDbExercise = {
      id: '0001',
      name: '3/4 sit-up',
      bodyPart: 'waist',
      equipment: 'body weight',
      target: 'abs',
      secondaryMuscles: ['hip flexors', 'lower back'],
      instructions: ['Step 1', 'Step 2'],
      description: 'The 3/4 sit-up is an abdominal exercise...',
      difficulty: 'beginner',
      category: 'strength',
    }

    expect(mapToExerciseRow(input)).toEqual({
      external_id: '0001',
      name: '3/4 sit-up',
      instructions: 'Step 1\nStep 2',
      muscle_group: 'waist',
      equipment: 'body weight',
      media_url: null,
      target: 'abs',
      secondary_muscles: ['hip flexors', 'lower back'],
    })
  })

  it('maps missing equipment to null instead of empty string', () => {
    const input: ExerciseDbExercise = {
      id: '0002',
      name: 'plank',
      bodyPart: 'waist',
      equipment: '',
      target: 'abs',
      secondaryMuscles: [],
      instructions: ['Hold position'],
      description: 'The plank is a core exercise...',
      difficulty: 'beginner',
      category: 'strength',
    }

    const result = mapToExerciseRow(input)

    expect(result.equipment).toBeNull()
    expect(result.target).toBe('abs')
  })

  it('maps secondaryMuscles to secondary_muscles', () => {
    const row = mapToExerciseRow({
      id: 'ext-1',
      name: 'Barbell Bench Press',
      instructions: ['Step 1'],
      bodyPart: 'chest',
      equipment: 'barbell',
      target: 'pectorals',
      secondaryMuscles: ['triceps', 'delts'],
      description: 'Barbell bench press',
      difficulty: 'intermediate',
      category: 'strength',
    })

    expect(row.secondary_muscles).toEqual(['triceps', 'delts'])
  })
})
