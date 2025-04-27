const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  timeout: 60000, // 1 minute timeout
  retryAttempts: 3 // Number of retry attempts for clicking buttons
};

/**
 * Make a project private and hide badge on an already open page
 * @param {Object} page - The Playwright page object that's already open to the project page
 * @returns {Promise<boolean>} - True if successful
 */
async function updateProjectPrivacy(page) {
  if (!page) {
    throw new Error('Page object is required');
  }
  
  console.log('Updating privacy settings for project...');
  
  try {
    // Navigate to the settings tab from the current page
    console.log('Navigating to settings tab...');
    
    // First click the project menu dropdown
    let menuClicked = false;
    try {
      // Look for button with aria-haspopup="menu" that will open project menu
      const projectMenuButton = await page.$('button[aria-haspopup="menu"]');
      if (projectMenuButton) {
        await projectMenuButton.click();
        await page.waitForTimeout(1000);
        menuClicked = true;
        console.log('Successfully clicked project menu dropdown');
      }
    } catch (error) {
      console.error('Error clicking project menu:', error.message);
    }
    
    // Click on "Project Settings" menu item
    let settingsClicked = false;
    if (menuClicked) {
      try {
        // Look for the Project Settings menu item
        const settingsMenuItem = await page.$('div[role="menuitem"]:has-text("Project Settings")');
        if (settingsMenuItem) {
          await settingsMenuItem.click();
          await page.waitForTimeout(3000); // Wait for settings page to load
          settingsClicked = true;
          console.log('Successfully clicked Project Settings menu item');
        }
      } catch (error) {
        console.error('Error navigating to settings:', error.message);
      }
    }
    
    // If we couldn't get to settings via menu, try direct URL approach
    if (!settingsClicked) {
      try {
        // Get current URL and add settings parameter
        const currentUrl = page.url();
        const settingsUrl = currentUrl.includes('?') ? 
          `${currentUrl}&settings=general` : 
          `${currentUrl}?settings=general`;
        
        console.log('Trying to navigate directly to settings URL...');
        await page.goto(settingsUrl);
        await page.waitForTimeout(3000);
        console.log('Navigated directly to settings URL');
      } catch (error) {
        console.error('Error navigating directly to settings:', error.message);
      }
    }
    
    // Now click "Project Settings" tab if it exists
    try {
      console.log('Attempting to click Project Settings tab...');
      const projectSettingsTab = await page.$('button[role="tab"]:has-text("Project Settings")');
      if (projectSettingsTab) {
        await projectSettingsTab.click();
        await page.waitForTimeout(2000); // Wait for tab content to load
        console.log('Successfully clicked Project Settings tab');
      } else {
        console.log('Project Settings tab not found');
      }
    } catch (error) {
      console.error('Error clicking Project Settings tab:', error.message);
    }
    
    // Wait for page to stabilize
    await page.waitForTimeout(2000);
    
    // STEP 1: Click the "private" radio button
    console.log('Setting project to private...');
    const privateButtonSelector = 'button[type="button"][role="radio"][value="private"][id="private"]';
    
    let privateSuccess = false;
    for (let attempt = 0; attempt < CONFIG.retryAttempts; attempt++) {
      try {
        const privateButton = await page.$(privateButtonSelector);
        if (privateButton) {
          // Check if already selected
          const isAlreadyChecked = await page.$eval(privateButtonSelector, el => el.getAttribute('aria-checked') === 'true');
          if (isAlreadyChecked) {
            console.log('Project is already set to private');
            privateSuccess = true;
            break;
          }
          
          // Click the button
          await privateButton.click();
          await page.waitForTimeout(2000);
          
          // Verify it's checked now
          const isCheckedAfterClick = await page.$eval(privateButtonSelector, el => el.getAttribute('aria-checked') === 'true');
          if (isCheckedAfterClick) {
            console.log('Successfully set project to private');
            privateSuccess = true;
            break;
          }
        }
        
        if (attempt < CONFIG.retryAttempts - 1) {
          console.log(`Retry attempt ${attempt + 1} for setting private...`);
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        console.error(`Error on private button attempt ${attempt + 1}:`, error.message);
      }
    }
    
    // STEP 2: Click the "hide badge" radio button
    console.log('Setting project to hide badge...');
    const hideBadgeSelector = 'button[type="button"][role="radio"][value="hide"][id="hide-badge"]';
    
    let hideBadgeSuccess = false;
    for (let attempt = 0; attempt < CONFIG.retryAttempts; attempt++) {
      try {
        const hideBadgeButton = await page.$(hideBadgeSelector);
        if (hideBadgeButton) {
          // Check if already selected
          const isAlreadyChecked = await page.$eval(hideBadgeSelector, el => el.getAttribute('aria-checked') === 'true');
          if (isAlreadyChecked) {
            console.log('Badge is already hidden');
            hideBadgeSuccess = true;
            break;
          }
          
          // Click the button
          await hideBadgeButton.click();
          await page.waitForTimeout(2000);
          
          // Verify it's checked now
          const isCheckedAfterClick = await page.$eval(hideBadgeSelector, el => el.getAttribute('aria-checked') === 'true');
          if (isCheckedAfterClick) {
            console.log('Successfully set project to hide badge');
            hideBadgeSuccess = true;
            break;
          }
        }
        
        if (attempt < CONFIG.retryAttempts - 1) {
          console.log(`Retry attempt ${attempt + 1} for hiding badge...`);
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        console.error(`Error on hide badge attempt ${attempt + 1}:`, error.message);
      }
    }
    
    // Return whether both operations were successful
    const success = privateSuccess && hideBadgeSuccess;
    console.log(`Privacy settings update ${success ? 'successful' : 'failed'}`);
    return success;
  } catch (error) {
    console.error('Error updating project privacy:', error.message);
    throw error;
  }
}

// Make the function available for import
module.exports = { updateProjectPrivacy }; 