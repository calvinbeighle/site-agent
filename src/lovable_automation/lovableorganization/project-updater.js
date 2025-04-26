const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const csv = require('csv-parser');

// Configuration
const CONFIG = {
  csvPath: path.join(__dirname, 'lovable_projects.csv'),
  updatedCsvPath: path.join(__dirname, 'lovable_projects_updated.csv'),
  userDataDir: path.join(__dirname, 'browser-data-pw'), // Use the same user data dir
  timeout: 180000, // 3 minutes timeout
  navigationTimeout: 90000, // 1.5 minute navigation timeout
  delayBetweenProjects: 2000, // 2 seconds between projects (changed from 5000)
  parallelProjects: 1, // Process only 1 project at a time (sequential processing)
  delayBeforeSettings: 10000, // 10 seconds before clicking settings (changed from 60000)
  retryAttempts: 5 // Number of retry attempts for clicking buttons
};

// Read projects from CSV
async function readProjectsFromCSV() {
  console.log(`Reading projects from ${CONFIG.csvPath}...`);
  
  if (!fs.existsSync(CONFIG.csvPath)) {
    console.error(`CSV file does not exist: ${CONFIG.csvPath}`);
    process.exit(1);
  }
  
  return new Promise((resolve, reject) => {
    const projects = [];
    
    fs.createReadStream(CONFIG.csvPath)
      .pipe(csv())
      .on('data', (data) => {
        // Print out the first row's keys to debug column names
        if (projects.length === 0) {
          console.log("CSV columns found:", Object.keys(data));
        }
        
        // Only include entries that have a project URL
        // Use the exact column names as in the CSV
        if (data['Project URL']) {
          projects.push({
            projectName: data['Project Name'] || '',
            projectUrl: data['Project URL'] || '',
            urlFromPrompt: data['URL From Prompt'] || '',
            promptCount: data['Number of Prompts'] || 0,
            lastEdited: data['Last Edited'] || '',
            createdDate: data['Created Date'] || '',
            isPrivate: data['Is Private'] || '',
            hideBadge: data['Hide Badge'] || ''
          });
        }
      })
      .on('end', () => {
        console.log(`Found ${projects.length} projects in CSV`);
        
        // Debug: show first 3 projects
        for (let i = 0; i < Math.min(3, projects.length); i++) {
          console.log(`Project ${i+1}: ${projects[i].projectName} (${projects[i].projectUrl})`);
        }
        
        resolve(projects);
      })
      .on('error', (error) => reject(error));
  });
}

// Update CSV with created dates and mark as processed
async function updateCSV(projects) {
  console.log(`Updating CSV with ${projects.length} projects...`);
  
  // Create a new CSV with all the data, preserving original column names
  const csvWriter = createObjectCsvWriter({
    path: CONFIG.updatedCsvPath,
    header: [
      { id: 'projectName', title: 'Project Name' },
      { id: 'projectUrl', title: 'Project URL' },
      { id: 'urlFromPrompt', title: 'URL From Prompt' },
      { id: 'promptCount', title: 'Number of Prompts' },
      { id: 'lastEdited', title: 'Last Edited' },
      { id: 'createdDate', title: 'Created Date' },
      { id: 'isPrivate', title: 'Is Private' },
      { id: 'hideBadge', title: 'Hide Badge' }
    ]
  });
  
  await csvWriter.writeRecords(projects);
  console.log(`Updated CSV saved to ${CONFIG.updatedCsvPath}`);
  
  // Replace the original CSV with the updated one
  fs.copyFileSync(CONFIG.updatedCsvPath, CONFIG.csvPath);
  console.log(`Original CSV updated`);
}

