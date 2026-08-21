import type { Mechanic } from './exercise-catalog'

// Por que este arquivo existe: a coluna `target` vem da ExerciseDB e não é
// confiável pra montar treino. Agachamento livre, hack e leg press estão
// todos como "glutes"; um dia de "quads" sobrava com 10 exercícios, entre
// eles agachamento ajoelhado e lunge no degrau. Aqui a unidade de seleção
// passa a ser o MOVIMENTO tradicional de academia, e cada movimento sabe
// achar sozinho o exercício real correspondente no banco.

export const MUSCLE_GROUPS = [
  'peito',
  'costas',
  'ombro',
  'biceps',
  'triceps',
  'quadriceps',
  'posterior',
  'gluteo',
  'panturrilha',
  'core',
  'antebraco',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

// Qualidades físicas que sustentam o beach tennis: salto e arranque curto na
// areia, giro de tronco pra bater, ombro que aguenta smash e saque, tornozelo
// e panturrilha pra piso instável, e preensão pra raquete.
export const BEACH_QUALITIES = [
  'potencia_salto',
  'core_rotacional',
  'ombro_estavel',
  'tornozelo_panturrilha',
  'preensao',
] as const

export type BeachQuality = (typeof BEACH_QUALITIES)[number]

export type Movement = {
  id: string
  namePt: string
  group: MuscleGroup
  mechanic: Mechanic
  include: RegExp[]
  exclude?: RegExp[]
  // ordem de preferência de equipamento pra escolher a variação padrão
  prefer?: string[]
  beach?: BeachQuality[]
}

// Descarta variação acrobática, instável ou de reabilitação em qualquer
// movimento: não é o que se faz num treino tradicional de academia.
export const GLOBAL_EXCLUDE: RegExp[] = [
  /jump|plyo|depth|hop\b|explosive|clap/,
  /\bon knees\b|kneeling(?! leg curl)/,
  /assisted/,
  /stability ball|exercise ball|bosu|medicine ball|roller|wheel/,
  /suspension|trx|sling/,
  /stretch|pose|mobility|warm ?up/,
  /with (twist|bicep curl|swing|bowling|kick)/,
  /\(female\)|\bpov\b/,
]

const GYM_FIRST = ['leverage machine', 'barbell', 'smith machine', 'cable', 'dumbbell', 'ez barbell']

export const MOVEMENTS: Movement[] = [
  // ---------- Peito ----------
  { id: 'supino-reto', namePt: 'Supino reto', group: 'peito', mechanic: 'composto', include: [/bench press/], exclude: [/incline|decline|close|reverse|neutral|jm|floor|one arm|single/], prefer: ['barbell', 'dumbbell', 'smith machine', 'leverage machine'] },
  { id: 'supino-inclinado', namePt: 'Supino inclinado', group: 'peito', mechanic: 'composto', include: [/incline.*(bench press|press)/], exclude: [/close|reverse|fly|flye|one arm/], prefer: ['barbell', 'dumbbell', 'smith machine'] },
  { id: 'supino-declinado', namePt: 'Supino declinado', group: 'peito', mechanic: 'composto', include: [/decline.*(bench press|press)/], exclude: [/close|fly|flye/], prefer: ['barbell', 'dumbbell', 'smith machine'] },
  { id: 'crucifixo', namePt: 'Crucifixo', group: 'peito', mechanic: 'isolado', include: [/\bfly\b|\bflye\b|\bflyes\b/], exclude: [/reverse|rear/], prefer: ['dumbbell', 'cable', 'leverage machine'] },
  { id: 'crossover', namePt: 'Crossover na polia', group: 'peito', mechanic: 'isolado', include: [/crossover/], exclude: [/row|seated row/], prefer: ['cable'] },
  { id: 'flexao', namePt: 'Flexão de braço', group: 'peito', mechanic: 'composto', include: [/push-?up/], exclude: [/close|diamond|handstand|pike|one arm|single|incline push-?up depth/], prefer: ['body weight'] },

  // ---------- Costas ----------
  { id: 'puxada-frontal', namePt: 'Puxada frontal', group: 'costas', mechanic: 'composto', include: [/lat(eral)? pulldown|pulldown/], exclude: [/straight arm|straight-arm|behind|rocky/], prefer: ['cable', 'leverage machine'] },
  { id: 'remada-baixa', namePt: 'Remada baixa na polia', group: 'costas', mechanic: 'composto', include: [/seated row|cable row|seated cable row/], exclude: [/rear delt|face/], prefer: ['cable', 'leverage machine'] },
  { id: 'remada-curvada', namePt: 'Remada curvada', group: 'costas', mechanic: 'composto', include: [/bent[- ]over row|bent over row/], exclude: [/rear delt|rotational|reverse fly|lever|one arm|reverse grip/], prefer: ['barbell', 'dumbbell', 'smith machine'] },
  { id: 'remada-unilateral', namePt: 'Remada unilateral com halter', group: 'costas', mechanic: 'composto', include: [/one arm.*row|single.*arm.*row/], exclude: [/rear delt|upright/], prefer: ['dumbbell'] },
  { id: 'remada-cavalinho', namePt: 'Remada cavalinho (T-bar)', group: 'costas', mechanic: 'composto', include: [/t[- ]bar row/], prefer: ['leverage machine', 'barbell'] },
  { id: 'barra-fixa', namePt: 'Barra fixa', group: 'costas', mechanic: 'composto', include: [/pull-?up|chin-?up/], exclude: [/pulldown|rocky|muscle up/], prefer: ['body weight'] },
  { id: 'pullover-polia', namePt: 'Pulldown com braço estendido', group: 'costas', mechanic: 'isolado', include: [/straight[- ]arm pulldown|pullover/], prefer: ['cable', 'dumbbell'] },
  { id: 'levantamento-terra', namePt: 'Levantamento terra', group: 'costas', mechanic: 'composto', include: [/deadlift/], exclude: [/romanian|stiff|straight leg|single leg|one leg|sumo/], prefer: ['barbell', 'trap bar'] },
  { id: 'hiperextensao', namePt: 'Hiperextensão lombar', group: 'costas', mechanic: 'isolado', include: [/hyperextension|back extension/], prefer: ['body weight', 'leverage machine'] },

  // ---------- Ombro ----------
  { id: 'desenvolvimento', namePt: 'Desenvolvimento', group: 'ombro', mechanic: 'composto', include: [/shoulder press|overhead press|military press/], exclude: [/behind head|behind the neck|to the side|one arm|single|arnold/], prefer: ['leverage machine', 'barbell', 'dumbbell', 'smith machine'], beach: ['ombro_estavel'] },
  { id: 'elevacao-lateral', namePt: 'Elevação lateral', group: 'ombro', mechanic: 'isolado', include: [/lateral raise/], exclude: [/rear|bent|lying|incline|one arm/], prefer: ['dumbbell', 'cable', 'leverage machine'], beach: ['ombro_estavel'] },
  { id: 'elevacao-frontal', namePt: 'Elevação frontal', group: 'ombro', mechanic: 'isolado', include: [/front raise/], exclude: [/one arm|single/], prefer: ['dumbbell', 'cable', 'barbell'] },
  { id: 'crucifixo-inverso', namePt: 'Crucifixo inverso', group: 'ombro', mechanic: 'isolado', include: [/reverse fly|reverse flye|rear delt|rear lateral raise/], prefer: ['dumbbell', 'cable', 'leverage machine'], beach: ['ombro_estavel'] },
  { id: 'rotacao-externa', namePt: 'Rotação externa de ombro', group: 'ombro', mechanic: 'isolado', include: [/external rotation/], prefer: ['cable', 'dumbbell'], beach: ['ombro_estavel'] },
  { id: 'remada-alta', namePt: 'Remada alta', group: 'ombro', mechanic: 'composto', include: [/upright row/], prefer: ['barbell', 'cable', 'dumbbell'] },
  { id: 'encolhimento', namePt: 'Encolhimento de ombros', group: 'ombro', mechanic: 'isolado', include: [/shrug/], exclude: [/one arm|single/], prefer: ['barbell', 'dumbbell', 'smith machine'] },

  // ---------- Bíceps ----------
  { id: 'rosca-direta', namePt: 'Rosca direta', group: 'biceps', mechanic: 'isolado', include: [/barbell curl|ez[- ]?barbell curl|bicep curl/], exclude: [/preacher|concentration|hammer|reverse|one arm|lunge|incline/], prefer: ['barbell', 'ez barbell'] },
  { id: 'rosca-alternada', namePt: 'Rosca alternada', group: 'biceps', mechanic: 'isolado', include: [/alternate.*curl|alternating.*curl/], exclude: [/hammer|reverse|preacher/], prefer: ['dumbbell'] },
  { id: 'rosca-martelo', namePt: 'Rosca martelo', group: 'biceps', mechanic: 'isolado', include: [/hammer curl/], prefer: ['dumbbell', 'cable'] },
  { id: 'rosca-scott', namePt: 'Rosca scott', group: 'biceps', mechanic: 'isolado', include: [/preacher curl/], prefer: ['ez barbell', 'barbell', 'dumbbell', 'leverage machine'] },
  { id: 'rosca-concentrada', namePt: 'Rosca concentrada', group: 'biceps', mechanic: 'isolado', include: [/concentration curl/], prefer: ['dumbbell'] },
  { id: 'rosca-polia', namePt: 'Rosca na polia', group: 'biceps', mechanic: 'isolado', include: [/cable.*curl/], exclude: [/hammer|reverse|preacher|one arm|triceps/], prefer: ['cable'] },

  // ---------- Tríceps ----------
  { id: 'triceps-pulley', namePt: 'Tríceps na polia', group: 'triceps', mechanic: 'isolado', include: [/pushdown|push-down/], exclude: [/one arm|single/], prefer: ['cable'] },
  { id: 'triceps-testa', namePt: 'Tríceps testa', group: 'triceps', mechanic: 'isolado', include: [/skull crusher|lying triceps (extension|press)/], prefer: ['ez barbell', 'barbell', 'dumbbell'] },
  { id: 'triceps-frances', namePt: 'Tríceps francês', group: 'triceps', mechanic: 'isolado', include: [/overhead triceps|seated triceps (extension|press)|french press/], prefer: ['dumbbell', 'cable', 'ez barbell'] },
  { id: 'triceps-coice', namePt: 'Tríceps coice', group: 'triceps', mechanic: 'isolado', include: [/kickback/], exclude: [/glute|hip/], prefer: ['dumbbell', 'cable'] },
  { id: 'supino-fechado', namePt: 'Supino fechado', group: 'triceps', mechanic: 'composto', include: [/close[- ]grip bench press/], prefer: ['barbell', 'smith machine', 'ez barbell'] },
  { id: 'paralelas', namePt: 'Mergulho nas paralelas', group: 'triceps', mechanic: 'composto', include: [/\bdip\b|\bdips\b|triceps dip/], exclude: [/assisted|bench dip machine/], prefer: ['body weight', 'leverage machine'] },

  // ---------- Quadríceps ----------
  { id: 'agachamento-livre', namePt: 'Agachamento livre', group: 'quadriceps', mechanic: 'composto', include: [/barbell (full |back |low bar )?squat$|^barbell squat/], exclude: [/bench|on knees|jump|front|split|single|hack|zercher|sumo/], prefer: ['barbell'], beach: ['potencia_salto'] },
  { id: 'agachamento-smith', namePt: 'Agachamento no Smith', group: 'quadriceps', mechanic: 'composto', include: [/smith (low bar |full )?squat$|smith machine squat/], exclude: [/hack|chair|split|single|front/], prefer: ['smith machine'], beach: ['potencia_salto'] },
  { id: 'hack-machine', namePt: 'Hack machine', group: 'quadriceps', mechanic: 'composto', include: [/hack squat/], exclude: [/barbell hack/], prefer: ['sled machine', 'smith machine', 'leverage machine'], beach: ['potencia_salto'] },
  { id: 'leg-press', namePt: 'Leg press 45°', group: 'quadriceps', mechanic: 'composto', include: [/leg press|45.*press/], exclude: [/calf|one leg|single|horizontal one/], prefer: ['sled machine', 'leverage machine', 'smith machine'], beach: ['potencia_salto'] },
  { id: 'cadeira-extensora', namePt: 'Cadeira extensora', group: 'quadriceps', mechanic: 'isolado', include: [/leg extension/], exclude: [/band|single|one leg/], prefer: ['leverage machine'] },
  { id: 'afundo', namePt: 'Afundo (passada)', group: 'quadriceps', mechanic: 'composto', include: [/\blunge\b|walking lunge|rear lunge/], exclude: [/twist|curl|swing|jump|step[- ]?up|bowling|side lunge/], prefer: ['barbell', 'dumbbell', 'smith machine'], beach: ['potencia_salto'] },

  // ---------- Posterior ----------
  { id: 'stiff', namePt: 'Stiff (terra romeno)', group: 'posterior', mechanic: 'composto', include: [/romanian deadlift|stiff leg deadlift|straight leg deadlift/], exclude: [/single|one leg|stepbox|good morning/], prefer: ['barbell', 'dumbbell'], beach: ['potencia_salto'] },
  { id: 'mesa-flexora', namePt: 'Mesa flexora', group: 'posterior', mechanic: 'isolado', include: [/lying leg curl/], exclude: [/two-one|inverse|band/], prefer: ['leverage machine'] },
  { id: 'cadeira-flexora', namePt: 'Cadeira flexora', group: 'posterior', mechanic: 'isolado', include: [/seated leg curl/], exclude: [/band/], prefer: ['leverage machine'] },
  { id: 'flexora-em-pe', namePt: 'Flexora em pé', group: 'posterior', mechanic: 'isolado', include: [/standing.*leg curl|kneeling leg curl/], exclude: [/band|inverse/], prefer: ['leverage machine', 'cable'] },
  { id: 'bom-dia', namePt: 'Bom dia (good morning)', group: 'posterior', mechanic: 'composto', include: [/good morning/], prefer: ['barbell'] },

  // ---------- Glúteo ----------
  { id: 'elevacao-pelvica', namePt: 'Elevação pélvica (hip thrust)', group: 'gluteo', mechanic: 'composto', include: [/hip thrust|glute bridge/], exclude: [/march|on floor|single|one leg/], prefer: ['barbell', 'leverage machine'], beach: ['potencia_salto'] },
  { id: 'gluteo-polia', namePt: 'Glúteo na polia (coice)', group: 'gluteo', mechanic: 'isolado', include: [/glute kickback|cable.*kickback|hip extension/], exclude: [/triceps/], prefer: ['cable', 'leverage machine'] },
  { id: 'cadeira-abdutora', namePt: 'Cadeira abdutora', group: 'gluteo', mechanic: 'isolado', include: [/hip abduction|abductor/], exclude: [/band/], prefer: ['leverage machine', 'cable'] },
  { id: 'terra-sumo', namePt: 'Levantamento terra sumô', group: 'gluteo', mechanic: 'composto', include: [/sumo deadlift|sumo.*squat/], exclude: [/high pull/], prefer: ['barbell', 'dumbbell'] },

  // ---------- Panturrilha ----------
  { id: 'panturrilha-em-pe', namePt: 'Panturrilha em pé', group: 'panturrilha', mechanic: 'isolado', include: [/standing calf raise/], exclude: [/staircase|one leg|single|band/], prefer: ['leverage machine', 'smith machine', 'barbell', 'cable'], beach: ['tornozelo_panturrilha'] },
  { id: 'panturrilha-sentado', namePt: 'Panturrilha sentado', group: 'panturrilha', mechanic: 'isolado', include: [/seated calf raise/], exclude: [/one leg|single|band/], prefer: ['leverage machine', 'barbell', 'dumbbell'], beach: ['tornozelo_panturrilha'] },
  { id: 'panturrilha-leg-press', namePt: 'Panturrilha no leg press', group: 'panturrilha', mechanic: 'isolado', include: [/calf press/], exclude: [/one leg|single/], prefer: ['sled machine', 'leverage machine'], beach: ['tornozelo_panturrilha'] },

  // ---------- Core ----------
  { id: 'prancha', namePt: 'Prancha isométrica', group: 'core', mechanic: 'composto', include: [/front plank|^plank/], exclude: [/side|reverse|tap|leg lift|walk|up down|jack/], prefer: ['body weight', 'weighted'], beach: ['core_rotacional'] },
  { id: 'abdominal-polia', namePt: 'Abdominal na polia', group: 'core', mechanic: 'isolado', include: [/cable.*crunch/], exclude: [/side|reverse|tuck|bosu|bend/], prefer: ['cable'], beach: ['core_rotacional'] },
  { id: 'abdominal-supra', namePt: 'Abdominal supra', group: 'core', mechanic: 'isolado', include: [/\bcrunch\b|sit-?up/], exclude: [/cable|oblique|twist|bicycle|jack ?knife|3\/4|groin|negative|tuck|cross body|knee touch|band|side|reverse|frog|toe/], prefer: ['leverage machine', 'body weight', 'weighted'] },
  { id: 'elevacao-pernas', namePt: 'Elevação de pernas na barra', group: 'core', mechanic: 'composto', include: [/hanging (straight )?leg raise|captains chair/], exclude: [/twisted|side|throw/], prefer: ['body weight'] },
  { id: 'rotacao-tronco-barra', namePt: 'Rotação de tronco com barra', group: 'core', mechanic: 'composto', include: [/(seated|standing) twist$|torso rotation|wood ?chop/], exclude: [/lunge|row|fly|press|crunch|leg/], prefer: ['barbell', 'cable', 'leverage machine'], beach: ['core_rotacional'] },
  { id: 'rotacao-russa', namePt: 'Rotação de tronco (russian twist)', group: 'core', mechanic: 'isolado', include: [/russian twist/], prefer: ['body weight', 'weighted'], beach: ['core_rotacional'] },

  // ---------- Antebraço ----------
  { id: 'rosca-punho', namePt: 'Rosca de punho', group: 'antebraco', mechanic: 'isolado', include: [/wrist curl/], exclude: [/reverse/], prefer: ['barbell', 'dumbbell', 'cable'], beach: ['preensao'] },
  { id: 'rosca-inversa', namePt: 'Rosca inversa (punho)', group: 'antebraco', mechanic: 'isolado', include: [/reverse.*wrist curl|reverse curl/], prefer: ['barbell', 'ez barbell', 'cable'], beach: ['preensao'] },
]

export const MOVEMENTS_BY_ID = new Map(MOVEMENTS.map((movement) => [movement.id, movement]))

export function movementsForGroup(group: MuscleGroup): Movement[] {
  return MOVEMENTS.filter((movement) => movement.group === group)
}

export function movementsForBeachQuality(quality: BeachQuality): Movement[] {
  return MOVEMENTS.filter((movement) => movement.beach?.includes(quality))
}

export type CatalogExercise = {
  id: string
  name: string
  namePt: string | null
  equipment: string | null
}

function matches(movement: Movement, name: string): boolean {
  if (GLOBAL_EXCLUDE.some((pattern) => pattern.test(name))) return false
  if ((movement.exclude ?? []).some((pattern) => pattern.test(name))) return false
  return movement.include.some((pattern) => pattern.test(name))
}

export function findMovementForName(name: string): Movement | null {
  const lower = name.toLowerCase()
  return MOVEMENTS.find((movement) => matches(movement, lower)) ?? null
}

/**
 * Escolhe a variação padrão de um movimento entre os exercícios reais do
 * banco: primeiro o equipamento que a academia usa pra aquele movimento,
 * depois o nome mais simples (variação "v. 3", "(back pov)" e afins ficam
 * por último).
 */
export function pickVariation(movement: Movement, exercises: CatalogExercise[]): CatalogExercise | null {
  const candidates = exercises.filter((exercise) => matches(movement, exercise.name.toLowerCase()))

  if (candidates.length === 0) return null

  const preference = movement.prefer ?? GYM_FIRST

  const rank = (exercise: CatalogExercise): number => {
    const equipmentRank = preference.indexOf(exercise.equipment ?? '')
    return equipmentRank === -1 ? preference.length : equipmentRank
  }

  return [...candidates].sort((a, b) => {
    const byEquipment = rank(a) - rank(b)
    if (byEquipment !== 0) return byEquipment
    return a.name.length - b.name.length
  })[0]
}
