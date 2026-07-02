import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # Set a large viewport
        await page.set_viewport_size({"width": 1280, "height": 1024})

        print("Navigating to page...")
        await page.goto("http://localhost:3000/")

        print("Waiting for page load...")
        await asyncio.sleep(2)

        print("Clicking 'Rodar modelos'...")
        try:
            await page.click("text=Rodar modelos")
        except Exception as e:
            print("Could not click 'Rodar modelos'. Let's see if it's already running.")

        await asyncio.sleep(1)

        print("Clicking 'Pontos influentes'...")
        try:
            await page.click("text=Pontos influentes")
        except Exception as e:
            print("Could not click 'Pontos influentes'. Let's try 'Ver Detalhes' near the criteria.")
            # Maybe use nth if there are multiple
            # await page.locator("text=Ver Detalhes").nth(0).click()

        print("Waiting a bit...")
        await asyncio.sleep(1)

        print("Taking screenshot...")
        await page.screenshot(path="correct_modal_screenshot.png", full_page=True)

        with open("correct_page_dump.html", "w") as f:
            f.write(await page.content())

        await browser.close()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(run())
