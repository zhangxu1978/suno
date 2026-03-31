const puppeteer = require('puppeteer');

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--remote-debugging-port=48840']
  });

  console.log('Browser launched');
  console.log('Browser version:', browser.version());

  const pages = await browser.pages();
  console.log('Number of pages:', pages.length);

  return browser;
}

launchBrowser().catch(console.error);