// Process a single project
async function processProject(page, project) {
  // Skip project if URL is missing
  if (!project.projectUrl) {
    console.log(`Skipping project with missing URL: ${project.projectName || 'Unknown'}`);
    project.createdDate = 'Missing URL';
    project.isPrivate = 'Missing URL';
    project.hideBadge = 'Missing URL';
    return project;
  }
  
  console.log(`Processing project: ${project.projectName} (${project.projectUrl})`);
  
  try {
    // Navigate directly to the project URL
    console.log(`Navigating to: ${project.projectUrl}`);
    await page.goto(project.projectUrl, { timeout: CONFIG.navigationTimeout });
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for 1 minute before interacting
    console.log(`Waiting ${CONFIG.delayBeforeSettings/1000} seconds before interacting...`);
    await page.waitForTimeout(CONFIG.delayBeforeSettings);
    
    // Take a screenshot of the main project page
    const screenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-main.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved main page screenshot to ${screenshotPath}`);
    
    // STEP 1: First click the project menu dropdown
    console.log('Step 1: Clicking project menu dropdown...');
    let menuClicked = false;
    try {
      // Look for button with aria-haspopup="menu" that will open project menu
      const projectMenuButton = await page.$('button[aria-haspopup="menu"]');
      if (projectMenuButton) {
        await projectMenuButton.click();
        
        // Wait for the dropdown to appear and verify it's open
        await page.waitForSelector('button[aria-haspopup="menu"][aria-expanded="true"]', { timeout: 5000 });
        menuClicked = true;
        console.log('Successfully clicked project menu dropdown');
      } else {
        console.log('Could not find project menu dropdown button');
      }
      
      if (!menuClicked) {
        console.error('Failed to open project menu dropdown');
        throw new Error('Failed to open project menu dropdown');
      }
      
      // Take screenshot after dropdown is open
      const dropdownScreenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-dropdown.png`);
      await page.screenshot({ path: dropdownScreenshotPath });
    } catch (error) {
      console.error('Error clicking project menu:', error.message);
      throw new Error('Failed to open project menu dropdown');
    }
    
    // STEP 2: Click on "Project Settings" menu item
    console.log('Step 2: Clicking Project Settings menu item...');
    let settingsClicked = false;
    try {
      // Wait a moment for menu to be fully visible
      await page.waitForTimeout(1000);
      
      // Look for the Project Settings menu item
      const settingsMenuItem = await page.$('div[role="menuitem"]:has-text("Project Settings")');
      if (settingsMenuItem) {
        await settingsMenuItem.click();
        await page.waitForTimeout(3000); // Wait for settings page to load
        settingsClicked = true;
        console.log('Successfully clicked Project Settings menu item');
      } else {
        console.log('Could not find Project Settings menu item');
      }
      
      if (!settingsClicked) {
        // Try alternate approach - go directly to settings URL
        console.log('Trying to navigate directly to settings URL...');
        const settingsUrl = `${project.projectUrl}?settings=general`;
        await page.goto(settingsUrl, { timeout: CONFIG.navigationTimeout });
        settingsClicked = true;
        console.log('Navigated directly to settings URL');
      }
    } catch (error) {
      console.error('Error navigating to settings:', error.message);
      throw new Error('Failed to navigate to project settings');
    }
    
    // Wait for the settings page to load
    await page.waitForTimeout(3000);
    
    // Take screenshot of settings page
    const settingsScreenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-settings.png`);
    await page.screenshot({ path: settingsScreenshotPath });
    console.log(`Saved settings page screenshot to ${settingsScreenshotPath}`);
    
    // Scrape created date
    console.log('Scraping created date...');
    let createdDate = '';
    try {
      // Look for any text that contains a date pattern
      const datePatterns = [
        // Look for various date formats
        /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/,  // 2024-04-30 12:34:56
        /\d{4}-\d{2}-\d{2}/,                     // 2024-04-30
        /\d{2}\/\d{2}\/\d{4}/                    // 04/30/2024
      ];
      
      // Look at all paragraph elements, spans, and divs on the page
      const textElements = await page.$$('p, span, div');
      for (const element of textElements) {
        const text = await element.textContent();
        // Check each date pattern
        for (const pattern of datePatterns) {
          if (pattern.test(text)) {
            const match = text.match(pattern);
            if (match) {
              createdDate = match[0];
              console.log(`Found created date: ${createdDate}`);
              break;
            }
          }
        }
        if (createdDate) break;
      }
      
      if (!createdDate) {
        console.log('Could not find created date with pattern matching');
      }
    } catch (error) {
      console.log('Error extracting created date:', error.message);
    }
    
    // Update the project data
    project.createdDate = createdDate;
    
    // STEP 3: Click the "private" radio button using the exact selector
    console.log('Step 3: Clicking private radio button...');
    try {
      // Take screenshot before clicking
      const prePrivateScreenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-pre-private.png`);
      await page.screenshot({ path: prePrivateScreenshotPath, fullPage: true });

      // Use the exact selector provided by the user
      const privateButtonSelector = 'button[type="button"][role="radio"][value="private"][id="private"]';
      console.log(`Using private button selector: ${privateButtonSelector}`);
      
      const privateButton = await page.$(privateButtonSelector);
      let privateClicked = false;
      
      if (privateButton) {
        // Check if it's already selected
        const isAlreadyChecked = await page.$eval(privateButtonSelector, el => el.getAttribute('aria-checked') === 'true');
        if (isAlreadyChecked) {
          console.log('Private button is already selected');
          privateClicked = true;
        } else {
          // Click the button
          await privateButton.click();
          await page.waitForTimeout(2000);
          
          // Verify that it's now checked
          const isCheckedAfterClick = await page.$eval(privateButtonSelector, el => el.getAttribute('aria-checked') === 'true');
          if (isCheckedAfterClick) {
            console.log('Successfully selected private visibility');
            privateClicked = true;
          } else {
            console.log('Failed to select private visibility - button click did not change state');
          }
        }
      } else {
        console.log('Could not find private radio button with selector');
      }
      
      // Wait 2 seconds as specified
      console.log('Waiting 2 seconds after clicking private button...');
      await page.waitForTimeout(2000);
      
      // Take screenshot after clicking
      const postPrivateScreenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-post-private.png`);
      await page.screenshot({ path: postPrivateScreenshotPath, fullPage: true });
      
      project.isPrivate = privateClicked ? 'Yes' : 'Failed';
      
      // Stop processing if private button click failed
      if (!privateClicked) {
        console.error(`STOPPING EXECUTION: Failed to make project private: ${project.projectName}`);
        throw new Error(`Failed to make project private: ${project.projectName}`);
      }
    } catch (error) {
      console.log('Error clicking private radio button:', error.message);
      project.isPrivate = 'Error';
      // Stop processing
      throw new Error(`Failed to make project private: ${project.projectName}`);
    }
    
    // STEP 4: Click the "hide badge" radio button using the exact selector
    console.log('Step 4: Clicking hide badge radio button...');
    try {
      // Take screenshot before clicking
      const preBadgeScreenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-pre-badge.png`);
      await page.screenshot({ path: preBadgeScreenshotPath, fullPage: true });

      // Use the exact selector provided by the user
      const hideBadgeSelector = 'button[type="button"][role="radio"][value="hide"][id="hide-badge"]';
      console.log(`Using hide badge selector: ${hideBadgeSelector}`);
      
      const hideBadgeButton = await page.$(hideBadgeSelector);
      let hideBadgeClicked = false;
      
      if (hideBadgeButton) {
        // Check if it's already selected
        const isAlreadyChecked = await page.$eval(hideBadgeSelector, el => el.getAttribute('aria-checked') === 'true');
        if (isAlreadyChecked) {
          console.log('Hide badge button is already selected');
          hideBadgeClicked = true;
        } else {
          // Click the button
          await hideBadgeButton.click();
          await page.waitForTimeout(2000);
          
          // Verify that it's now checked
          const isCheckedAfterClick = await page.$eval(hideBadgeSelector, el => el.getAttribute('aria-checked') === 'true');
          if (isCheckedAfterClick) {
            console.log('Successfully selected hide badge option');
            hideBadgeClicked = true;
          } else {
            console.log('Failed to select hide badge option - button click did not change state');
          }
        }
      } else {
        console.log('Could not find hide badge radio button with selector');
      }
      
      // Wait 4 seconds as specified
      console.log('Waiting 4 seconds after clicking hide badge button...');
      await page.waitForTimeout(4000);
      
      // Take screenshot after clicking
      const postBadgeScreenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-post-badge.png`);
      await page.screenshot({ path: postBadgeScreenshotPath, fullPage: true });
      
      project.hideBadge = hideBadgeClicked ? 'Yes' : 'Failed';
      
      // Stop processing if hide badge button click failed
      if (!hideBadgeClicked) {
        console.error(`STOPPING EXECUTION: Failed to hide badge: ${project.projectName}`);
        throw new Error(`Failed to hide badge: ${project.projectName}`);
      }
    } catch (error) {
      console.log('Error clicking hide badge radio button:', error.message);
      project.hideBadge = 'Error';
      // Stop processing
      throw new Error(`Failed to hide badge: ${project.projectName}`);
    }
    
    // Take a final screenshot after all operations
    const finalScreenshotPath = path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}-final.png`);
    await page.screenshot({ path: finalScreenshotPath });
    
    console.log(`Completed processing project: ${project.projectName}`);
    return project;
  } catch (error) {
    console.error(`Error processing project ${project.projectUrl}:`, error);
    project.createdDate = error.message || 'Error';
    project.isPrivate = error.message || 'Error';
    project.hideBadge = error.message || 'Error';
    // Re-throw the error to stop the whole process
    throw error;
  }
}

