import type { ItemTreino, Treino } from './tipos'

const ESFORCO = '70% de esforço'

function serie(exercicio: string, repeticoes = '12', series = 3): ItemTreino {
  return { exercicio, series, repeticoes, carga: ESFORCO, descansoSegundos: 30 }
}

const AQUECIMENTO: ItemTreino = {
  exercicio: 'caminhada-na-esteira',
  series: 1,
  repeticoes: '10 minutos',
  carga: '6 km/h',
  descansoSegundos: 0,
}

function treino(slug: string, nome: string, grupo: string, itens: ItemTreino[]): Treino {
  return { slug, nome, colecao: 'parte', grupo, itens }
}

export const TREINOS_POR_PARTE: Treino[] = [
  treino('superiores-peito-costas-ombro', 'Peito, costas e ombro', 'Superiores', [
    AQUECIMENTO,
    serie('puxada-aberta-na-barra-reta'),
    serie('crucifixo-inclinado-com-halteres'),
    serie('remada-baixa-supinada'),
    serie('elevacao-lateral'),
    serie('puxada-fechada-na-barra-reta'),
    serie('crucifixo-com-halteres'),
    serie('elevacao-frontal-alternada'),
  ]),
  treino('superiores-bracos', 'Bíceps e tríceps', 'Superiores', [
    AQUECIMENTO,
    serie('rosca-direta-na-polia-barra-reta'),
    serie('triceps-na-polia-com-barra-w'),
    serie('rosca-direta-com-halteres'),
    serie('triceps-coice-com-halteres'),
    serie('rosca-direta-na-polia-baixa-com-corda'),
    serie('triceps-invertido-na-polia-com-barra'),
    serie('desenvolvimento-com-faixa-elastica'),
  ]),
  treino('inferiores-pernas-completo', 'Pernas completo', 'Inferiores', [
    AQUECIMENTO,
    serie('leg-press-45'),
    serie('cadeira-extensora'),
    serie('mesa-flexora'),
    serie('agachamento-sumo-com-halter'),
    serie('cadeira-flexora'),
    serie('avanco', '12 cada perna'),
    serie('panturrilha-no-step', '20'),
  ]),
  treino('inferiores-coxa-e-adutores', 'Coxa e adutores', 'Inferiores', [
    AQUECIMENTO,
    serie('agachamento-na-polia-baixa'),
    serie('recuo-com-halteres', '12 cada perna'),
    serie('cadeira-flexora-unilateral', '12 cada perna'),
    serie('aducao-de-quadril-na-maquina'),
    serie('extensao-de-perna-sentada-com-caneleira', '40 segundos'),
    serie('flexora-deitada-com-halter-entre-as-pernas'),
    serie('agachamento-isometrico-com-panturrilha', '30 segundos'),
  ]),
  treino('gluteo', 'Glúteo', 'Glúteo', [
    AQUECIMENTO,
    serie('elevacao-pelvica-no-step-com-elastico', '15'),
    serie('abducao-de-quadril-na-maquina'),
    serie('extensao-de-quadril-em-pe-com-elastico', '12 cada perna'),
    serie('agachamento-com-abducao-alternada'),
    serie('abducao-de-quadril-na-polia-baixa-unilateral', '12 cada perna'),
    serie('abducao-em-decubito-lateral-com-elastico', '15 cada perna'),
  ]),
  treino('abdomen', 'Abdômen', 'Abdômen', [
    serie('abdominal-remador'),
    { ...serie('abdominal-infra-com-pernas-estendidas'), observacao: 'Movimento curto' },
    serie('abdominal-supra-na-bola-suica'),
    serie('abdominal-tesoura', '20'),
    serie('abdominal-infra-bike', '20'),
    serie('prancha-frontal', '30 segundos'),
  ]),
  treino('cardio-intervalado', 'Cardio intervalado', 'Cardio', [
    AQUECIMENTO,
    serie('burpee-adaptado', '10'),
    { ...AQUECIMENTO, repeticoes: '5 minutos' },
    serie('mini-jump', '30 segundos'),
    { ...AQUECIMENTO, repeticoes: '5 minutos' },
    serie('agachamento-com-desenvolvimento-halter-no-chao', '15'),
    { ...AQUECIMENTO, repeticoes: '5 minutos' },
  ]),
  treino('cardio-esteira-30', 'Esteira 30 minutos', 'Cardio', [
    { ...AQUECIMENTO, repeticoes: '30 minutos' },
  ]),
]
