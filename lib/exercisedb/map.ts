import type { ExerciseDbExercise } from './client'

export type ExerciseRow = {
  external_id: string
  name: string
  instructions: string
  muscle_group: string
  equipment: string | null
  media_url: string | null
}

export function mapToExerciseRow(exercise: ExerciseDbExercise): ExerciseRow {
  return {
    external_id: exercise.id,
    name: exercise.name,
    instructions: exercise.instructions.join('\n'),
    muscle_group: exercise.bodyPart,
    equipment: exercise.equipment || null,
    media_url: null,
  }
}