// Process a batch of projects in parallel
async function processBatch(browser, projects, startIndex, batchSize) {
  console.log(`Processing batch of ${batchSize} projects starting at index ${startIndex}`);
  
  const batch = projects.slice(startIndex, startIndex + batchSize);
  const promises = [];
  const updatedProjects = [...batch];
  
  // Start processing each project in the batch
  for (let i = 0; i < batch.length; i++) {
    const project = batch[i];
    const projectIndex = startIndex + i;
    
    // If project is already processed, skip it
    if (project.createdDate && project.isPrivate === 'Yes' && project.hideBadge === 'Yes') {
      console.log(`Project already processed: ${project.projectName}. Skipping...`);
      continue;
    }
    
    // Create a new tab for this project
    const page = await browser.newPage();
    
    // Add a small delay to prevent opening all tabs at exactly the same time
    const startDelay = i * 1000; // 1 second between each tab opening
    
    // Process each project in its own tab (with promise)
    promises.push(
      (async () => {
        try {
          if (startDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, startDelay));
          }
          
          // Process this project and update the data
          const result = await processProject(page, project);
          updatedProjects[i] = result;
          
          // Close the tab when done
          await page.close();
          
          return projectIndex;
        } catch (error) {
          console.error(`Error in batch processing for project ${project.projectName}:`, error);
          
          // Set error status and close the tab
          updatedProjects[i].createdDate = 'Error';
          updatedProjects[i].isPrivate = 'Error';
          updatedProjects[i].hideBadge = 'Error';
          
          try {
            await page.close();
          } catch (e) {
            // Ignore close errors
          }
          
          return projectIndex;
        }
      })()
    );
  }
  
  // Wait for all projects in the batch to complete
  const completedIndexes = await Promise.all(promises);
  console.log(`Completed processing batch with projects: ${completedIndexes.join(', ')}`);
  
  // Update the projects array with the results
  for (let i = 0; i < updatedProjects.length; i++) {
    projects[startIndex + i] = updatedProjects[i];
  }
  
  // Return the updated projects array
  return projects;
}

