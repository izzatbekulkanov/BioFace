from __future__ import annotations

import asyncio
import importlib
import logging
import time

from bot.config import load_config
from bot.handlers import choose_language, handle_action, handle_calendar_action, handle_calendar_noop, handle_menu_text, logout, show_month, show_today, start, unknown_state
from bot.services.notifications import CameraEventNotifier
from database import ensure_schema
from telegram.error import InvalidToken, NetworkError, RetryAfter, TelegramError, TimedOut

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


async def _post_init(application) -> None:
    application.bot_data["event_notifier"] = CameraEventNotifier(application, asyncio.get_running_loop())
    application.bot_data["event_notifier"].start()


async def _post_shutdown(application) -> None:
    notifier = application.bot_data.get("event_notifier")
    if notifier is not None:
        notifier.stop()


def build_application():
    config = load_config()
    telegram_ext = importlib.import_module("telegram.ext")

    application = telegram_ext.ApplicationBuilder().token(config.token).post_init(_post_init).post_shutdown(_post_shutdown).build()
    application.bot_data["default_language"] = config.default_language

    application.add_handler(telegram_ext.CommandHandler("logout", logout))
    application.add_handler(telegram_ext.CommandHandler("start", start))
    application.add_handler(telegram_ext.CommandHandler("today", show_today))
    application.add_handler(telegram_ext.CommandHandler("month", show_month))
    application.add_handler(telegram_ext.CallbackQueryHandler(choose_language, pattern=r"^lang:(uz|ru)$"))
    application.add_handler(telegram_ext.CallbackQueryHandler(handle_action, pattern=r"^action:(change_language|logout)$"))
    application.add_handler(telegram_ext.CallbackQueryHandler(handle_calendar_action, pattern=r"^cal:day:"))
    application.add_handler(telegram_ext.CallbackQueryHandler(handle_calendar_noop, pattern=r"^noop$"))
    application.add_handler(telegram_ext.MessageHandler(telegram_ext.filters.TEXT & ~telegram_ext.filters.COMMAND, handle_menu_text))
    application.add_handler(telegram_ext.MessageHandler(telegram_ext.filters.ALL, unknown_state))
    return application


def main() -> None:
    ensure_schema()
    retry_delay = 5
    max_retry_delay = 60
    last_state = None

    while True:
        try:
            application = build_application()
            if last_state != "running":
                logger.warning("Telegram bot ishga tushdi.")
            last_state = "running"

            # Blocking polling; when it exits we restart with a short delay.
            application.run_polling(drop_pending_updates=True)
            retry_delay = 5
            if last_state != "stopped":
                logger.warning("Telegram bot to'xtadi. Qayta ishga tushiriladi.")
            last_state = "stopped"
            time.sleep(retry_delay)

        except RuntimeError:
            if last_state != "missing_token":
                logger.warning("Bot token DBda topilmadi. Token saqlanguncha kutilyapti.")
            last_state = "missing_token"
            time.sleep(10)

        except InvalidToken:
            if last_state != "invalid_token":
                logger.warning("DBdagi bot token noto'g'ri. Yangilangan token kutilmoqda.")
            last_state = "invalid_token"
            time.sleep(10)

        except (NetworkError, TimedOut, RetryAfter, TelegramError) as exc:
            if last_state != "network_error":
                logger.warning("Telegram tarmoq xatosi: %s", exc)
            last_state = "network_error"
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_retry_delay)

        except Exception as exc:
            if last_state != "unexpected_error":
                logger.warning("Kutilmagan bot xatosi: %s", exc)
            last_state = "unexpected_error"
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_retry_delay)


if __name__ == "__main__":
    main()

