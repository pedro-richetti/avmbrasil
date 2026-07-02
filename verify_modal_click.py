import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # Set a large viewport
        await page.set_viewport_size({"width": 1280, "height": 1024})

        print("Navigating to page...")
        await page.goto("http://localhost:3000/app/project/dev")

        print("Clicking Rodar modelos...")
        await page.click("text=Rodar modelos")

        print("Waiting for Detalhe do modelo...")
        await page.wait_for_selector("text=Detalhe do modelo")

        print("Waiting 2s...")
        await asyncio.sleep(2)

        print("Clicking Pontos influentes...")
        await page.click("text=Pontos influentes")

        print("Waiting for Detalhes do Critério modal...")
        try:
            await page.wait_for_selector("text=Detalhes do Critério", timeout=5000)
        except Exception as e:
            print("Modal didn't appear by 'Detalhes do Critério' text. Let's try capturing anyway.")

        print("Taking screenshot...")
        await page.screenshot(path="criteria_modal_screenshot.png", full_page=True)

        await browser.close()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(run())
