export default function ExerciseSwapPanel({
  options,
  applyingOptionId,
  onChoose,
}: {
  options: { id: string; name: string }[]
  applyingOptionId: string | null
  onChoose: (exerciseId: string) => void
}) {
  return (
    <div className="mt-3 rounded-xl border border-border-subtle bg-background p-3">
      {options.length === 0 ? (
        <p className="text-xs text-foreground/60">
          Nenhuma alternativa disponível pra esse grupo muscular.
        </p>
      ) : (
        <ul className="space-y-2">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onChoose(option.id)}
                disabled={applyingOptionId === option.id}
                className="min-h-11 w-full rounded-lg border border-border-subtle px-3 text-left text-sm capitalize hover:border-brand disabled:opacity-50"
              >
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
