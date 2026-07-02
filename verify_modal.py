import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        print("Navigating to page...")
        await page.goto("http://localhost:3000")

        print("Waiting for page load...")
        await page.wait_for_timeout(2000)

        print("Clicking 'Rodar modelos'...")
        try:
            await page.click('button:has-text("Rodar modelos")')
            await page.wait_for_timeout(2000)
        except Exception as e:
            print("Failed to click Rodar modelos:", e)

        print("Clicking 'Ver Detalhes' or similar...")
        try:
            # Look for the table row
            await page.click('button:has-text("Ver Detalhes")')
            await page.wait_for_timeout(1000)

            # Now inside the modal, click "Pontos influentes"
            await page.click('text="Pontos influentes"')
            await page.wait_for_timeout(1000)
        except Exception as e:
            print("Failed to click detail/criteria:", e)

        await page.screenshot(path="modal_screenshot.png", full_page=True)
        print("Done.")

        await browser.close()

asyncio.run(run())
