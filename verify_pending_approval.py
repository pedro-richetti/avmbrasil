import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto("http://localhost:3000/pending-approval")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path="pending_approval_page_real.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
