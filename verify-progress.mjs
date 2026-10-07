import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium'
  });
  const page = await browser.newPage();

  // Set viewport
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of home
  await page.screenshot({ path: '/tmp/claude-0/-home-user/1cb1b754-ef89-50ff-95ae-d468375e8177/scratchpad/01-home.png' });
  console.log('Screenshot: 01-home.png');

  // Look for Visite link and click it
  console.log('Looking for Visite link...');
  const visiteLink = await page.$('a[href*="/visite"]');

  if (visiteLink) {
    console.log('Found Visite link, clicking...');
    await visiteLink.click();
    await page.waitForTimeout(2000);

    const url = page.url();
    console.log('Current URL:', url);

    await page.screenshot({ path: '/tmp/claude-0/-home-user/1cb1b754-ef89-50ff-95ae-d468375e8177/scratchpad/02-visite-page.png' });
    console.log('Screenshot: 02-visite-page.png');

    // Get page content
    const bodyText = await page.innerText('body');
    console.log('\n--- Progress Values Visible on Page ---');
    // Look for percentage values
    const percentMatches = bodyText.match(/\d+%/g) || [];
    console.log('Percentages found:', [...new Set(percentMatches)].slice(0, 20));
  } else {
    console.log('Visite link not found');

    // List all links
    const allLinks = await page.$$eval('a', links =>
      links.map(l => ({ text: l.innerText, href: l.href })).slice(0, 10)
    );
    console.log('Available links:', allLinks);
  }

  await browser.close();
  console.log('Done!');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
