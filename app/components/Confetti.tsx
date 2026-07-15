const CONFETTI_PIECES = ['🎉', '🎊', '✨', '🎆', '🎇']

export default function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className="confetti-piece text-2xl"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 1.2}s`,
            animationDuration: `${2 + Math.random() * 1.5}s`,
          }}
        >
          {CONFETTI_PIECES[index % CONFETTI_PIECES.length]}
        </span>
      ))}
    </div>
  )
}
