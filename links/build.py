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
# ПРИМЕРЫ: замените username и подписи на настоящие.
TELEGRAM_ACCOUNTS = [
    {"username": "username1", "uz": "Vizalar", "ru": "Визы"},
    {"username": "username2", "uz": "Turlar", "ru": "Туры"},
    {"username": "username3", "uz": "Aviachiptalar", "ru": "Авиабилеты"},
]

TG_ICON = (
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 3.6 2.9 10.8c-1.3.5-1.3 1.2-.2 1.6l4.7 1.5 '
    '1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.8c.3-1.3-.5-1.9-1.5-1.5ZM8.6 '
    '13.6l9.9-6.2c.5-.3.9-.1.5.2l-8.4 7.6-.3 3.6-1.7-5.2Z"/></svg>'
)


def telegram_items() -> str:
    items = []
    for acc in TELEGRAM_ACCOUNTS:
        user = html.escape(acc["username"].lstrip("@"))
        uz, ru = html.escape(acc["uz"]), html.escape(acc["ru"])
        items.append(
            '    <li><a class="mgr" href="https://t.me/%s" target="_blank" rel="noopener">'
            '<span class="ico" aria-hidden="true">%s</span>'
            '<span class="txt"><span class="ttl" data-uz="%s" data-ru="%s">%s</span><span class="sub">@%s</span></span>'
            '<span class="go" aria-hidden="true">►</span></a></li>' % (user, TG_ICON, uz, ru, uz, user)
        )
    return "\n".join(items)


LOGOS = {
    "LOGO_LIGHT": HERE / "assets/orient-travel-logo-on-light.png",
    "LOGO_DARK": HERE / "assets/orient-travel-logo-on-dark.png",
}


def data_uri(path: pathlib.Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    body = (HERE / "page.template.html").read_text(encoding="utf-8")
    body = body.replace("{{TELEGRAM_ITEMS}}", telegram_items())
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
