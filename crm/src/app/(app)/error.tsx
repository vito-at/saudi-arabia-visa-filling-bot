"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold">Что-то пошло не так</h1>
      <p className="max-w-md text-sm text-muted-foreground">Попробуйте обновить страницу. Если ошибка повторяется, сообщите администратору{error.digest ? ` (код ${error.digest})` : ""}.</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
