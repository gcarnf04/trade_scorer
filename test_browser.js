const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('file:///Users/guille/Desktop/webs/trade_scorer/index.html', { waitUntil: 'networkidle0', timeout: 10000 }).catch(e => console.log('GOTO TIMEOUT:', e.message));
  
  await browser.close();
})();
