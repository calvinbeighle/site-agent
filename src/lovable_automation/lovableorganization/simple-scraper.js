const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const csv = require('csv-parser');

// Configuration
const CONFIG = {
  csvPath: path.join(__dirname, 'lovable_projects.csv'),
  userDataDir: path.join(__dirname, 'browser-data-pw'), // Use the same user data dir as before
  batchSize: 10,
  timeout: 120000, // 2 minutes timeout to be safe
  delayBetweenBatches: 5000
};

// Function to extract URL from prompt text
function extractUrlFromPrompt(promptText) {
  if (!promptText) return '';
  
  // Look for http or www patterns in the text
  const urlRegex = /(https?:\/\/[^\s),"']+|www\.[^\s),"']+)/i;
  const match = promptText.match(urlRegex);
  
  return match ? match[0] : '';
}

// Read existing CSV data to skip already processed projects
async function readExistingData() {
  // Check if CSV exists
  if (!fs.existsSync(CONFIG.csvPath)) {
    return {
      processedProjectNames: new Set(),
      processedProjectUrls: new Set(),
      existingData: []
    };
  }
  
  return new Promise((resolve, reject) => {
    const results = [];
    const processedProjectNames = new Set();
    const processedProjectUrls = new Set();
    
    fs.createReadStream(CONFIG.csvPath)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
        // Only track project names and project URLs (not domain URLs)
        if (data['Project Name']) processedProjectNames.add(data['Project Name']);
        if (data['Project URL']) processedProjectUrls.add(data['Project URL']);
      })
      .on('end', () => {
        console.log(`Found ${results.length} already processed projects in CSV`);
        console.log(`Unique project names: ${processedProjectNames.size}, Unique project URLs: ${processedProjectUrls.size}`);
        resolve({
          processedProjectNames,
          processedProjectUrls,
          existingData: results
        });
      })
      .on('error', (error) => reject(error));
  });
}

// Process projects from the main listing page first
async function extractProjectsFromMainPage(page) {
  console.log('Extracting projects from main page...');
  
  // Take screenshot for debugging
  await page.screenshot({ path: path.join(__dirname, 'main-page.png') });
  
  // Projects array to store the initial data
  const projects = [];
  
  // First, look specifically for project cards with the expected structure
  // Looking for elements that contain both the project name AND "edited" timestamp text
  const projectRows = await page.$$('.project-row, tr, [data-testid="project-row"]');
  console.log(`Found ${projectRows.length} potential project rows`);
  
  if (projectRows.length > 0) {
    for (const row of projectRows) {
      try {
        // Check if this is a valid project row - must have project name span and edited time
        const nameElement = await row.$('span.flex-shrink.truncate');
        const editedElement = await row.$('span.text-primary, .edited-time');
        
        if (nameElement && editedElement) {
          const projectName = await nameElement.textContent();
          
          // Get the project URL from the row
          const link = await row.$('a[href*="/projects/"]');
          if (link) {
            const href = await link.getAttribute('href');
            if (href && href.includes('/projects/') && !href.endsWith('/projects/')) {
              const projectUrl = href.startsWith('http') ? href : `https://lovable.dev${href}`;
              
              // Add to projects array if both name and URL are valid
              if (projectName && projectName.trim() && projectUrl) {
                projects.push({ 
                  projectName: projectName.trim(), 
                  projectUrl,
                  key: projectUrl // Use URL as unique key for deduplication
                });
              }
            }
          }
        }
      } catch (e) {
        // Skip problematic rows
      }
    }
  }
  
  // If we still don't have enough projects, try fallback approach with different selectors
  if (projects.length < 200) {
    console.log('Trying alternative selector approach...');
    
    // Try a more targeted approach to find project rows with names and links
    const projectElements = await page.$$eval('a[href*="/projects/"]', links => {
      return links.map(link => {
        // For each link that goes to a project
        const href = link.getAttribute('href');
        if (href && href.includes('/projects/') && !href.endsWith('/projects/')) {
          // Look for the project name span near this link
          const row = link.closest('tr') || link.closest('div[role="row"]') || link.parentElement;
          let projectName = '';
          
          if (row) {
            // Try to find the span with the truncate class for the name
            const nameSpan = row.querySelector('span.flex-shrink.truncate');
            if (nameSpan) {
              projectName = nameSpan.textContent.trim();
            }
          }
          
          // If still no name, try getting it from the link itself
          if (!projectName) {
            const nameElement = link.querySelector('span.flex-shrink.truncate');
            if (nameElement) {
              projectName = nameElement.textContent.trim();
            }
          }
          
          return {
            projectName: projectName || 'Unknown',
            projectUrl: href.startsWith('http') ? href : `https://lovable.dev${href}`,
          };
        }
        return null;
      }).filter(Boolean);
    });
    
    // Add these to the projects array
    if (projectElements.length > 0) {
      for (const proj of projectElements) {
        if (proj.projectName && proj.projectName !== 'Unknown') {
          // Add a key for deduplication
          proj.key = proj.projectUrl;
          projects.push(proj);
        }
      }
    }
  }
  
  // Deduplicate the projects array based on projectUrl
  const uniqueProjects = {};
  for (const project of projects) {
    // Use URL as the unique identifier
    if (!uniqueProjects[project.key]) {
      uniqueProjects[project.key] = project;
    }
  }
  
  // Convert back to an array
  const dedupedProjects = Object.values(uniqueProjects);
  
  console.log(`Extracted ${projects.length} projects before deduplication`);
  console.log(`After deduplication: ${dedupedProjects.length} unique projects`);
  
  // If we're way over the expected count, use a more aggressive filtering approach
  if (dedupedProjects.length > 250) {
    console.log('Too many projects found. Applying more aggressive filtering...');
    
    // Only keep projects that have a proper UUID in the URL
    // Typical URL pattern: https://lovable.dev/projects/97d083a1-89e1-4eb4-8ee8-24d7595081b1
    const uuidRegex = /\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
    
    const filteredProjects = dedupedProjects.filter(project => {
      return uuidRegex.test(project.projectUrl);
    });
    
    console.log(`After UUID filtering: ${filteredProjects.length} valid projects`);
    return filteredProjects;
  }
  
  return dedupedProjects;
}

