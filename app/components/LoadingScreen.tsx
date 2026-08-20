export default function LoadingScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-foreground">
      <span
        aria-hidden
        className="h-10 w-10 animate-spin rounded-full border-2 border-border-subtle border-t-brand"
      />
      <p className="text-xs font-medium uppercase tracking-widest text-foreground/60">Carregando...</p>
    </main>
  )
}
