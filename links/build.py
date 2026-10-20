"""Собирает страницу-визитку Orient Travel (аналог Taplink) в один файл.

python3 links/build.py  ->  links/index.html (готов к хостингу) и links/dist/artifact.html (превью в Claude)
Ссылки и логотипы задаются ниже.
"""
import base64
import html
import pathlib

HERE = pathlib.Path(__file__).parent

# Telegram-аккаунты в шторке «Кому написать?» — в том порядке, в каком они показываются.
# username — без @; uz / ru — подпись на двух языках (направление или имя менеджера).
TELEGRAM_ACCOUNTS = [
    {"username": "orient_support", "uz": "Sabina", "ru": "Сабина"},
    {"username": "orient_travell", "uz": "Diora", "ru": "Диора"},
]

TG_ICON = (
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 3.6 2.9 10.8c-1.3.5-1.3 1.2-.2 1.6l4.7 1.5 '
    '1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.8c.3-1.3-.5-1.9-1.5-1.5ZM8.6 '
    '13.6l9.9-6.2c.5-.3.9-.1.5.2l-8.4 7.6-.3 3.6-1.7-5.2Z"/></svg>'
)


# Номера в шторке «Кому позвонить?»: number — в формате +998XXXXXXXXX.
PHONES = [
    {"number": "+998705145353", "uz": "Sabina", "ru": "Сабина"},
    {"number": "+998335437373", "uz": "Diora", "ru": "Диора"},
]

PHONE_ICON = (
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 '
    '1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 '
    '2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"/></svg>'
)


def item(href: str, icon: str, uz: str, ru: str, sub: str, new_tab: bool) -> str:
    target = ' target="_blank" rel="noopener"' if new_tab else ""
    uz, ru = html.escape(uz), html.escape(ru)
    return (
        '    <li><a class="mgr" href="%s"%s><span class="ico" aria-hidden="true">%s</span>'
        '<span class="txt"><span class="ttl" data-uz="%s" data-ru="%s">%s</span><span class="sub">%s</span></span>'
        '<span class="go" aria-hidden="true">►</span></a></li>' % (html.escape(href), target, icon, uz, ru, uz, html.escape(sub))
    )


def pretty_phone(number: str) -> str:
    """+998705145353 -> +998 70 514 53 53"""
    d = number.lstrip("+")
    return "+%s %s %s %s %s" % (d[:3], d[3:5], d[5:8], d[8:10], d[10:])


def telegram_items() -> str:
    return "\n".join(
        item("https://t.me/" + a["username"].lstrip("@"), TG_ICON, a["uz"], a["ru"], "@" + a["username"].lstrip("@"), True)
        for a in TELEGRAM_ACCOUNTS
    )


def phone_items() -> str:
    return "\n".join(
        item("tel:" + p["number"], PHONE_ICON, p["uz"], p["ru"], pretty_phone(p["number"]), False) for p in PHONES
    )


LOGOS = {
    "LOGO_LIGHT": HERE / "assets/orient-travel-logo-on-light.png",
    "LOGO_DARK": HERE / "assets/orient-travel-logo-on-dark.png",
}


def data_uri(path: pathlib.Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    body = (HERE / "page.template.html").read_text(encoding="utf-8")
    body = body.replace("{{TELEGRAM_ITEMS}}", telegram_items())
    body = body.replace("{{PHONE_ITEMS}}", phone_items())
    body = body.replace("{{LAND_MASK}}", (HERE / "assets/land-mask.b64").read_text().strip())
    for key, path in LOGOS.items():
        body = body.replace("{{%s}}" % key, data_uri(path))

    standalone = (
        '<!doctype html>\n<html lang="uz">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<link rel="icon" type="image/png" href="%s">\n</head>\n<body>\n%s</body>\n</html>\n'
        % (data_uri(HERE / "assets/orient-travel-symbol.png"), body)
    )
    (HERE / "index.html").write_text(standalone, encoding="utf-8")
    (HERE / "dist").mkdir(exist_ok=True)
    (HERE / "dist/artifact.html").write_text(body, encoding="utf-8")


if __name__ == "__main__":
    main()
