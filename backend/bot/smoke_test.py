from __future__ import annotations

from bot.config import load_config
from bot.i18n import normalize_language
from bot.main import build_application


def main() -> None:
    assert normalize_language("uz") == "uz"
    assert normalize_language("ru") == "ru"
    assert normalize_language("xx") == "uz"

    try:
        config = load_config()
    except RuntimeError as exc:
        print(f"Smoke test skipped Telegram application build: {exc}")
        print("Smoke test passed: i18n checks are valid. Set TELEGRAM_BOT_TOKEN to validate the bot application.")
        return

    app = build_application()

    assert config.token, "TELEGRAM_BOT_TOKEN is empty"
    assert app is not None

    print("Smoke test passed: bot config and application are valid.")


if __name__ == "__main__":
    main()
