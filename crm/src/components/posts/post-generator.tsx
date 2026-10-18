"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { POST_SIZES, drawPost, type PostData, type PostFormat, type PostTemplate } from "@/lib/post-canvas";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/core";

const STORE = "post-generator";
const ACCENTS = ["#ea5f00", "#0284c7", "#059669", "#7c3aed", "#db2777", "#111827"];

export interface PostInitial {
  badge?: string;
  title?: string;
  details?: string;
  price?: string;
  photoUrl?: string | null;
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** Генератор постов для Instagram: фото + текст поверх, скачать PNG и подпись к посту */
export function PostGenerator({ initial }: { initial: PostInitial }) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [d, setD] = useState<PostData>({
    format: "square",
    template: "gradient",
    accent: ACCENTS[0],
    badge: initial.badge ?? "",
    title: initial.title ?? "",
    details: initial.details ?? "",
    price: initial.price ?? "",
    footer: "",
    showLogo: true,
  });
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [logos, setLogos] = useState<{ white: HTMLImageElement | null; color: HTMLImageElement | null }>({ white: null, color: null });
  const [caption, setCaption] = useState("");
  const [captionTouched, setCaptionTouched] = useState(false);

  // контакты и цвет запоминаются в браузере
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Partial<PostData>;
      setD((v) => ({ ...v, footer: saved.footer ?? v.footer, accent: saved.accent ?? v.accent, template: saved.template ?? v.template, format: saved.format ?? v.format }));
    } catch {
      // нет доступа к localStorage — работаем со значениями по умолчанию
    }
    void Promise.all([loadImage("/logo-dark.png", false), loadImage("/logo-light.png", false)]).then(([white, color]) => setLogos({ white, color }), () => undefined);
    if (initial.photoUrl) {
      // фото по ссылке можно нарисовать, только если сайт разрешает (CORS); иначе — загрузить файлом
      loadImage(initial.photoUrl, true).then(setPhoto, () => toast.info(t("posts.photoBlocked")));
    }
  }, [initial.photoUrl, t]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ footer: d.footer, accent: d.accent, template: d.template, format: d.format }));
    } catch {
      // не сохраняем
    }
  }, [d.footer, d.accent, d.template, d.format]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const size = POST_SIZES[d.format];
    c.width = size.w;
    c.height = size.h;
    const draw = () => drawPost(ctx, d, { photo, logoWhite: logos.white, logoColor: logos.color });
    draw();
    // шрифт мог догрузиться позже — перерисовываем
    void document.fonts?.ready.then(draw);
  }, [d, photo, logos]);

  const autoCaption = [d.title, d.details, d.price && `💰 ${d.price}`, d.footer, "#orienttravel #fergana #туры #путешествия"].filter((s) => s && s.trim()).join("\n\n");
  const captionText = captionTouched ? caption : autoCaption;

  const set = <K extends keyof PostData>(k: K, v: PostData[K]) => setD((s) => ({ ...s, [k]: v }));
  const text = (k: "badge" | "title" | "details" | "price" | "footer") => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error(t("posts.notImage"));
    const url = URL.createObjectURL(file);
    loadImage(url, false).then(setPhoto, () => toast.error(t("posts.notImage")));
  }

  function download() {
    const c = canvas.current;
    if (!c) return;
    try {
      c.toBlob((blob) => {
        if (!blob) return void toast.error(t("posts.downloadFailed"));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `orient-post-${d.format}-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }, "image/png");
    } catch {
      toast.error(t("posts.downloadFailed"));
    }
  }

  const formats: PostFormat[] = ["square", "portrait", "story"];
  const templates: PostTemplate[] = ["gradient", "card"];
  const seg = (active: boolean) => cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <ImagePlus className="size-4" /> {photo ? t("posts.changePhoto") : t("posts.uploadPhoto")}
              <input type="file" accept="image/*" className="hidden" onChange={pickFile} />
            </label>
            {photo && (
              <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>
                <X /> {t("posts.removePhoto")}
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">{t("posts.format")}</div>
            <div className="flex flex-wrap gap-1.5">
              {formats.map((f) => (
                <button key={f} type="button" className={seg(d.format === f)} onClick={() => set("format", f)}>
                  {t(`posts.format_${f}` as TKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">{t("posts.template")}</div>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((v) => (
                  <button key={v} type="button" className={seg(d.template === v)} onClick={() => set("template", v)}>
                    {t(`posts.template_${v}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">{t("posts.accent")}</div>
              <div className="flex gap-1.5">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    className={cn("size-8 rounded-full border-2", d.accent === c ? "border-foreground" : "border-transparent")}
                    style={{ background: c }}
                    onClick={() => set("accent", c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <Field label={t("posts.badge")}>
            <Input value={d.badge} onChange={text("badge")} placeholder={t("posts.badgePh")} maxLength={40} />
          </Field>
          <Field label={t("posts.title")}>
            <Input value={d.title} onChange={text("title")} placeholder={t("posts.titlePh")} maxLength={120} />
          </Field>
          <Field label={t("posts.details")}>
            <Textarea value={d.details} onChange={text("details")} rows={3} placeholder={t("posts.detailsPh")} maxLength={400} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <Field label={t("posts.price")}>
              <Input value={d.price} onChange={text("price")} placeholder={t("posts.pricePh")} maxLength={40} />
            </Field>
            <Field label={t("posts.footer")}>
              <Input value={d.footer} onChange={text("footer")} placeholder="+998 90 000 00 00 · @orient_travel" maxLength={120} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.showLogo} onChange={(e) => set("showLogo", e.target.checked)} /> {t("posts.showLogo")}
          </label>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="overflow-hidden p-3">
          <canvas ref={canvas} className={cn("mx-auto block h-auto w-full rounded-md bg-muted", d.format === "story" && "max-w-sm")} />
          <div className="mt-3 flex justify-end">
            <Button onClick={download}>
              <Download /> {t("posts.download")}
            </Button>
          </div>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t("posts.caption")}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(captionText).then(() => toast.success(t("posts.captionCopied")), () => toast.error(t("common.errorGeneric")))}
              >
                <Copy /> {t("posts.copy")}
              </Button>
            </div>
            <Textarea
              value={captionText}
              rows={7}
              onChange={(e) => {
                setCaptionTouched(true);
                setCaption(e.target.value);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
