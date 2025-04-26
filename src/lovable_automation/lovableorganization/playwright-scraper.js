// A simplified scraper using Playwright instead of Puppeteer for better stability
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const csv = require('csv-parser');

// Configuration
const CONFIG = {
  csvPath: path.join(__dirname, 'lovable_projects.csv'),
  userDataDir: path.join(__dirname, 'browser-data-pw'),
  batchSize: 10,
  timeout: 60000,
  delayBetweenBatches: 5000
};

// Function to extract domain from prompt text
function extractDomainFromPrompt(promptText) {
  if (!promptText) return '';
  
  // Look for http or www patterns in the text
  const domainRegex = /(https?:\/\/[^\s),"']+|www\.[^\s),"']+)/i;
  const match = promptText.match(domainRegex);
  
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

// Process a single project
async function processProject(page, projectUrl) {
  console.log(`Processing project: ${projectUrl}`);
  
  try {
    // Navigate to the project page
    await page.goto(projectUrl, { timeout: CONFIG.timeout });
    await page.waitForLoadState('networkidle');
    
    // Extract project name
    const projectNameElement = await page.$('span.flex-shrink.truncate');
    const projectName = projectNameElement ? await projectNameElement.textContent() : '';
    
    if (!projectName) {
      console.error(`Could not find project name for ${projectUrl}`);
      return {
        projectName: 'Unknown',
        domain: '',
        promptCount: 0,
        projectUrl,
        error: 'Could not find project name'
      };
    }
    
    console.log(`Found project: ${projectName}`);
    
    // Find all prompts in the project
    const promptElements = await page.$$('.prompt-container, .chat-message-user, [data-testid="user-message"]');
    const promptsData = [];
    
    for (const element of promptElements) {
      const text = await element.textContent();
      promptsData.push(text.trim());
    }
    
    // Get the first prompt text
    const firstPromptText = promptsData.length > 0 ? promptsData[0] : '';
    
    // Extract domain from the first prompt
    const domain = extractDomainFromPrompt(firstPromptText);
    
    // Count prompts
    const promptCount = promptsData.length;
    
    console.log(`Project data - Name: ${projectName}, Domain: ${domain}, Prompts: ${promptCount}`);
    
    return {
      projectName,
      domain,
      promptCount,
      projectUrl
    };
  } catch (error) {
    console.error(`Error processing project ${projectUrl}:`, error);
    return {
      projectName: 'Error',
      domain: '',
      promptCount: 0,
      projectUrl,
      error: error.message
    };
  }
}

// Main scraper function
async function scrapeLovableWebsite() {
  console.log('Starting Lovable projects scraper with Playwright...');
  
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
    
    // Navigate to the projects page
    console.log('Navigating to Lovable projects page...');
    await page.goto('https://lovable.dev/projects', { timeout: CONFIG.timeout });
    await page.waitForLoadState('networkidle');
    
    // Check if we need to log in
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login');
    const loginButton = await page.$('button[type="submit"][value="login"]');
    
    if (isLoginPage || loginButton) {
      console.log('\n----------------------------------------');
      console.log('Login required. Please log in manually in the browser window.');
      console.log('After logging in, DO NOT CLOSE THE BROWSER.');
      console.log('The script will automatically continue after login.');
      console.log('If needed, press Enter in this terminal when you\'ve logged in.');
      console.log('----------------------------------------\n');
      
      // Option 1: Wait for navigation away from login page
      try {
        await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 120000 });
        console.log('Login detected! Continuing with scraping...');
      } catch (error) {
        // Option 2: If automatic detection fails, wait for user input
        console.log('Automatic login detection timed out. Press Enter when you\'ve logged in...');
        await new Promise(resolve => {
          process.stdin.once('data', data => {
            console.log('Continuing with scraping based on user input...');
            resolve();
          });
        });
      }
      
      // Check the current URL to determine next steps
      const currentUrlAfterLogin = page.url();
      console.log(`Current URL after login: ${currentUrlAfterLogin}`);
      
      // Navigate to projects page if needed
      if (!currentUrlAfterLogin.includes('/projects')) {
        console.log('Navigating to projects page...');
        await page.goto('https://lovable.dev/projects', { timeout: CONFIG.timeout });
        await page.waitForLoadState('networkidle');
      }
      
      // Give the user time to manually navigate if needed
      console.log('\n----------------------------------------');
      console.log('Please navigate to your projects page if it\'s not already showing.');
      console.log('If you need to navigate manually, do so now.');
      console.log('Press Enter in this terminal when you\'re ready to continue...');
      console.log('----------------------------------------\n');
      
      await new Promise(resolve => process.stdin.once('data', resolve));
      console.log('Continuing with project detection...');
    }
    
    // Try to find project links with a more generic selector
    console.log('Looking for project links...');
    
    // Take a screenshot to debug what we're seeing
    await page.screenshot({ path: path.join(__dirname, 'debug-projects-page.png') });
    console.log(`Screenshot saved to debug-projects-page.png`);
    
    // Debug: Print the page title and URL
    console.log(`Current page: ${page.url()}`);
    console.log(`Page title: ${await page.title()}`);
    
    // Print some page content for debugging
    const pageContent = await page.content();
    fs.writeFileSync(path.join(__dirname, 'page-content.html'), pageContent);
    console.log('Page HTML content saved to page-content.html');
    
    // Try different selectors that might contain project links
    let projectLinks = await page.$$('a[href*="/projects/"]');
    console.log(`Found ${projectLinks.length} project links with 'a[href*="/projects/"]'`);
    
    // If no links found, try other approaches
    if (projectLinks.length === 0) {
      console.log('No projects found on projects page. Checking main page...');
      await page.goto('https://lovable.dev/', { timeout: CONFIG.timeout });
      await page.waitForLoadState('networkidle');
      
      // Take another screenshot
      await page.screenshot({ path: path.join(__dirname, 'debug-main-page.png') });
      console.log(`Screenshot saved to debug-main-page.png`);
      
      projectLinks = await page.$$('a[href*="/projects/"]');
      console.log(`Found ${projectLinks.length} project links on main page`);
      
      // Try getting all links
      if (projectLinks.length === 0) {
        console.log('Checking all links on the page...');
        const allLinks = await page.$$('a');
        console.log(`Found ${allLinks.length} links total`);
        
        // Print all link URLs for debugging
        for (let i = 0; i < Math.min(allLinks.length, 20); i++) {
          const linkHref = await allLinks[i].getAttribute('href');
          const linkText = await allLinks[i].textContent();
          console.log(`Link ${i}: ${linkText.trim()} -> ${linkHref}`);
        }
        
        // One more attempt - check for any card or container that might hold projects
        console.log('Searching for any project card or container...');
        
        // Check for various container elements that might include project links
        const projectContainers = await page.$$('.project-card, .card, .project, .project-container');
        console.log(`Found ${projectContainers.length} potential project containers`);
        
        for (const container of projectContainers) {
          const links = await container.$$('a');
          for (const link of links) {
            const href = await link.getAttribute('href');
            if (href && href.includes('/projects/')) {
              projectLinks.push(link);
            }
          }
        }
      }
    }
    
    const allProjectUrls = [];
    
    for (const link of projectLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        // Handle both absolute and relative URLs
        if (href.startsWith('http')) {
          allProjectUrls.push(href);
        } else {
          allProjectUrls.push('https://lovable.dev' + href);
        }
      }
    }
    
    console.log(`Found ${allProjectUrls.length} projects total`);
    
    if (allProjectUrls.length === 0) {
      console.log('No projects found. Make sure you\'re logged in or check the website structure.');
      return existingData;
    }
    
    // Close the main page to free up resources
    await page.close();
    
    // Filter out already processed project URLs
    const projectUrls = allProjectUrls.filter(url => !processedProjectUrls.has(url));
    console.log(`After filtering already processed URLs: ${projectUrls.length} projects remaining`);
    
    // Process projects in batches
    const batchSize = CONFIG.batchSize;
    const allResults = [...existingData];
    
    for (let i = 0; i < projectUrls.length; i += batchSize) {
      const batch = projectUrls.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(projectUrls.length/batchSize)} (${batch.length} projects)`);
      
      // Process projects sequentially to avoid overwhelming the browser
      for (const url of batch) {
        const projectPage = await browser.newPage();
        const result = await processProject(projectPage, url);
        await projectPage.close();
        
        if (result.projectName && result.projectName !== 'Error' && !processedProjectNames.has(result.projectName)) {
          processedProjectNames.add(result.projectName);
          processedProjectUrls.add(result.projectUrl);
          allResults.push(result);
          
          // Update CSV after each project
          try {
            const csvWriter = createObjectCsvWriter({
              path: CONFIG.csvPath,
              header: [
                { id: 'projectName', title: 'Project Name' },
                { id: 'projectUrl', title: 'Project URL' },
                { id: 'domain', title: 'Domain' },
                { id: 'promptCount', title: 'Number of Prompts' }
              ]
            });
            
            await csvWriter.writeRecords(allResults);
            console.log(`Updated CSV. Total projects: ${allResults.length}`);
          } catch (csvError) {
            console.error('Error writing to CSV:', csvError);
          }
        }
      }
      
      // Add a delay between batches
      if (i + batchSize < projectUrls.length) {
        console.log(`Pausing for ${CONFIG.delayBetweenBatches/1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches));
      }
    }
    
    console.log(`\nTotal projects in CSV: ${allResults.length}`);
    return allResults;
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
    console.log('Browser closed');
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