import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto("http://localhost:8000/isup-server")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="/Users/macbookpro/.gemini/antigravity/brain/7f72d4c6-ab9a-463e-9f67-f17d916028db/isup_premium_view.png", full_page=True)
        await browser.close()

asyncio.run(main())
