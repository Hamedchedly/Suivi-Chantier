import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  console.log('✓ App loaded');
  
  // Check if we can find tasks on the page
  const tasksSection = await page.textContent('body');
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/app-screenshot.png' });
  console.log('✓ Screenshot saved');
  
  // Look for the "Visite chantier" heading
  const heading = await page.locator('text=Visite chantier').isVisible();
  console.log(`Visite chantier visible: ${heading}`);
  
  await browser.close();
})();
