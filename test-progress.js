import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/claude-0/app-screenshot.png' });
  
  console.log('✓ App loaded successfully');
  
  // Check page content
  const content = await page.content();
  if (content.includes('Suivi Chantier')) {
    console.log('✓ Main page loaded (Suivi Chantier)');
  }
  
  // Look for navigation links
  const links = await page.$$eval('a', els => els.map(e => ({ href: e.href, text: e.textContent })));
  console.log('Found links:', links.slice(0, 5));
  
  await browser.close();
  console.log('✓ Browser closed');
})().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
