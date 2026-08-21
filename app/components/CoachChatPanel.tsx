'use client'

import type { CoachMessage } from '@/app/plano/useCoachChat'

export default function CoachChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  emptyHint,
}: {
  messages: CoachMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  loading: boolean
  emptyHint?: string
}) {
  return (
    <div className="mt-3 rounded-xl border border-border-subtle bg-background p-3">
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-foreground/60">
            {emptyHint ??
              'Pergunte sobre algum exercício, relate uma dor, peça pra trocar um exercício, ou peça outro treino pra hoje (ex: "hoje eu quero só posterior").'}
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-xl bg-brand px-3 py-2 text-xs text-black'
                : 'mr-auto max-w-[85%] rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs'
            }
          >
            {message.content}
          </div>
        ))}
        {loading && <p className="text-xs text-foreground/50">Digitando...</p>}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Digite sua pergunta"
          disabled={loading}
          className="min-h-11 flex-1 rounded-lg border border-border-subtle bg-surface px-3 text-sm focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={loading}
          className="min-h-11 rounded-lg bg-brand px-4 text-xs font-semibold uppercase text-black disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
