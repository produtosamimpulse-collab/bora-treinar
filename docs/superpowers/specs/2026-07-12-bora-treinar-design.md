# Bora Treinar! — Design

**Data:** 2026-07-12
**Status:** Aprovado para planejamento de implementação

## 1. Visão geral

Bora Treinar! é um web app pessoal (PWA) onde uma IA atua como personal trainer completo: conduz uma entrevista inicial em conversa livre para entender o aluno, monta um plano de treino mensal com estratégia real de evolução (progressão de carga, periodização), guia a execução de cada treino com timer de descanso, registra o desempenho de cada sessão, e ao fim de cada mês faz um check-in em formato de conversa para revisar o ciclo e gerar o próximo mês já mais afinado — como um personal trainer de verdade, que vai conhecendo o aluno e refinando a estratégia ao longo do tempo.

Uso pessoal (não é um produto para venda/multi-tenant). Escopo: apenas treino — sem nutrição, sem wearables, sem fotos de progresso.

## 2. Arquitetura técnica

- **Stack:** Next.js (App Router) + Supabase (Postgres + Auth) + Vercel (deploy) — mesma base do InstBot e Am Reportei
- **Autenticação:** Supabase Auth, login simples (email/senha). Suporta 1 usuário hoje; não precisa de redesenho para adicionar mais alguém no futuro.
- **IA conversacional:** API da OpenAI, modelo `gpt-5.4-nano`, usada em dois momentos: onboarding inicial e check-in mensal. Usa saída estruturada (structured output / tool calling) para extrair da conversa um JSON com os dados relevantes.
  - *Nota de implementação:* confirmar o identificador exato do modelo na documentação da OpenAI antes de integrar — é um modelo lançado após a base de conhecimento usada neste planejamento.
- **Motor de regras:** lógica determinística em TypeScript (server actions / API routes do Next.js). É a única camada que decide o conteúdo do treino — a IA nunca decide isso diretamente, apenas fornece sinais extraídos das conversas.
- **Biblioteca de exercícios:** API pública de exercícios (ex: ExerciseDB ou wger) para nome, instrução, grupo muscular e GIF/vídeo demonstrativo. Resultado cacheado/salvo no Supabase para não depender de disponibilidade externa em tempo real.

## 3. Modelo de dados (entidades principais)

- **`profile`** — objetivo (emagrecimento / hipertrofia / condicionamento / etc.), nível, dias disponíveis por semana, equipamento/local de treino, restrições/lesões, transcrição do onboarding (auditoria)
- **`exercise`** — catálogo de exercícios: nome, instrução, grupo muscular, GIF/vídeo, equipamento necessário
- **`training_plan`** — ciclo mensal vigente: objetivo, fase de periodização, mês/ano de referência
- **`workout_day`** — um treino dentro do plano mensal (ex: "Treino A — Peito/Tríceps"), com exercícios prescritos (séries, reps-alvo, carga sugerida, tempo de descanso), já com a progressão semana a semana definida no momento da geração do mês
- **`workout_session`** — registro real de um treino executado: data, exercícios feitos, carga/reps reais por série, duração, status de conclusão
- **`monthly_checkin`** — fechamento do mês: resumo da conversa, sinais extraídos (dor, motivação, dificuldade, energia), decisão de ajuste aplicada pelo motor de regras para o próximo mês
- **`body_metric`** — peso corporal e medidas, registrados 1x por mês (vinculado ao `monthly_checkin`)

## 4. Fluxo de onboarding (primeira vez)

Conversa livre com a IA, que vai extraindo naturalmente: objetivo, nível, dias disponíveis, equipamento/local de treino, lesões/restrições. Ao final da conversa, a IA extrai os dados em JSON estruturado, que alimenta o motor de regras para gerar o `training_plan` do primeiro mês.

## 5. Execução guiada do treino (uso diário)

