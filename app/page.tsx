export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-3xl font-semibold text-brand">Bora Treinar!</h1>
      <p className="mt-2 text-base">Seu personal trainer com IA.</p>
      <a href="/exercicios" className="mt-4 text-brand underline">Ver biblioteca de exercícios</a>
    </div>
  );
}