// Modified process project to only extract URL from first prompt and count prompts
async function processProject(page, project) {
  console.log(`Processing project: ${project.projectName} (${project.projectUrl})`);
  
  try {
    // The page is already navigated to the project URL at this point
    console.log('Page loaded, extracting data...');
    
    // Note: We're not looking for "edited x days ago" on the project page as per user feedback
    let lastEditedText = 'N/A';
    
    // Find all prompts in the project
    // The user example shows prompts with this structure:
    // <div class="break-anywhere jus ml-auto max-w-[80%] overflow-auto whitespace-pre-wrap rounded-lg bg-secondary p-3 text-base leading-[22px]">
    const promptSelectors = [
      '.break-anywhere.jus.ml-auto.whitespace-pre-wrap.rounded-lg.bg-secondary',
      '.break-anywhere.jus',
      'div[class*="break-anywhere jus ml-auto"]',
      '.bg-secondary.p-3.text-base',
      // Fallbacks
      '.prompt-container', 
      '.chat-message-user', 
      '[data-testid="user-message"]',
      '[role="user"]',
      '.user-message',
      '.user-prompt'
    ];
    
    console.log('Searching for prompts with selectors:', promptSelectors.join(', '));
    
    const promptsData = [];
    for (const selector of promptSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} prompts using selector ${selector}`);
          for (const element of elements) {
            const text = await element.textContent();
            promptsData.push(text.trim());
          }
          break;
        }
      } catch (error) {
        console.log(`Error with selector ${selector}:`, error.message);
      }
    }
    
    // If no prompts found via selectors, take screenshot and try text content analysis
    if (promptsData.length === 0) {
      console.log('No prompts found with selectors. Trying alternative methods...');
      
      // Take screenshot for debugging
      await page.screenshot({ path: path.join(__dirname, `debug-${project.projectName.replace(/[^a-z0-9]/gi, '_')}.png`) });
      console.log(`Screenshot saved for debugging.`);
      
      // Try to find text that looks like a prompt based on patterns
      const pageText = await page.evaluate(() => document.body.innerText);
      const possiblePrompts = pageText.split('\n')
        .filter(line => line.length > 100) // Prompts tend to be longer
        .filter(line => !line.includes('Lovable') && !line.includes('Sign in')); // Filter out UI text
      
      if (possiblePrompts.length > 0) {
        console.log(`Found ${possiblePrompts.length} possible prompts from page text`);
        promptsData.push(...possiblePrompts);
      }
    }
    
    // Get the first prompt text
    const firstPromptText = promptsData.length > 0 ? promptsData[0] : '';
    
    // Extract URL from the first prompt instead of domain
    const urlFromPrompt = extractUrlFromPrompt(firstPromptText);
    
    // Count prompts
    const promptCount = promptsData.length;
    
    console.log(`Project data - Name: ${project.projectName}, URL from prompt: ${urlFromPrompt}, Prompts: ${promptCount}`);
    
    // Return data preserving the original project name and URL
    return {
      projectName: project.projectName, // Preserve original project name
      projectUrl: project.projectUrl,   // Preserve original project URL
      urlFromPrompt,
      promptCount,
      lastEdited: lastEditedText
    };
  } catch (error) {
    console.error(`Error processing project ${project.projectUrl}:`, error);
    return {
      projectName: project.projectName, // Preserve original project name even on error
      projectUrl: project.projectUrl,   // Preserve original project URL even on error
      urlFromPrompt: '',
      promptCount: 0,
      lastEdited: 'Error',
      error: error.message
    };
  }
}

// Create initial CSV file with just project names and URLs
async function createInitialCSV(projects, existingData) {
  console.log('Creating initial CSV with project names and URLs...');
  
  // Combine existing data with new projects
  // For projects that already exist in the data, keep their existing data
  const combinedData = [...existingData];
  
  // Track which projects we've already included
  const includedUrls = new Set(existingData.map(item => item.projectUrl));
  
  // Add new projects
  for (const project of projects) {
    if (!includedUrls.has(project.projectUrl)) {
      // Only add basic project data initially
      combinedData.push({
        projectName: project.projectName,
        projectUrl: project.projectUrl,
        urlFromPrompt: '',  // Will be filled in during individual project processing
        promptCount: 0,     // Will be filled in during individual project processing
        lastEdited: 'N/A'
      });
      
      includedUrls.add(project.projectUrl);
    }
  }
  
  // Write to CSV
  try {
    const csvWriter = createObjectCsvWriter({
      path: CONFIG.csvPath,
      header: [
        { id: 'projectName', title: 'Project Name' },
        { id: 'projectUrl', title: 'Project URL' },
        { id: 'urlFromPrompt', title: 'URL From Prompt' },
        { id: 'promptCount', title: 'Number of Prompts' },
        { id: 'lastEdited', title: 'Last Edited' }
      ]
    });
    
    await csvWriter.writeRecords(combinedData);
    console.log(`Created initial CSV with ${combinedData.length} projects`);
    return combinedData;
  } catch (csvError) {
    console.error('Error creating initial CSV:', csvError);
    return existingData;
  }
}

// Update CSV with new data for a specific project
async function updateProjectInCSV(allData, projectUrl, newData) {
  console.log(`Updating CSV for project: ${projectUrl}`);
  
  // Find the project in our data array
  const projectIndex = allData.findIndex(item => item.projectUrl === projectUrl);
  
  if (projectIndex !== -1) {
    // Update only specific fields, preserving project name and URL
    const projectName = allData[projectIndex].projectName;
    const originalUrl = allData[projectIndex].projectUrl;
    
    // Update the project data, keeping original name and URL
    allData[projectIndex] = {
      projectName: projectName,                // Preserve original project name
      projectUrl: originalUrl,                 // Preserve original project URL
      urlFromPrompt: newData.urlFromPrompt,    // Update with new data
      promptCount: newData.promptCount,        // Update with new data
      lastEdited: newData.lastEdited           // Update with new data
    };
  } else {
    // If project doesn't exist, add it (shouldn't happen, but just in case)
    allData.push(newData);
  }
  
  // Write updated data back to CSV
  try {
    const csvWriter = createObjectCsvWriter({
      path: CONFIG.csvPath,
      header: [
        { id: 'projectName', title: 'Project Name' },
        { id: 'projectUrl', title: 'Project URL' },
        { id: 'urlFromPrompt', title: 'URL From Prompt' },
        { id: 'promptCount', title: 'Number of Prompts' },
        { id: 'lastEdited', title: 'Last Edited' }
      ]
    });
    
    await csvWriter.writeRecords(allData);
    console.log(`Updated CSV. Total projects: ${allData.length}`);
    return allData;
  } catch (csvError) {
    console.error('Error updating CSV:', csvError);
    return allData;
  }
}

// Main scraper function
async function scrapeLovableWebsite() {
  console.log('Starting simple Lovable projects scraper...');
  
  // Read existing data first
  const { processedProjectNames, processedProjectUrls, existingData } = await readExistingData();
  
  // Create browser context directory if it doesn't exist
  if (!fs.existsSync(CONFIG.userDataDir)) {
    fs.mkdirSync(CONFIG.userDataDir, { recursive: true });
  }
  
  const browser = await chromium.launchPersistentContext(CONFIG.userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 720 }
  });
  
  try {
    // Create a new page for initial navigation
    const page = await browser.newPage();
    
    // Navigate to the projects page - we assume you're already logged in
    console.log('Navigating to Lovable projects page...');
    await page.goto('https://lovable.dev/projects', { timeout: CONFIG.timeout });
    
    console.log('Please verify you\'re on the projects page...');
    console.log('Press Enter in this terminal to continue scraping...');
    
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // Extract projects from the main page
    const projects = await extractProjectsFromMainPage(page);
    
    // Create initial CSV with just the project names and URLs
    const allResults = await createInitialCSV(projects, existingData);
    
    // Close the main page to free up resources
    await page.close();
    
    // Filter out already processed project URLs
    const newProjects = projects.filter(project => {
      // Check if this URL has been processed with prompt data already
      const existingProject = existingData.find(p => p.projectUrl === project.projectUrl);
      // Only process if not already processed or if it doesn't have prompt data yet
      return !existingProject || !existingProject.urlFromPrompt;
    });
    
    console.log(`After filtering already processed URLs: ${newProjects.length} projects remaining to fully process`);
    
    // Process projects in batches
    const batchSize = CONFIG.batchSize;
    
    for (let i = 0; i < newProjects.length; i += batchSize) {
      const batch = newProjects.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(newProjects.length/batchSize)} (${batch.length} projects)`);
      
      // Process projects in batch (one at a time with random delays)
      for (const project of batch) {
        // Random delay between 3-8 seconds before opening a new tab
        const randomDelay = 3000 + Math.floor(Math.random() * 5000);
        console.log(`Waiting ${randomDelay/1000} seconds before opening next tab...`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        const projectPage = await browser.newPage();
        
        // Navigate to the project page
        console.log(`Navigating to: ${project.projectUrl}`);
        await projectPage.goto(project.projectUrl, { timeout: CONFIG.timeout });
        
        // Wait 30 seconds before running prompt scrapers
        console.log('Waiting 30 seconds before collecting prompts...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
        
        const result = await processProject(projectPage, project);
        await projectPage.close();
        
        // Update this specific project in the CSV
        // This only updates the prompt count and URL from prompt, preserving the original name and URL
        await updateProjectInCSV(allResults, project.projectUrl, result);
      }
      
      // Show progress between batches but continue automatically
      console.log(`\nCompleted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(newProjects.length/batchSize)}`);
      console.log(`Progress: ${Math.min(i + batchSize, newProjects.length)}/${newProjects.length} projects processed`);
    }
    
    console.log(`\nTotal projects in CSV: ${allResults.length}`);
    return allResults;
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    // Don't close browser automatically - let user decide
    console.log('\n----------------------------------------');
    console.log('Scraping completed. Do you want to close the browser? (y/n)');
    console.log('----------------------------------------\n');
    
    const shouldClose = await new Promise(resolve => {
      process.stdin.once('data', data => {
        const input = data.toString().trim().toLowerCase();
        resolve(input === 'y' || input === 'yes');
      });
    });
    
    if (shouldClose) {
      await browser.close();
      console.log('Browser closed');
    } else {
      console.log('Browser left open. You can close it manually when done.');
    }
  }
}

// Run the scraper if this file is executed directly
if (require.main === module) {
  scrapeLovableWebsite()
    .then(results => {
      console.log('Scraping completed successfully');
      console.log(`Total projects in database: ${results.length}`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Scraping failed:', err);
      process.exit(1);
    });
}

module.exports = { scrapeLovableWebsite }; 