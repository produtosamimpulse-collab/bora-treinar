export type Mechanic = 'composto' | 'isolado'

export type CatalogEntry = {
  namePt: string
  mechanic: Mechanic
  keywords: string[]
  exclude?: string[]
}

const EXERCISE_CATALOG: CatalogEntry[] = [
  // Peito
  { namePt: 'Supino inclinado', mechanic: 'composto', keywords: ['incline bench press', 'incline barbell press', 'incline dumbbell press', 'incline smith machine press'] },
  { namePt: 'Supino declinado', mechanic: 'composto', keywords: ['decline bench press', 'decline barbell press', 'decline dumbbell press', 'decline smith machine press'] },
  { namePt: 'Supino reto', mechanic: 'composto', keywords: ['bench press', 'barbell bench', 'dumbbell bench press', 'smith machine bench press'], exclude: ['incline', 'decline'] },
  { namePt: 'Flexão de braço', mechanic: 'composto', keywords: ['push-up', 'push up', 'pushup'] },
  { namePt: 'Crucifixo reto/inclinado', mechanic: 'isolado', keywords: ['fly', 'flye', 'flyes'] },
  { namePt: 'Crossover (cabo)', mechanic: 'isolado', keywords: ['crossover'] },
  { namePt: 'Peck deck (voador)', mechanic: 'isolado', keywords: ['pec deck', 'pec-deck'] },

  // Costas
  { namePt: 'Puxada por trás', mechanic: 'composto', keywords: ['behind the neck pulldown', 'behind neck pulldown'] },
  { namePt: 'Puxada frontal', mechanic: 'composto', keywords: ['lat pulldown', 'pulldown'], exclude: ['straight-arm', 'straight arm'] },
  { namePt: 'Remada baixa (cabo)', mechanic: 'composto', keywords: ['seated cable row', 'seated row', 'cable row'] },
  { namePt: 'Remada curvada (barra)', mechanic: 'composto', keywords: ['bent over row', 'bent-over row', 'barbell row'] },
  { namePt: 'Remada unilateral (halter)', mechanic: 'composto', keywords: ['one-arm dumbbell row', 'one arm row', 'single-arm row', 'dumbbell row'] },
  { namePt: 'Remada cavalinho (T-bar)', mechanic: 'composto', keywords: ['t-bar row', 't bar row'] },
  { namePt: 'Barra fixa (pull-up)', mechanic: 'composto', keywords: ['pull-up', 'pullup', 'pull up', 'chin-up', 'chin up'] },
  { namePt: 'Pulldown com corda', mechanic: 'isolado', keywords: ['straight-arm pulldown', 'straight arm pulldown'] },
  { namePt: 'Hiperextensão lombar', mechanic: 'isolado', keywords: ['hyperextension', 'back extension'] },
  { namePt: 'Levantamento terra', mechanic: 'composto', keywords: ['deadlift'] },

  // Ombro
  { namePt: 'Desenvolvimento', mechanic: 'composto', keywords: ['shoulder press', 'overhead press', 'military press', 'arnold press'] },
  { namePt: 'Remada alta', mechanic: 'composto', keywords: ['upright row'] },
  { namePt: 'Elevação lateral', mechanic: 'isolado', keywords: ['lateral raise'] },
  { namePt: 'Elevação frontal', mechanic: 'isolado', keywords: ['front raise'] },
  { namePt: 'Crucifixo inverso', mechanic: 'isolado', keywords: ['reverse fly', 'rear delt fly', 'reverse flye'] },
  { namePt: 'Encolhimento (trapézio)', mechanic: 'isolado', keywords: ['shrug'] },

  // Bíceps
  { namePt: 'Rosca scott', mechanic: 'isolado', keywords: ['preacher curl'] },
  { namePt: 'Rosca martelo', mechanic: 'isolado', keywords: ['hammer curl'] },
  { namePt: 'Rosca concentrada', mechanic: 'isolado', keywords: ['concentration curl'] },
  { namePt: 'Rosca cabo', mechanic: 'isolado', keywords: ['cable curl'] },
  { namePt: 'Rosca alternada', mechanic: 'isolado', keywords: ['alternate dumbbell curl', 'alternating dumbbell curl'] },
  { namePt: 'Rosca direta', mechanic: 'isolado', keywords: ['barbell curl', 'ez-bar curl', 'ez bar curl', 'curl'] },

  // Tríceps
  { namePt: 'Supino fechado', mechanic: 'composto', keywords: ['close-grip bench press', 'close grip bench press'] },
  { namePt: 'Mergulho no banco (dips)', mechanic: 'composto', keywords: ['dip', 'dips'] },
  { namePt: 'Tríceps testa', mechanic: 'isolado', keywords: ['skull crusher', 'lying triceps extension', 'lying triceps press'] },
  { namePt: 'Tríceps francês', mechanic: 'isolado', keywords: ['overhead triceps extension', 'french press', 'seated triceps extension'] },
  { namePt: 'Tríceps coice', mechanic: 'isolado', keywords: ['triceps kickback', 'kickback'] },
  { namePt: 'Tríceps pulley', mechanic: 'isolado', keywords: ['triceps pushdown', 'pushdown', 'triceps rope pushdown'] },

  // Pernas - quadríceps
  { namePt: 'Agachamento no Smith', mechanic: 'composto', keywords: ['smith machine squat'] },
  { namePt: 'Agachamento livre', mechanic: 'composto', keywords: ['barbell squat', 'back squat', 'front squat', 'full squat'], exclude: ['smith'] },
  { namePt: 'Agachamento búlgaro', mechanic: 'composto', keywords: ['bulgarian split squat'] },
  { namePt: 'Hack machine', mechanic: 'composto', keywords: ['hack squat'] },
  { namePt: 'Leg press 45°', mechanic: 'composto', keywords: ['leg press'], exclude: ['calf'] },
  { namePt: 'Passada (afundo)', mechanic: 'composto', keywords: ['lunge'] },
  { namePt: 'Cadeira extensora', mechanic: 'isolado', keywords: ['leg extension'] },

  // Pernas - posterior/glúteo
  { namePt: 'Elevação pélvica (hip thrust)', mechanic: 'composto', keywords: ['hip thrust', 'glute bridge'] },
  { namePt: 'Stiff', mechanic: 'composto', keywords: ['stiff-legged deadlift', 'stiff leg deadlift'] },
  { namePt: 'Levantamento terra romeno', mechanic: 'composto', keywords: ['romanian deadlift'] },
  { namePt: 'Mesa flexora', mechanic: 'isolado', keywords: ['lying leg curl'] },
  { namePt: 'Cadeira flexora', mechanic: 'isolado', keywords: ['seated leg curl'] },
  { namePt: 'Cadeira abdutora', mechanic: 'isolado', keywords: ['hip abductor', 'abductor machine'] },
  { namePt: 'Cadeira adutora', mechanic: 'isolado', keywords: ['hip adductor', 'adductor machine'] },
  { namePt: 'Glúteo no cabo (coice)', mechanic: 'isolado', keywords: ['cable kickback', 'glute kickback'] },

  // Panturrilha
  { namePt: 'Panturrilha em pé', mechanic: 'isolado', keywords: ['standing calf raise'] },
  { namePt: 'Panturrilha sentado', mechanic: 'isolado', keywords: ['seated calf raise'] },
  { namePt: 'Panturrilha no leg press', mechanic: 'isolado', keywords: ['calf press', 'leg press calf raise'] },

  // Abdômen/core
  { namePt: 'Elevação de pernas na barra fixa', mechanic: 'composto', keywords: ['hanging leg raise'] },
  { namePt: 'Prancha isométrica', mechanic: 'composto', keywords: ['plank'] },
  { namePt: 'Abdominal na polia', mechanic: 'isolado', keywords: ['cable crunch'] },
  { namePt: 'Abdominal supra', mechanic: 'isolado', keywords: ['crunch', 'sit-up', 'sit up'] },
  { namePt: 'Abdominal infra', mechanic: 'isolado', keywords: ['leg raise'], exclude: ['hanging'] },
  { namePt: 'Rotação de tronco', mechanic: 'isolado', keywords: ['russian twist', 'oblique'] },
]

export function classifyExerciseName(name: string): CatalogEntry | null {
  const lower = name.toLowerCase()

  for (const entry of EXERCISE_CATALOG) {
    const isExcluded = (entry.exclude ?? []).some((word) => lower.includes(word))
    if (isExcluded) continue

    const matches = entry.keywords.some((keyword) => lower.includes(keyword))
    if (matches) return entry
  }

  return null
}
