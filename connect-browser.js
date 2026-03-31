const puppeteer = require('puppeteer');

async function startBrowser() {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:48840',
    defaultViewport: null
  });

  console.log('Connected to Chrome browser');
  console.log('Browser version:', browser.version());

  const pages = await browser.pages();
  console.log('Number of pages:', pages.length);

  if (pages.length > 0) {
    console.log('First page URL:', pages[0].url());
  }

  return browser;
}

startBrowser().catch(console.error);