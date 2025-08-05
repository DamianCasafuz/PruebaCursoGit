import playwright from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

function randomDelay(min = 500, max = 1500) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function solveCaptcha(client, label = '') {
  console.log(`Solving captcha: ${label}`);
  const result = await client.send('Captcha.waitForSolve', {
    detectTimeout: 10000,
  });

  console.log(`Captcha status: ${result.status}`);
  if (result.status === 'solve_failed' || result.status === 'invalid') {
    throw new Error(`Captcha failed: ${result.error} (type: ${result.type})`);
  }
  return result;
}

export async function main() {
  const auth = process.env.AUTH;
  const INITIAL_URL = 'https://spesaonline.esselunga.it/';
  const FINAL_URL = 'https://spesaonline.esselunga.it/commerce/nav/drive/store/menu/300000001002081/vini-e-liquori';
  const endpointURL = `wss://${auth}@brd.superproxy.io:9222`;

  const browser = await playwright.chromium.connectOverCDP(endpointURL);
  const context = await browser.newContext();
  const page = await context.newPage();
  const client = await page.context().newCDPSession(page);

  page.on('framenavigated', frame => {
    console.log(`Navigated to: ${frame.url()}`);
  });

  try {
    // Step 1: Navigate to initial URL
    await page.goto(INITIAL_URL, { timeout: 2 * 60 * 1000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(randomDelay(2000, 4000));

    // Step 2: Fill geolocation form
    await page.locator('#postcode').fill('50129');
    await page.waitForTimeout(randomDelay());
    await page.locator('#streetCtrl').fill('Via Ventisette Aprile - Firenze');
    await page.waitForTimeout(randomDelay());
    await page.locator('#streetPanel0').click();
    await page.waitForTimeout(randomDelay());
    await page.locator('[type="submit"]').click();
    await page.waitForTimeout(randomDelay());

    // Step 3: Select delivery method
    await page.locator('[aria-label="Clicca e Vai Locker"]').click();
    await page.screenshot({ path: 'beforecaptcha.png', fullPage: true });

    // Step 4: Solve captcha
    await solveCaptcha(client, 'After location');
    await page.screenshot({ path: 'aftercaptcha.png', fullPage: true });

    // Step 5: Final store confirmation click
    try {
      console.log('Clicking final store confirmation...');
      await page.locator('(//a[@href=""])[1]').click({ timeout: 5000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.warn('Final store confirmation click failed. Retrying...');
      await page.reload();
      await page.waitForTimeout(3000);
      await page.locator('(//a[@href=""])[1]').click();
    }

    // Step 6: Navigate to final product page
    await page.goto(FINAL_URL, { timeout: 2 * 60 * 1000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'final_screenshot.png', fullPage: true });

    console.log('Automation complete.');
    return await page.content();
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    await browser.close();
  }
}


await main();