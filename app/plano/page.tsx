import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams

  if (!id) {
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        <p>Nenhum plano encontrado.</p>
      </main>
    )
  }

  const supabase = createServerSupabaseClient()

  const { data: days } = await supabase
    .from('workout_day')
    .select('id, day_label, week_number, workout_day_exercise(id, target_sets, target_reps, exercise(name))')
    .eq('training_plan_id', id)
    .eq('week_number', 1)
    .order('id')

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10">
      <header className="mb-10">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-foreground/60">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Semana 1, calibração
        </span>
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
          Seu <span className="text-brand">plano</span>
        </h1>
      </header>

      {(days ?? []).map((day) => (
        <section key={day.id} className="mb-8 rounded-2xl border border-border-subtle bg-surface p-6">
          <h2 className="mb-4 font-display text-2xl uppercase">{day.day_label}</h2>
          <ul className="space-y-2">
            {(day.workout_day_exercise as unknown as Array<{
              id: string
              target_sets: number
              target_reps: number
              exercise: { name: string }
            }>).map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span>{item.exercise.name}</span>
                <span className="text-foreground/60">
                  {item.target_sets}x{item.target_reps}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
