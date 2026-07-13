# Motor de Prescrição Avançado — Design

## Contexto

O motor de regras atual (`lib/plan-engine/`) escolhe um split por frequência semanal e sorteia N exercícios por dia a partir da coluna `target` do exercício, sem controlar volume semanal por grupo muscular, sem considerar sinergistas, sem ordenar por complexidade do movimento, sem prescrever intensidade (RIR), e sem excluir exercícios por restrição física relatada. Isso gerou dois problemas reais observados em uso:

1. **Exercícios idênticos se repetindo em todos os dias e todas as semanas do mês** — a consulta que escolhe exercícios não tem randomização nem evita repetir o que já foi usado em outro dia da mesma semana, então sempre retorna as mesmas primeiras linhas do banco para o mesmo grupo alvo.
2. **Exercícios fora do contexto de uma academia convencional brasileira** aparecendo no plano (equipamentos/variações incomuns), por falta de um filtro de conteúdo além da exclusão pontual de "assistido"/"toalha" já existente.

Esta fase reconstrói a seleção de exercícios seguindo os princípios que um personal trainer real usaria: volume semanal por grupo muscular (contando sinergistas), intensidade por RIR, ordem de exercícios por complexidade, e exclusão de restrições e de exercícios fora de um catálogo de movimentos convencionais de academia.

**Fora de escopo desta fase** (ficam para fases seguintes, já combinado com o usuário):
- Periodização entre meses (semana de deload a cada 4-6 semanas)
- Progressão de carga condicionada ao desempenho real logado (RIR/reps efetivos) — por enquanto a progressão semana 1→4 continua com o cálculo fixo já existente (`calculateProgressiveLoad`)
- Menu de navegação para ver progressão mensal histórica

## 1. Onboarding: campos novos

O chat de onboarding (`lib/openai/client.ts`, `OnboardingProfile`) ganha três campos:

- `session_minutes: number` — tempo disponível por sessão, usado para calibrar quantos exercícios cabem no dia
- `age: number` e `sex: 'masculino' | 'feminino' | 'outro'` — usados para ajustar volume/intensidade recomendados
- `training_history: string | null` — texto curto livre sobre histórico de treino anterior (contexto para o nível informado, não estruturado)

O campo `restrictions` deixa de ser só texto solto e não utilizado. A ferramenta (`completar_onboarding`) passa a exigir também `excluded_targets: string[]` — uma lista estruturada de valores da coluna `exercise.target` a evitar, que a IA preenche ao interpretar a restrição relatada (ex.: "dor no ombro" → `["delts"]`). Isso respeita a regra fundamental do projeto: a IA só extrai sinais estruturados, quem decide o treino é sempre o motor determinístico. Se não houver restrição, `excluded_targets` é `[]`.

O prompt do sistema do onboarding também é reforçado para exigir que cada um dos campos obrigatórios seja perguntado explicitamente na conversa antes de chamar a ferramenta, corrigindo o bug observado de `days_per_week` sendo decidido sem confirmação clara com a pessoa.

## 2. Catálogo de exercícios convencionais

Em vez de um filtro por equipamento, a seleção passa a se basear numa lista curada de movimentos de academia convencional (fornecida pelo usuário), organizada por grupo muscular, cada um já classificado como **composto** (multiarticular) ou **isolado** (monoarticular). Exemplo (peito):

| Movimento | Classificação |
|---|---|
| Supino reto (barra ou halteres) | composto |
| Supino inclinado | composto |
| Supino declinado | composto |
| Flexão de braço | composto |
| Crucifixo reto/inclinado | isolado |
| Crossover (cabo) | isolado |
| Peck deck (voador) | isolado |

A lista completa (peito, costas, ombro, bíceps, tríceps, quadríceps, posterior/glúteo, panturrilha, abdômen) é a que o usuário passou na conversa e será transcrita integralmente no plano de implementação.

