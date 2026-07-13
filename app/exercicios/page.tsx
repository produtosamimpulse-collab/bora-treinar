import { createServerSupabaseClient } from '@/lib/supabase/server'

type Exercise = {
  id: string
  name: string
  muscle_group: string
}

const PAGE_SIZE = 1000 // limite "Max Rows" do PostgREST no projeto Supabase

async function fetchAllExercises(
  supabase: ReturnType<typeof createServerSupabaseClient>
): Promise<Exercise[]> {
  const all: Exercise[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('exercise')
      .select('id, name, muscle_group')
      .order('muscle_group')
      .order('name')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('Failed to load exercise library:', error)
      break
    }

    if (!data || data.length === 0) {
      break
    }

    all.push(...data)

    if (data.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return all
}

export default async function ExerciciosPage() {
  const supabase = createServerSupabaseClient()
  const exercises = await fetchAllExercises(supabase)

  const grouped = (exercises ?? []).reduce<Record<string, Exercise[]>>((acc, exercise) => {
    const group = exercise.muscle_group
    acc[group] = acc[group] ?? []
    acc[group].push(exercise)
    return acc
  }, {})

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10">
      <header className="mb-10">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {exercises?.length ?? 0} exercícios
        </span>
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
          Biblioteca de <span className="text-brand">exercícios</span>
        </h1>
      </header>

      {Object.entries(grouped).map(([group, groupExercises], index) => (
        <section key={group} className="mb-10">
          <h2 className="mb-4 flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-foreground/70">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-black">
              {String(index + 1).padStart(2, '0')}
            </span>
            {group}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {groupExercises.map((exercise) => (
              <li
                key={exercise.id}
                className="rounded-xl border border-border-subtle bg-surface p-3 text-sm capitalize text-foreground/90 transition-colors hover:border-brand"
              >
                {exercise.name}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
