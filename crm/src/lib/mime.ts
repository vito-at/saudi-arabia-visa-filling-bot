/** Тип файла по имени, если браузер или мессенджер его не прислал */
export function guessMime(name: string, given?: string | null): string {
  if (given && given !== "application/octet-stream") return given;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (
    { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }[ext] ??
    "application/octet-stream"
  );
}
