import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Gif de exercício nunca muda pro mesmo id (o path no storage é fixo por
// external_id) - servimos os bytes com esse Cache-Control em vez de
// redirecionar pro Supabase Storage, porque o storage desse projeto não tem
// CDN habilitado e ignora o cacheControl do upload, sempre respondendo
// "no-cache". Assim o navegador guarda o gif por um ano e não baixa de
// novo em toda visita ao app.
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

function gifResponse(body: BodyInit): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': CACHE_CONTROL,
    },
  })
}

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
    const cachedResponse = await fetch(exercise.media_url)

    if (!cachedResponse.ok) {
      throw new Error(`Cached gif fetch failed: ${cachedResponse.status}`)
    }

    return gifResponse(await cachedResponse.arrayBuffer())
  }

  const apiKey = process.env.EXERCISEDB_API_KEY
  const apiHost = process.env.EXERCISEDB_API_HOST

  if (!apiKey || !apiHost) {
    throw new Error('Missing ExerciseDB API credentials')
  }

  const exerciseDbResponse = await fetch(
    `https://${apiHost}/image?exerciseId=${exercise.external_id}&resolution=180`,
    { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost } }
  )

  if (!exerciseDbResponse.ok) {
    throw new Error(`ExerciseDB image request failed: ${exerciseDbResponse.status}`)
  }

  const gifBuffer = await exerciseDbResponse.arrayBuffer()
  const path = `${exercise.external_id}.gif`

  const { error: uploadError } = await supabase.storage
    .from('exercise-gifs')
    .upload(path, gifBuffer, { contentType: 'image/gif', upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrlData } = supabase.storage.from('exercise-gifs').getPublicUrl(path)

  await supabase.from('exercise').update({ media_url: publicUrlData.publicUrl }).eq('id', exercise.id)

  return gifResponse(gifBuffer)
}
