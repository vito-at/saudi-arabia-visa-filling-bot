"""Собирает страницу-визитку Orient Travel (аналог Taplink) в один файл.

python3 links/build.py  ->  links/index.html (готов к хостингу) и links/dist/artifact.html (превью в Claude)
Ссылки и логотипы задаются ниже.
"""
import base64
import pathlib

HERE = pathlib.Path(__file__).parent

# Ссылка на Telegram агентства (канал или аккаунт менеджера), например https://t.me/username
TELEGRAM_URL = "https://t.me/"

LOGOS = {
    "LOGO_LIGHT": HERE / "assets/orient-travel-logo-on-light.png",
    "LOGO_DARK": HERE / "assets/orient-travel-logo-on-dark.png",
}


def data_uri(path: pathlib.Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    body = (HERE / "page.template.html").read_text(encoding="utf-8")
    body = body.replace("{{TELEGRAM_URL}}", TELEGRAM_URL)
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
