const { chromium } = require('playwright');
const { updateProjectPrivacy } = require('./privateandbadge');

// Configuration
const PROJECT_URL = 'https://lovable.dev/projects/0bdea507-c4e7-4337-8820-79a74cbe47eb';
const USER_DATA_DIR = './browser-data'; // Use the same user data dir as the main script

async function testPrivacySettings() {
  console.log(`Testing privacy settings for project: ${PROJECT_URL}`);
  
  // Launch a browser
  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 }
  });
  
  try {
    // Create a page
    const page = await browser.newPage();
    
    // Navigate to the project
    console.log('Navigating to the project...');
    await page.goto(PROJECT_URL);
    
    // Check if we need to log in
    const isLoginPage = await page.isVisible('text="Sign in"');
    if (isLoginPage) {
      console.log('Login required. Please sign in and then press any key to continue...');
      // Wait for user input
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve());
      });
      console.log('Continuing with privacy settings...');
    }
    
    // Now apply privacy settings
    console.log('Applying privacy settings...');
    const result = await updateProjectPrivacy(page);
    
    console.log(`Privacy settings update ${result ? 'successful' : 'failed'}`);
    
    // Keep the browser open for inspection
    console.log('\nBrowser will remain open for inspection. Press any key to close...');
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    // Close the browser after user confirmation
    await browser.close();
    console.log('Browser closed.');
  }
}

// Run the test
testPrivacySettings().catch(console.error); 