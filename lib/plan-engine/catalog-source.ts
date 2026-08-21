import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogExercise } from './movement-catalog'

/**
 * Traz o catálogo inteiro de exercícios não-cardio. O filtro de qualidade não
 * é feito no banco porque quem decide o que é exercício tradicional de
 * academia é o catálogo de movimentos, e ele casa por nome.
 */
export async function loadCatalogPool(supabase: SupabaseClient): Promise<CatalogExercise[]> {
  const pool: CatalogExercise[] = []
  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from('exercise')
      .select('id, name, name_pt, equipment, is_cardio')
      .eq('is_cardio', false)
      .range(offset, offset + 999)

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) break

    pool.push(
      ...data.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        namePt: (row.name_pt as string | null) ?? null,
        equipment: (row.equipment as string | null) ?? null,
      }))
    )

    if (data.length < 1000) break
    offset += 1000
  }

  return pool
}