Um script novo casa cada exercício sincronizado da ExerciseDB (nome em inglês) contra padrões de nome derivados dessa lista (ex.: nome contém "bench press" e não contém "incline"/"decline" → Supino reto, composto, peito). Todo exercício que não casar com nenhum padrão da lista fica marcado como fora do catálogo e nunca é selecionado para um plano — esse é o próprio filtro de "nada de exercício maluco".

O filtro de equipamento já existente (`EXCLUDED_EQUIPMENT`, que exclui variantes assistidas manualmente/com toalha mas preserva máquinas assistidas legítimas) continua se aplicando em cima do catálogo — um exercício precisa casar com o catálogo **e** não estar na lista de equipamento excluído para ser elegível.

## 3. Modelo de dados

Migração aditiva (nenhuma tabela do CRM é tocada):

- `exercise.secondary_muscles text[]` — músculos secundários ativados, campo que a ExerciseDB já fornece (`secondaryMuscles`) e nunca sincronizamos; populado num re-sync
- `exercise.mechanic text check (mechanic in ('composto', 'isolado'))`, nullable — preenchido pelo script de match contra o catálogo; `null` = fora do catálogo, nunca selecionável
- `profile.session_minutes integer`, `profile.age integer`, `profile.sex text`, `profile.training_history text`, `profile.excluded_targets text[]`
- `workout_day_exercise.target_rir text` — ex.: `"2-3"`, `"0-2"`, exibido como orientação na tela de execução guiada

## 4. Volume semanal por grupo muscular (com sinergistas)

Tabela de faixas por nível (séries semanais por grupo muscular):

| Nível | Faixa semanal |
|---|---|
| Iniciante | 8-12 séries |
| Intermediário | 12-16 séries |
| Avançado | 16-20 séries |

Ao montar a semana 1 de um plano, o motor soma, por grupo muscular, as séries já alocadas: o exercício conta séries cheias no seu `target` principal e meia série em cada músculo listado em `secondary_muscles`. A seleção de exercícios para os dias da semana avança grupo a grupo até se aproximar do topo da faixa do nível informado, sem ultrapassar.

## 5. Variedade dentro da semana, consistência entre semanas

A seleção de exercícios passa a acontecer **uma vez por semana 1**, considerando todos os dias daquela semana juntos (não mais dia a dia isoladamente): um exercício já usado em um dia anterior da mesma semana não é escolhido de novo para outro dia da mesma semana, mesmo quando os dois dias compartilham o mesmo grupo alvo (caso do split Corpo Inteiro). As semanas 2, 3 e 4 **reaproveitam exatamente os mesmos exercícios da semana 1**, dia a dia — isso é intencional: é o que permite medir progressão de carga no mesmo exercício ao longo do mês (`calculateProgressiveLoad` já assume isso).

Se o catálogo elegível (depois de aplicar restrições e equipamento) não tiver exercícios suficientes para preencher um dia sem repetir dentro da mesma semana, o motor permite repetição dentro da semana como fallback, nessa ordem de preferência, em vez de deixar o dia com menos exercícios que o volume-alvo pede.

## 6. Ordem dos exercícios

Dentro de cada dia, a ordem final de inserção (`order_index`) segue: exercícios compostos do(s) grupo(s) principal(is) do dia primeiro, depois isolados do mesmo grupo, depois grupos secundários do dia — usando a classificação `mechanic` do catálogo.

## 7. RIR (prescrição)

Cada `workout_day_exercise` recebe um `target_rir` conforme o nível do perfil (iniciante 2-3, intermediário 1-2, avançado 0-2). A tela de execução guiada (`ExecucaoGuiada.tsx`) passa a exibir essa faixa como orientação ao lado de séries/reps (ex.: "3x10-12, RIR 2-3"). Não há captura de RIR real nem qualquer lógica de progressão condicionada a isso nesta fase — é só orientação exibida.

## 8. Exclusão por restrição

Na seleção de exercícios, qualquer `target` presente em `profile.excluded_targets` é removido do catálogo elegível para aquele plano inteiro (não apenas do dia em que apareceria "naturalmente"), como camada de segurança adicional.
