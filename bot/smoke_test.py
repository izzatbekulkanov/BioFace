from __future__ import annotations

from bot.config import load_config
from bot.i18n import normalize_language
from bot.main import build_application


def main() -> None:
    config = load_config()
    app = build_application()

    assert config.token, "TELEGRAM_BOT_TOKEN is empty"
    assert normalize_language("uz") == "uz"
    assert normalize_language("ru") == "ru"
    assert normalize_language("xx") == "uz"
    assert app is not None

    print("Smoke test passed: bot config and application are valid.")


if __name__ == "__main__":
    main()

