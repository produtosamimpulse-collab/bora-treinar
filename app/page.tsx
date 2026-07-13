export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background px-6 text-center text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/30 blur-[120px]"
      />

      <div className="relative">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-foreground/70">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Seu personal trainer com IA
        </span>

        <h1 className="font-display text-6xl uppercase leading-[0.95] tracking-tight sm:text-8xl">
          Bora
          <br />
          <span className="text-brand">Treinar!</span>
        </h1>

        <p className="mx-auto mt-6 max-w-md text-base text-foreground/70">
          Treinos montados, acompanhados e ajustados por IA, mês a mês, do seu jeito.
        </p>

        <a
          href="/exercicios"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold uppercase tracking-wide text-black transition-transform hover:scale-105"
        >
          Ver biblioteca de exercícios
          <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}
