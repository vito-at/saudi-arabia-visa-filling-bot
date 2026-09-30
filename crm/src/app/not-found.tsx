import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
      <div className="text-5xl font-semibold text-slate-300">404</div>
      <h1 className="text-lg font-semibold">Страница не найдена</h1>
      <p className="text-sm text-muted-foreground">Запись удалена или у вас нет к ней доступа.</p>
      <Link href="/" className="text-sm text-primary hover:underline">
        На главную
      </Link>
    </div>
  );
}
