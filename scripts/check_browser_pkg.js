async function testBrowserPackages() {
  try {
    const puppeteer = require('puppeteer');
    console.log('✅ puppeteer is available!');
  } catch (e) {
    console.log('puppeteer not available:', e.message);
  }

  try {
    const { chromium } = require('playwright');
    console.log('✅ playwright is available!');
  } catch (e) {
    console.log('playwright not available:', e.message);
  }
}

testBrowserPackages();