Ao abrir o treino do dia (já definido no plano mensal vigente), o app conduz exercício por exercício: mostra o exercício atual (nome, GIF, séries/reps/carga alvo), a pessoa registra o que realmente fez em cada série, e o app dispara um timer de descanso entre séries/exercícios. Ao concluir, o treino é salvo como `workout_session`. Esse registro não dispara nenhum ajuste automático — é apenas dado bruto para o fechamento do mês.

## 6. Motor de regras: estratégia de progressão mensal

Núcleo determinístico do "personal trainer":

- **Geração do mês:** a partir do `profile` (e, a partir do 2º mês, do histórico acumulado), monta um mesociclo de 4 semanas com progressão de carga/volume planejada semana a semana, podendo incluir semana de deload conforme a fase de periodização.
- **Fechamento do mês:** cruza três fontes de dado — (1) `workout_session`s do mês (aderência, cargas reais vs. prescritas), (2) `body_metric` do mês, (3) sinais extraídos da conversa de check-in — para decidir o plano do mês seguinte.
- **Guarda-corpos de segurança (guardrails):** limites explícitos no código, nunca decididos pela IA:
  - nunca aumentar carga/volume além de um percentual máximo por ciclo
  - reduzir volume ou trocar exercício automaticamente diante de sinal de dor
  - se a aderência do mês foi baixa (poucos treinos concluídos), não avançar a progressão — manter ou simplificar o próximo mês em vez de aumentar carga sobre uma base não consolidada

## 7. Check-in mensal

Ao fechar as 4 semanas do mês, a pessoa informa peso/medidas (`body_metric`) e conversa livremente com a IA sobre como foi o mês (energia, dores, dificuldades, sensação de evolução). A IA extrai os sinais em JSON (`monthly_checkin`); o motor de regras cruza com os dados objetivos do mês e do histórico anterior e gera o `training_plan` do mês seguinte.

## 8. Progresso e histórico

Tela de evolução com: gráfico de carga ao longo dos meses por exercício principal (ex: supino, agachamento), gráfico de peso corporal/medidas, e resumo textual gerado a partir do histórico (ex: "você evoluiu X% de carga no supino nos últimos 3 meses"). Serve tanto para acompanhamento visual quanto como contexto para a IA nas conversas futuras.

## 9. Design visual

**Atualizado após a Fase 2** — a paleta original (verde água `#2DD4BF`) foi substituída por verde-limão vibrante (`#C8FF00`, mesma cor da marca AM Impulse), com uma linguagem visual mais "premium/editorial": fundo claro, texto preto, tipografia de destaque grande e condensada em caixa alta (fonte Anton para títulos, Geist para o resto), cards com elevação (sombra suave, cantos arredondados, fundo levemente destacado do branco puro via token `surface`), glow/brilho radial sutil atrás de elementos centrais, e selos numerados (01, 02, 03...) marcando seções. Tokens Tailwind: `bg-background`, `text-foreground`, `bg-brand`/`text-brand`, `bg-surface`, `border-border-subtle`, fonte `font-display`.

## 10. Fora de escopo (por enquanto)

- Nutrição/dieta
- Múltiplos usuários pagantes, planos, billing
- Integração com wearables (relógios/smartwatches)
- Fotos de progresso

## 11. Tratamento de erros e casos de borda

- **Falha na API da OpenAI durante onboarding/check-in:** permitir novo envio da conversa sem perder o que já foi dito; não travar o usuário sem conseguir gerar/ajustar o plano.
- **Falha ao buscar exercício na API pública:** usar dado já cacheado no Supabase; se não houver cache, exibir exercício sem mídia (texto apenas) em vez de bloquear o treino.
- **Usuário não faz o check-in mensal:** o app deve sinalizar que o ciclo está pendente de fechamento; o plano do mês anterior permanece ativo até o check-in ser feito (não gera plano novo sem os dados do fechamento).
- **Dados extraídos da IA incompletos/ambíguos:** o motor de regras deve ter valores padrão seguros (ex: assumir nível "iniciante" e volume conservador) em vez de falhar a geração do plano.
