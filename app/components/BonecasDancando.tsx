type Boneca = { pele: string; cabelo: string; top: string; short: string; atraso: string }

const BONECAS: Boneca[] = [
  { pele: '#f1c7a5', cabelo: '#3b2414', top: '#c8ff00', short: '#0a0a0a', atraso: '0s' },
  { pele: '#8d5a3b', cabelo: '#111111', top: '#0a0a0a', short: '#c8ff00', atraso: '-0.25s' },
  { pele: '#d9a47c', cabelo: '#b4532a', top: '#c8ff00', short: '#0a0a0a', atraso: '-0.5s' },
]

function Bonequinha({ pele, cabelo, top, short, atraso }: Boneca) {
  const anima = { animationDelay: atraso }
  return (
    <svg viewBox="-16 0 172 220" className="h-40 w-32 sm:h-48 sm:w-36" aria-hidden>
      <g className="boneca-pula" style={anima}>
        <g className="boneca-perna-esq" style={anima}>
          <line x1="60" y1="146" x2="52" y2="198" stroke={pele} strokeWidth="20" strokeLinecap="round" />
          <ellipse cx="50" cy="204" rx="11" ry="6" fill="#ffffff" stroke="#0a0a0a" strokeWidth="2" />
        </g>
        <g className="boneca-perna-dir" style={anima}>
          <line x1="80" y1="146" x2="88" y2="198" stroke={pele} strokeWidth="20" strokeLinecap="round" />
          <ellipse cx="90" cy="204" rx="11" ry="6" fill="#ffffff" stroke="#0a0a0a" strokeWidth="2" />
        </g>

        <path d="M38 68 Q70 58 102 68 L90 124 Q70 128 50 124 Z" fill={pele} />
        <g fill="#0a0a0a" fillOpacity="0.14">
          <rect x="61" y="97" width="8" height="7" rx="3" />
          <rect x="71" y="97" width="8" height="7" rx="3" />
          <rect x="61" y="106" width="8" height="7" rx="3" />
          <rect x="71" y="106" width="8" height="7" rx="3" />
          <rect x="62" y="115" width="7" height="6" rx="3" />
          <rect x="71" y="115" width="7" height="6" rx="3" />
        </g>
        <path d="M40 68 Q70 60 100 68 L96 92 Q70 98 44 92 Z" fill={top} stroke="#0a0a0a" strokeWidth="2" />
        <path d="M49 120 Q70 126 91 120 L94 152 L72 152 L70 140 L68 152 L46 152 Z" fill={short} stroke="#0a0a0a" strokeWidth="2" />

        <g className="boneca-braco-esq" style={anima}>
          <line x1="42" y1="72" x2="16" y2="74" stroke={pele} strokeWidth="15" strokeLinecap="round" />
          <ellipse cx="28" cy="64" rx="14" ry="12" fill={pele} />
          <circle cx="43" cy="68" r="10" fill={pele} />
          <line x1="16" y1="74" x2="20" y2="42" stroke={pele} strokeWidth="13" strokeLinecap="round" />
          <circle cx="20" cy="38" r="8" fill={pele} stroke="#0a0a0a" strokeWidth="1.5" />
        </g>
        <g className="boneca-braco-dir" style={anima}>
          <line x1="98" y1="72" x2="124" y2="74" stroke={pele} strokeWidth="15" strokeLinecap="round" />
          <ellipse cx="112" cy="64" rx="14" ry="12" fill={pele} />
          <circle cx="97" cy="68" r="10" fill={pele} />
          <line x1="124" y1="74" x2="120" y2="42" stroke={pele} strokeWidth="13" strokeLinecap="round" />
          <circle cx="120" cy="38" r="8" fill={pele} stroke="#0a0a0a" strokeWidth="1.5" />
        </g>

        <rect x="63" y="52" width="14" height="14" rx="4" fill={pele} />
        <g className="boneca-rabo" style={anima}>
          <path d="M84 26 Q104 30 100 62 Q92 46 82 36 Z" fill={cabelo} />
        </g>
        <circle cx="70" cy="38" r="18" fill={pele} />
        <path d="M52 38 Q52 18 70 18 Q88 18 88 38 Q80 26 70 28 Q60 26 52 38 Z" fill={cabelo} />
        <circle cx="64" cy="40" r="2" fill="#0a0a0a" />
        <circle cx="76" cy="40" r="2" fill="#0a0a0a" />
        <path d="M63 47 Q70 53 77 47" stroke="#0a0a0a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="59" cy="46" r="3" fill="#ff7a9a" fillOpacity="0.5" />
        <circle cx="81" cy="46" r="3" fill="#ff7a9a" fillOpacity="0.5" />
      </g>
    </svg>
  )
}

export default function BonecasDancando() {
  return (
    <div className="flex items-end justify-center gap-1">
      {BONECAS.map((boneca, i) => (
        <Bonequinha key={i} {...boneca} />
      ))}
    </div>
  )
}
