/** Рисование поста для Instagram на canvas (в браузере): фото, плашка, заголовок, детали, цена, контакты, логотип */

export type PostFormat = "square" | "portrait" | "story";
export type PostTemplate = "gradient" | "card";

export const POST_SIZES: Record<PostFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

export interface PostData {
  format: PostFormat;
  template: PostTemplate;
  accent: string;
  badge: string;
  title: string;
  details: string;
  price: string;
  footer: string;
  showLogo: boolean;
}

export interface PostImages {
  photo: CanvasImageSource & { width: number; height: number } | null;
  /** белый логотип — для тёмного фона */
  logoWhite: HTMLImageElement | null;
  /** цветной логотип — для светлой карточки */
  logoColor: HTMLImageElement | null;
}

/** Разбивка текста на строки по ширине; явные переносы строк сохраняются */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number, maxLines = Infinity): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && measure(next) > maxWidth) {
        out.push(line);
        line = w;
      } else line = next;
    }
    out.push(line);
  }
  if (out.length > maxLines) {
    const cut = out.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1).trimEnd();
    cut[maxLines - 1] = `${last}…`;
    return cut;
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: NonNullable<PostImages["photo"]>, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, bg: string, color: string) {
  ctx.font = `700 ${size}px ${FONT}`;
  const padX = size * 0.6;
  const h = size * 1.7;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return { w, h };
}

const FONT = `Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export function drawPost(ctx: CanvasRenderingContext2D, d: PostData, img: PostImages) {
  const { w, h } = POST_SIZES[d.format];
  const pad = 72;
  const story = d.format === "story";
  ctx.clearRect(0, 0, w, h);

  // фон: фото или градиент фирменного цвета
  if (img.photo) drawCover(ctx, img.photo, w, h);
  else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, d.accent);
    g.addColorStop(1, "#1f2937");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const card = d.template === "card";
  const inner = card ? w - pad * 2 - 64 * 2 : w - pad * 2;
  const titleSize = story ? 84 : 72;
  const detailSize = story ? 38 : 34;
  const priceSize = story ? 64 : 56;
  const footerSize = story ? 32 : 28;

  ctx.font = `800 ${titleSize}px ${FONT}`;
  const title = wrapText((s) => ctx.measureText(s).width, d.title, inner, 3);
  ctx.font = `500 ${detailSize}px ${FONT}`;
  const details = wrapText((s) => ctx.measureText(s).width, d.details, inner, story ? 6 : 4);
  ctx.font = `500 ${footerSize}px ${FONT}`;
  const footer = wrapText((s) => ctx.measureText(s).width, d.footer, inner - (card && d.showLogo ? 260 : 0), 2);

  // высота текстового блока
  const gap = 24;
  const priceH = d.price.trim() ? priceSize * 1.7 : 0;
  const blockH =
    title.length * titleSize * 1.12 + (details.length ? gap + details.length * detailSize * 1.35 : 0) + (priceH ? gap * 1.5 + priceH : 0) + (footer.length ? gap * 1.5 + footer.length * footerSize * 1.35 : 0);
  const bottom = story ? 220 : pad;

  let y: number;
  let x = pad;
  if (card) {
    const cardPad = 64;
    const cardH = blockH + cardPad * 2;
    const cardY = h - bottom - cardH + (story ? 0 : pad - 48);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(ctx, pad, cardY, w - pad * 2, cardH, 40);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = d.accent;
    roundRect(ctx, pad + 28, cardY + cardPad, 8, cardH - cardPad * 2, 4);
    ctx.fill();
    x = pad + cardPad;
    y = cardY + cardPad;
  } else {
    const g = ctx.createLinearGradient(0, h - blockH - bottom - 260, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.45, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0.88)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h - blockH - bottom - 260, w, blockH + bottom + 260);
    y = h - bottom - blockH;
  }

  const ink = card ? "#111827" : "#ffffff";
  const soft = card ? "#4b5563" : "rgba(255,255,255,0.88)";
  ctx.textBaseline = "top";
  ctx.fillStyle = ink;
  ctx.font = `800 ${titleSize}px ${FONT}`;
  for (const l of title) {
    ctx.fillText(l, x, y);
    y += titleSize * 1.12;
  }
  if (details.length) {
    y += gap;
    ctx.font = `500 ${detailSize}px ${FONT}`;
    ctx.fillStyle = soft;
    for (const l of details) {
      ctx.fillText(l, x, y);
      y += detailSize * 1.35;
    }
  }
  ctx.textBaseline = "alphabetic";
  if (priceH) {
    y += gap * 1.5;
    pill(ctx, d.price.trim(), x, y, priceSize, d.accent, "#ffffff");
    y += priceH;
  }
  if (footer.length) {
    y += gap * 1.5;
    ctx.textBaseline = "top";
    ctx.font = `600 ${footerSize}px ${FONT}`;
    ctx.fillStyle = soft;
    for (const l of footer) {
      ctx.fillText(l, x, y);
      y += footerSize * 1.35;
    }
    ctx.textBaseline = "alphabetic";
  }

  // плашка сверху слева
  const top = story ? 180 : pad;
  if (d.badge.trim()) pill(ctx, d.badge.trim().toUpperCase(), pad, top, story ? 36 : 32, d.accent, "#ffffff");

  // логотип: на фото — белый сверху справа, в карточке — цветной снизу справа
  if (d.showLogo) {
    const logo = card ? img.logoColor : img.logoWhite;
    if (logo && logo.width) {
      const lw = card ? 220 : 280;
      const lh = (logo.height / logo.width) * lw;
      if (card) ctx.drawImage(logo, w - pad - 48 - lw, y - lh + 8, lw, lh);
      else {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 10;
        ctx.drawImage(logo, w - pad - lw, top - 8, lw, lh);
        ctx.restore();
      }
    }
  }
}
