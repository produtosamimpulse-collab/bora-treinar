# Fase 3 — Onboarding Conversacional + Geração do Primeiro Mês — Design

**Data:** 2026-07-12
**Status:** Aprovado para planejamento de implementação
**Depende de:** Fase 1 (Fundação), Fase 2 (Biblioteca de Exercícios — 1394 exercícios sincronizados)

## 1. Visão geral

Esta fase entrega o primeiro fluxo em que o "Bora Treinar!" realmente age como personal trainer: uma conversa livre com IA (onboarding) extrai o perfil da pessoa, e um motor de regras determinístico gera o primeiro mês de treino — com uma semana de calibração (sem carga prescrita) seguida de três semanas de progressão baseada em dados reais registrados pela própria pessoa. A IA nunca decide o conteúdo do treino; ela só conduz a conversa e extrai sinais estruturados.

## 2. Pré-requisito técnico: enriquecer a tabela `exercise` com `target`

A Fase 2 salvou apenas o campo `bodyPart` da ExerciseDB (ex: "chest", "upper arms") na coluna `muscle_group`. Para montar a divisão Push/Pull/Legs corretamente, é necessário o campo mais específico `target` da API (ex: "triceps" vs "biceps", ambos hoje agrupados em "upper arms"). Esta fase adiciona:

- Migration: `alter table exercise add column target text;`
- Ajuste em `lib/exercisedb/client.ts` (tipo já tem o campo `target` — só precisa parar de ser descartado) e `lib/exercisedb/map.ts` (incluir `target` no `ExerciseRow`)
- Novo `npm run sync:exercises` para repopular os 1394 exercícios já existentes com o campo `target` (via `upsert` em `external_id`, idempotente — não duplica nada). Custa ~130 requisições da cota da ExerciseDB (havia ~550 restantes ao final da Fase 2).

## 3. Onboarding conversacional

- **Interface:** chat estilo mensageiro em `/onboarding`, componente client-side, histórico de mensagens na tela
- **Backend:** API route `/api/onboarding/chat` recebe o histórico da conversa + nova mensagem do usuário, chama a API da OpenAI (`gpt-5.4-nano`) com uma tool `completar_onboarding` definida
- **Extração:** a IA decide sozinha, ao longo da conversa, quando já tem objetivo, nível, dias disponíveis, equipamento/local e restrições/lesões suficientes — nesse momento ela chama a tool `completar_onboarding` com esses campos estruturados, em vez de continuar perguntando
- **Ao completar:** a API route salva o registro em `profile` (incluindo `onboarding_transcript` com o texto bruto da conversa inteira, para auditoria), dispara o motor de regras (função TypeScript pura) para gerar o `training_plan` do primeiro mês, e retorna sucesso para o front redirecionar para a tela do plano gerado

## 4. Motor de regras: escolha da divisão de treino (split)

100% automático, baseado na frequência semanal informada — sem opção de escolha manual pela pessoa (a IA/motor decide, como um personal de verdade decidiria):

- **2-3 dias/semana → Full Body:** cada sessão trabalha o corpo inteiro
- **3-4 dias/semana → Upper/Lower:** alterna superior e inferior
- **4-6 dias/semana → Push/Pull/Legs:** empurra / puxa / pernas, repetindo o ciclo se forem 5-6 dias

O equipamento/local e as restrições captadas no onboarding filtram automaticamente quais exercícios do catálogo entram no plano (ex: sem equipamento → só exercícios de peso corporal).

Mapeamento de `target`/`muscle_group` para cada dia da divisão (tabela de referência no código, determinística):
- **Push:** chest, shoulders, triceps
- **Pull:** back, biceps, forearms
- **Legs:** upper legs, lower legs, abs/core
- **Upper (Upper/Lower):** chest, back, shoulders, triceps, biceps
- **Lower (Upper/Lower):** upper legs, lower legs, abs/core
- **Full Body:** um exercício de cada padrão de movimento (empurrar, puxar, dobradiça de quadril, agachar, core) por sessão

## 5. Volume, intensidade e seleção de exercícios

Tabelas de referência fixas no motor de regras (não vêm de IA nem de cálculo dinâmico):

| Objetivo | Séries | Reps | Descanso |
|---|---|---|---|
| Hipertrofia | 3-4 | 8-12 | 60-90s |
| Emagrecimento/condicionamento | 3 | 12-15 | 45-60s |
| Saúde geral | 2-3 | 10-12 | 60s |

Exercícios por sessão: 5-6 (Full Body), 6-7 (Upper/Lower), 4-5 (Push/Pull/Legs). Multiarticulares (identificados por uma lista de padrões de nome/target conhecidos, ex: agachamento, supino, remada, levantamento terra) entram primeiro na sessão; isolados depois.

## 6. Geração do primeiro mês (mesociclo de 4 semanas)

- **Semana 1 — calibração:** `workout_day_exercise.target_load_kg` fica `null` para todos os exercícios. Durante a execução, a pessoa registra a carga real usada (já suportado pelo schema da Fase 1, em `workout_session_set.load_kg`).
- **Semanas 2-4 — progressão:** o motor lê a carga registrada na semana 1 (mesmo exercício, quando disponível) e aplica incremento fixo: +5% na semana 2, +5% na semana 3, +2,5% na semana 4. Reps-alvo continuam fixos na faixa do objetivo (só a carga sugerida muda).
- **Sem deload no mês 1** — não há histórico de meses anteriores ainda para justificar uma semana de deload; essa lógica (já prevista no motor de regras da Fase 1) entra a partir do mês 2.

## 7. Guardrails de segurança

- Trava explícita no código: nunca sugerir incremento de carga acima de 5% por semana, independente do que as tabelas de referência calculem
- Se a pessoa não registrou a calibração de um exercício específico na semana 1, a semana 2 desse mesmo exercício também fica sem carga prescrita (nunca inventa um número sem dado real)

## 8. Tela de resultado

Após o onboarding, redireciona para uma tela simples (`/plano`) mostrando o treino da semana atual (dia, exercícios, séries/reps, carga quando disponível) — confirma visualmente que a geração funcionou. O modo de execução guiada completo (timer, registro de séries) é uma fase futura; aqui é só leitura.

## 9. Fora de escopo desta fase

- Execução guiada do treino com timer (fase futura)
- Check-in mensal / geração do mês 2 em diante (fase futura, precisa de histórico)
- Refinamento de deload (só entra a partir do mês 2)
- Edição manual do plano pela pessoa

## 10. Tratamento de erros e casos de borda

- **Falha na API da OpenAI durante a conversa:** permitir reenvio da última mensagem sem perder o histórico já construído
- **IA chama `completar_onboarding` com campos incompletos/ambíguos:** o motor de regras usa valores padrão seguros (nível "iniciante", volume conservador) em vez de falhar a geração — mesma regra já definida na Fase 1
- **Catálogo de exercícios insuficiente para algum grupo muscular filtrado (equipamento raro):** o motor reduz o número de exercícios da sessão em vez de falhar a geração inteira
