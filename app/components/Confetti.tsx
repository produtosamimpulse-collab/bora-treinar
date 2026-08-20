import { useState } from 'react'

const CONFETTI_PIECES = ['🎉', '🎊', '✨', '🎆', '🎇']

type PieceStyle = { left: string; animationDelay: string; animationDuration: string }

function randomPieceStyles(): PieceStyle[] {
  return Array.from({ length: 24 }).map(() => ({
    left: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 1.2}s`,
    animationDuration: `${2 + Math.random() * 1.5}s`,
  }))
}

export default function Confetti() {
  // Sorteado uma única vez (lazy initializer do useState), não a cada
  // render - Math.random() direto no corpo do componente violaria a regra
  // de pureza de render do React.
  const [pieceStyles] = useState(randomPieceStyles)

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieceStyles.map((style, index) => (
        <span key={index} className="confetti-piece text-2xl" style={style}>
          {CONFETTI_PIECES[index % CONFETTI_PIECES.length]}
        </span>
      ))}
    </div>
  )
}
