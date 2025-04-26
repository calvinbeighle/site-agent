const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testConnection() {
  console.log('Starting simple connection test...');
  
  let browser = null;
  
  try {
    console.log('Checking for Chrome...');
    
    // On macOS, Chrome is typically located at:
    const macOSChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    if (fs.existsSync(macOSChromePath)) {
      console.log('Found Chrome at:', macOSChromePath);
      
      // Create a data directory for Chrome
      const dataDir = path.join(__dirname, 'chrome-data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
      }
      
      // Launch Chrome with debugging port
      const chromeProcess = require('child_process').spawn(
        macOSChromePath,
        [
          `--user-data-dir=${dataDir}`,
          '--no-first-run',
          '--remote-debugging-port=9222',
          '--no-default-browser-check'
        ],
        { detached: true }
      );
      
      console.log('Chrome launched with PID:', chromeProcess.pid);
      
      // Give Chrome some time to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Connect to the browser
      console.log('Connecting to Chrome...');
      browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        defaultViewport: {width: 1280, height: 720}
      });
      
      console.log('Connected to Chrome');
      
      // Create a new page
      const page = await browser.newPage();
      console.log('New page created');
      
      // Navigate to Lovable
      console.log('Navigating to Lovable.dev...');
      await page.goto('https://lovable.dev/', { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      console.log('Successfully loaded Lovable.dev');
      
      // Take a screenshot
      await page.screenshot({ path: path.join(__dirname, 'lovable-page.png') });
      console.log('Screenshot saved');
      
      // Get the page title
      const title = await page.title();
      console.log(`Page title: ${title}`);
      
      // Stay open for manual inspection
      console.log('\n----------------------------------------');
      console.log('Chrome is now open with Lovable.dev');
      console.log('You can manually interact with it.');
      console.log('Press Ctrl+C to exit this script when done.');
      console.log('The Chrome window will stay open for you to use.');
      console.log('----------------------------------------\n');
      
      // Keep the script running
      await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
      
      return true;
    } else {
      console.error('Chrome not found at the expected location');
      return false;
    }
  } catch (error) {
    console.error('Error during test:', error);
    return false;
  } finally {
    if (browser) {
      try {
        await browser.disconnect();
        console.log('Disconnected from browser');
      } catch (e) {
        console.error('Error disconnecting from browser:', e);
      }
    }
  }
}

// Run the test
testConnection()
  .then(success => {
    console.log(success ? 'Test completed successfully' : 'Test failed');
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  }); 