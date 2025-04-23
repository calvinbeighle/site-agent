const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const csv = require('csv-parser');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// Configuration
const CONFIG = {
  csvPath: path.join(__dirname, 'lovable_projects.csv'),
  userDataDir: path.join(__dirname, 'browser-data'),
  batchSize: 10,
  timeout: 60000,
  delayBetweenBatches: 5000
};

// Browser Manager class similar to the one in main.js
class BrowserManager {
  constructor(userDataDir) {
    this.userDataDir = userDataDir;
    this.browser = null;
  }

  async initialize() {
    console.log('Initializing browser...');
    
    // Create user data directory if it doesn't exist
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    // Launch browser
    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir: this.userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1280,720'
      ],
      defaultViewport: { width: 1280, height: 720 }
    });

    console.log('Browser initialized successfully');
    return this.browser;
  }

  async newPage() {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const page = await this.browser.newPage();
    
    // Set default timeout
    page.setDefaultTimeout(CONFIG.timeout);
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    return page;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }
}

// Response Handler class similar to the one in main.js
class ResponseHandler {
  constructor(page) {
    this.page = page;
  }

  async waitForElement(selector, timeout = CONFIG.timeout) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.error(`Error waiting for element ${selector}:`, error.message);
      return false;
    }
  }

  async clickElement(selector) {
    await this.waitForElement(selector);
    await this.page.click(selector);
  }

  async fillInput(selector, text) {
    await this.waitForElement(selector);
    await this.page.fill(selector, text);
  }

  async getText(selector) {
    await this.waitForElement(selector);
    return this.page.textContent(selector);
  }
}

// Function to extract domain from prompt text
function extractDomainFromPrompt(promptText) {
  if (!promptText) return '';
  
  // Look for http or www patterns in the text
  const domainRegex = /(https?:\/\/[^\s),"']+|www\.[^\s),"']+)/i;
  const match = promptText.match(domainRegex);
  
  return match ? match[0] : '';
}

// Read existing CSV data to skip already processed projects
async function readExistingData(csvPath) {
  // Check if CSV exists
  if (!fs.existsSync(csvPath)) {
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
    
    fs.createReadStream(csvPath)
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
    await page.goto(projectUrl, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    
    // Extract project name
    const projectName = await page.evaluate(() => {
      const nameElement = document.querySelector('span.flex-shrink.truncate');
      return nameElement ? nameElement.textContent.trim() : '';
    });
    
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
    const promptsData = await page.evaluate(() => {
      // Try different selectors that might contain user prompts
      const promptElements = Array.from(document.querySelectorAll('.prompt-container, .chat-message-user, [data-testid="user-message"]'));
      return promptElements.map(el => el.textContent.trim());
    });
    
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
  console.log('Starting Lovable projects scraper...');
  
  // Read existing data first
  const { processedProjectNames, processedProjectUrls, existingData } = await readExistingData(CONFIG.csvPath);
  
  // Initialize browser manager
  const browserManager = new BrowserManager(CONFIG.userDataDir);
  let browser = null;
  
  try {
    browser = await browserManager.initialize();
    
    // Create a new page for initial navigation
    const mainPage = await browserManager.newPage();
    const handler = new ResponseHandler(mainPage);
    
    // Navigate to the projects page
    console.log('Navigating to Lovable projects page...');
    await mainPage.goto('https://lovable.dev/projects', { waitUntil: 'networkidle2' });
    
    // Check if we need to log in
    const isLoggedIn = await mainPage.evaluate(() => {
      return !window.location.href.includes('/login') && 
             document.querySelector('button[type="submit"][value="login"]') === null;
    });
    
    if (!isLoggedIn) {
      console.log('\n----------------------------------------');
      console.log('Login required. Please log in manually in the browser window.');
      console.log('The script will wait for 2 minutes while you log in.');
      console.log('After logging in, the script will automatically continue.');
      console.log('----------------------------------------\n');
      
      // Wait for login
      let loginSuccess = false;
      const startTime = Date.now();
      const loginTimeout = 120000; // 2 minutes
      
      while (!loginSuccess && Date.now() - startTime < loginTimeout) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
        
        loginSuccess = await mainPage.evaluate(() => {
          return !window.location.href.includes('/login') && 
                 document.querySelector('button[type="submit"][value="login"]') === null;
        });
        
        if (loginSuccess) {
          console.log('Login detected! Continuing with scraping...');
          
          // Navigate back to projects page if needed
          if (!mainPage.url().includes('/projects')) {
            console.log('Navigating to projects page...');
            await mainPage.goto('https://lovable.dev/projects', { waitUntil: 'networkidle2' });
          }
          break;
        } else {
          const remainingTime = Math.round((loginTimeout - (Date.now() - startTime)) / 1000);
          console.log(`Waiting for login... ${remainingTime} seconds remaining`);
        }
      }
      
      if (!loginSuccess) {
        console.log('Login timeout exceeded. Please run the script again after logging in.');
        return existingData;
      }
    }
    
    // Extract project URLs
    const allProjectUrls = await mainPage.evaluate(() => {
      const projectLinks = Array.from(document.querySelectorAll('a[href^="/projects/"]'));
      return projectLinks.map(link => 'https://lovable.dev' + link.getAttribute('href'));
    });
    
    console.log(`Found ${allProjectUrls.length} projects total`);
    
    if (allProjectUrls.length === 0) {
      console.log('No projects found. Make sure you\'re logged in or check the website structure.');
      return existingData;
    }
    
    // Close the main page to free up resources
    await mainPage.close();
    
    // Filter out already processed project URLs
    const projectUrls = allProjectUrls.filter(url => !processedProjectUrls.has(url));
    console.log(`After filtering already processed URLs: ${projectUrls.length} projects remaining`);
    
    // Process projects in batches of 10
    const batchSize = CONFIG.batchSize;
    const allResults = [...existingData];
    
    for (let i = 0; i < projectUrls.length; i += batchSize) {
      const batch = projectUrls.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(projectUrls.length/batchSize)} (${batch.length} projects)`);
      
      // Process projects concurrently
      const batchPromises = [];
      for (const url of batch) {
        const page = await browserManager.newPage();
        batchPromises.push(processProject(page, url).then(result => {
          page.close();
          return result;
        }));
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out projects with empty names and determine which are truly new
      const validResults = batchResults.filter(r => r.projectName && r.projectName !== 'Error');
      const newResults = validResults.filter(r => !processedProjectNames.has(r.projectName));
      
      console.log(`Batch completed: ${validResults.length} valid projects, ${newResults.length} new projects`);
      
      // Update processed sets with new project data
      newResults.forEach(r => {
        processedProjectNames.add(r.projectName);
        processedProjectUrls.add(r.projectUrl);
      });
      
      // Add new results to all results
      allResults.push(...newResults);
      
      // Update the CSV after each batch to prevent data loss if interrupted
      if (newResults.length > 0) {
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
          console.log(`Updated CSV with ${newResults.length} new projects. Total: ${allResults.length}`);
        } catch (csvError) {
          console.error('Error writing to CSV:', csvError);
        }
      }
      
      // Add a small delay between batches to avoid overloading
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
    // Close browser
    if (browserManager) {
      await browserManager.close();
    }
  }
}

// Run the scraper if this file is executed directly
if (require.main === module) {
  scrapeLovableWebsite()
    .then(results => {
      console.log('Scraping completed successfully');
      console.log(`Total projects in database: ${results.length}`);
    })
    .catch(err => {
      console.error('Scraping failed:', err);
      process.exit(1);
    });
}

module.exports = { scrapeLovableWebsite }; 