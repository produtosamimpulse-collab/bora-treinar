import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const { data: exercise, error } = await supabase
    .from('exercise')
    .select('id, external_id, media_url')
    .eq('id', id)
    .single()

  if (error || !exercise) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
  }

  if (exercise.media_url) {
    return NextResponse.redirect(exercise.media_url)
  }

  const apiKey = process.env.EXERCISEDB_API_KEY
  const apiHost = process.env.EXERCISEDB_API_HOST

  if (!apiKey || !apiHost) {
    throw new Error('Missing ExerciseDB API credentials')
  }

  const gifResponse = await fetch(
    `https://${apiHost}/image?exerciseId=${exercise.external_id}&resolution=180`,
    { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost } }
  )

  if (!gifResponse.ok) {
    throw new Error(`ExerciseDB image request failed: ${gifResponse.status}`)
  }

  const gifBuffer = await gifResponse.arrayBuffer()
  const path = `${exercise.external_id}.gif`

  const { error: uploadError } = await supabase.storage
    .from('exercise-gifs')
    .upload(path, gifBuffer, { contentType: 'image/gif', upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrlData } = supabase.storage.from('exercise-gifs').getPublicUrl(path)

  await supabase.from('exercise').update({ media_url: publicUrlData.publicUrl }).eq('id', exercise.id)

  return NextResponse.redirect(publicUrlData.publicUrl)
}
