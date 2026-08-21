'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CoachChatPanel from '@/app/components/CoachChatPanel'
import { usePlanChat } from './usePlanChat'

export default function PlanoCoachPanel({ trainingPlanId }: { trainingPlanId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [changedDays, setChangedDays] = useState(0)

  const chat = usePlanChat(trainingPlanId, (dayIds) => {
    setChangedDays(dayIds.length)
    // o plano inteiro vem do servidor: recarregar é o jeito honesto de
    // mostrar os dias novos, inclusive os de outras semanas
    router.refresh()
  })

  return (
    <div className="mb-8 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-brand text-outline">
            Planejamento do mês
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            {open
              ? 'Fechar conversa'
              : 'Falar com o treinador sobre o mês todo, e reorganizar os dias'}
          </p>
        </div>
        <span aria-hidden className="text-2xl text-brand text-outline">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <>
          <CoachChatPanel
            messages={chat.messages}
            input={chat.input}
            onInputChange={chat.setInput}
            onSend={chat.send}
            loading={chat.loading}
            emptyHint='Peça pra reorganizar a semana, mudar o foco de um dia ("deixa a quinta só de posterior") ou montar um dia pro beach tennis. Ele enxerga o mês todo.'
          />
          {changedDays > 0 && (
            <p className="mt-3 text-xs text-foreground/60">
              {changedDays === 1 ? 'Um dia foi refeito' : `${changedDays} dias foram refeitos`} e o
              plano abaixo já está atualizado.
            </p>
          )}
        </>
      )}
    </div>
  )
}
