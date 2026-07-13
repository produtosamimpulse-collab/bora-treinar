import { createServerSupabaseClient } from '@/lib/supabase/server'

type Exercise = {
  id: string
  name: string
  muscle_group: string
}

export default async function ExerciciosPage() {
  const supabase = createServerSupabaseClient()
  const { data: exercises } = await supabase
    .from('exercise')
    .select('id, name, muscle_group')
    .order('muscle_group')
    .order('name')

  const grouped = (exercises ?? []).reduce<Record<string, Exercise[]>>((acc, exercise) => {
    const group = exercise.muscle_group
    acc[group] = acc[group] ?? []
    acc[group].push(exercise)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <h1 className="mb-6 text-2xl font-semibold">Biblioteca de exercícios</h1>
      {Object.entries(grouped).map(([group, groupExercises]) => (
        <section key={group} className="mb-8">
          <h2 className="mb-3 text-lg font-medium capitalize text-brand">{group}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {groupExercises.map((exercise) => (
              <li key={exercise.id} className="rounded border border-gray-200 p-2 text-sm">
                {exercise.name}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