// Main function to update all projects
async function updateAllProjects() {
  console.log('Starting project updater...');
  
  // Read existing projects from CSV
  const projects = await readProjectsFromCSV();
  
  // Create browser context directory if it doesn't exist
  if (!fs.existsSync(CONFIG.userDataDir)) {
    fs.mkdirSync(CONFIG.userDataDir, { recursive: true });
  }
  
  // ALWAYS check for and remove SingletonLock
  const singletonLockPath = path.join(CONFIG.userDataDir, 'SingletonLock');
  if (fs.existsSync(singletonLockPath)) {
    console.log('Found existing SingletonLock file, removing it...');
    try {
      fs.unlinkSync(singletonLockPath);
      console.log('Successfully removed SingletonLock file');
    } catch (error) {
      console.error('Error removing SingletonLock file:', error.message);
      // Try force remove with exec
      const { exec } = require('child_process');
      exec(`rm -f "${singletonLockPath}"`, (err, stdout, stderr) => {
        if (err) {
          console.error(`Failed to force remove SingletonLock: ${err.message}`);
        } else {
          console.log('Successfully force removed SingletonLock file');
        }
      });
    }
  }
  
  // Let the system have time to recognize the file removal
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  let browser = null;
  try {
    console.log('Launching browser...');
    browser = await chromium.launchPersistentContext(CONFIG.userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      timeout: CONFIG.timeout
    });
    
    console.log('Browser launched. Starting to process projects...');
    
    // Process projects in batches of the specified size
    const batchSize = CONFIG.parallelProjects;
    for (let i = 0; i < projects.length; i += batchSize) {
      console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(projects.length/batchSize)}`);
      
      try {
        // Process this batch of projects in parallel
        await processBatch(browser, projects, i, batchSize);
        
        // Save progress after each batch
        await updateCSV(projects);
        
        // Add delay between batches to avoid overloading
        if (i + batchSize < projects.length) {
          const batchDelay = CONFIG.delayBetweenProjects * 2; // Double delay between batches
          console.log(`Waiting ${batchDelay/1000} seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      } catch (error) {
        console.error('Error during batch processing, stopping execution:', error);
        // Save the current progress before stopping
        await updateCSV(projects);
        throw error; // Re-throw to exit the loop and function
      }
    }
    
    console.log('\nAll projects processed successfully!');
    return projects;
  } catch (error) {
    console.error('Error during project updates:', error);
    throw error;
  } finally {
    // Don't close browser automatically - let user decide
    if (browser) {
      console.log('\n----------------------------------------');
      console.log('Project updates completed. Do you want to close the browser? (y/n)');
      console.log('----------------------------------------\n');
      
      const shouldClose = await new Promise(resolve => {
        process.stdin.once('data', data => {
          const input = data.toString().trim().toLowerCase();
          resolve(input === 'y' || input === 'yes');
        });
      });
      
      if (shouldClose) {
        try {
          await browser.close();
          console.log('Browser closed');
          
          // Clean up SingletonLock after closing
          const singletonLockPath = path.join(CONFIG.userDataDir, 'SingletonLock');
          if (fs.existsSync(singletonLockPath)) {
            fs.unlinkSync(singletonLockPath);
            console.log('SingletonLock file removed');
          }
        } catch (closeError) {
          console.error('Error closing browser:', closeError.message);
        }
      } else {
        console.log('Browser left open. You can close it manually when done.');
      }
    } else {
      console.log('Browser was not successfully launched or was already closed.');
    }
  }
}

// Run the updater if this file is executed directly
if (require.main === module) {
  // Make sure any existing browser processes are killed before starting
  try {
    const { execSync } = require('child_process');
    console.log('Checking for existing Chrome processes...');
    
    // Check OS type and use appropriate command
    if (process.platform === 'darwin') { // macOS
      execSync('pkill -f "Chromium" || true');
    } else if (process.platform === 'win32') { // Windows
      execSync('taskkill /F /IM chrome.exe /T || true');
    } else { // Linux and others
      execSync('pkill -f "chrome|chromium" || true');
    }
    
    console.log('Ensured no browser processes are running');
  } catch (error) {
    console.log('No existing browser processes needed to be terminated');
  }
  
  updateAllProjects()
    .then(() => {
      console.log('Project updates completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Project updates failed:', err);
      process.exit(1);
    });
}

module.exports = { updateAllProjects }; 