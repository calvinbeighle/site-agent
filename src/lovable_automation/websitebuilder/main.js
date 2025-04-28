const { readFileSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { createObjectCsvWriter } = require('csv-writer');
const { join } = require('path');
const { existsSync, readdirSync, statSync } = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { SiteProcessor } = require('./site_processor.js');
const BrowserManager = require('./utils/browser_manager');
const ResponseHandler = require('./utils/response_handler');
const BatchProcessor = require('./utils/batch_processor');
const CheckpointManager = require('./utils/checkpoint_manager');
const LoginHandler = require('./utils/login_handler');
const PromptGenerator = require('./utils/prompt_generator');
const GoogleSheetsService = require('./utils/google_sheets_service');
const { updateProjectPrivacy } = require('./privateandbadge');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    promptTemplate: 'prompt_template.txt',
    logFile: 'automation_log.csv',
    lovableUrl: 'https://www.lovable.dev/',
    maxEntries: 100,
    startIndex: 0,
    timeout: 500000,  // Increased to 8+ minutes
    userDataDir: join(__dirname, 'browser-data'),
    testMode: false,
    processingDelay: 300000,
    concurrentTabs: 5,  // Reduced from 8 to 2
    delayBetweenPrompts: 30000,  // Increased to 30 seconds
    checkpointDir: join(__dirname, 'checkpoints'),
    skipWebsites: [],
    batchSize: 5,  // Process 5 companies at a time
    delayBetweenBatches: 30000, // 30 seconds between batches
    enableLogin: false,  // Set login process to OFF
    enablePrivacySettings: false,  // Flag to enable/disable privacy settings (privateandbadge)
    waitForAIResponse: true,  // Wait for the AI to respond to the initial prompt
    enableFollowupPrompts: true,  // Enable sending follow-up prompts
    enableProjectRename: true  // Enable project renaming functionality
};

// Initialize managers
const browserManager = new BrowserManager(CONFIG.userDataDir);
const checkpointManager = new CheckpointManager(CONFIG.checkpointDir);
const promptGenerator = new PromptGenerator();

// CSV writer for logging
const csvWriter = createObjectCsvWriter({
    path: CONFIG.logFile,
    header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'industry', title: 'Industry' },
        { id: 'website', title: 'Website' },
        { id: 'status', title: 'Status' },
        { id: 'error', title: 'Error' }
    ]
});

class WebsiteBatchProcessor extends BatchProcessor {
    constructor(config) {
        super(config);
        this.browserManager = browserManager;
        this.checkpointManager = checkpointManager;
        this.promptGenerator = promptGenerator;
        this.loggedIn = false;
    }

    async processItem(item) {
        // Add debug logging to see what's being processed
        console.log(`Processing item with id: ${item.id}, Website: ${item.Website}`);
        
        if (this.checkpointManager.isProcessed(item)) {
            console.log(`Skipping already processed item: ${item.Website} (id: ${item.id})`);
            return { status: 'skipped', error: null };
        }

        if (CONFIG.skipWebsites.includes(item.Website)) {
            console.log(`Skipping excluded website: ${item.Website}`);
            return { status: 'excluded', error: null };
        }

        const page = await this.browserManager.newPage();
        const responseHandler = new ResponseHandler(page);

        try {
            // Navigate to Lovable.dev
            await page.goto(CONFIG.lovableUrl);
            await page.waitForLoadState('domcontentloaded');
            
            // Wait for chat input to be available - we're already logged in
            await responseHandler.waitForElement('#chatinput');

            // Process the prompt
            const result = await this.processPrompt(page, responseHandler, item);
            
            if (result.status === 'success') {
                this.checkpointManager.markProcessed(item);
            } else {
                this.checkpointManager.markFailed(item);
            }

            return result;
        } catch (error) {
            console.error(`Error processing ${item.Website}:`, error);
            this.checkpointManager.markFailed(item);
            return { status: 'error', error: error.message };
        } finally {
            // Only close the page if we're not in KEEP_OPEN mode
            // For now just leave all pages open so that follow-up prompts can work
            console.log(`Keeping browser page open for ${item.Website} to allow follow-up prompts`);
            // Disabled: await page.close();
        }
    }

    async processPrompt(page, responseHandler, item) {
        try {
            // Generate prompt if needed
            const prompt = this.promptGenerator.generatePrompt(item);
            
            // Fill in the prompt
            await responseHandler.fillInput('#chatinput', prompt);
            
            // Submit the prompt
            await responseHandler.clickElement('button[type="submit"]');
            
            // Add the current date to Lovable Site Created Date column
            const currentDate = new Date();
            const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear()}`;
            await GoogleSheetsService.updateLovableSiteCreatedDate(item.Website, formattedDate);
            
            // Update Site Build Status to "done" in Google Sheet right after sending
            await GoogleSheetsService.updateSiteBuildStatus(item.Website, "done");
            
            // Wait 2 seconds for the URL to properly update to project URL
            console.log(`Waiting 2 seconds for URL to update to project URL...`);
            await page.waitForTimeout(2000);
            
            // Capture the current URL without validation - just take whatever URL the browser is on
            const projectUrl = page.url();
            console.log(`Captured project URL: ${projectUrl}`);
            
            // Save the Lovable project URL right after updating the status
            await GoogleSheetsService.updateLovableProjectUrl(item.Website, projectUrl);
            
            // Extract and save the Lovable project name
            try {
                // Wait for the element containing the project name to be available
                await responseHandler.waitForElement('p.hidden.truncate.text-sm.font-medium.md\\:block');
                // Extract the project name text
                const projectName = await page.evaluate(() => {
                    const element = document.querySelector('p.hidden.truncate.text-sm.font-medium.md\\:block');
                    return element ? element.textContent.trim() : '';
                });
                console.log(`Extracted project name: ${projectName}`);
                
                // Save the Lovable project name to Google Sheets
                if (projectName) {
                    await GoogleSheetsService.updateLovableProjectName(item.Website, projectName);
                    console.log(`Saved project name to Google Sheets: ${projectName}`);
                } else {
                    console.log(`Could not find project name in the page`);
                }
            } catch (nameError) {
                console.error(`Error extracting or saving project name: ${nameError.message}`);
                // Continue with normal flow even if project name extraction fails
            }
            
            // Make the project private and hide the badge (only if enabled)
            if (CONFIG.enablePrivacySettings) {
                try {
                    console.log(`Setting project to private and hiding badge...`);
                    await updateProjectPrivacy(page);
                } catch (privacyError) {
                    console.error(`Error setting project privacy: ${privacyError.message}`);
                    // Continue with normal flow even if privacy setting fails
                }
            } else {
                console.log(`Privacy settings disabled - skipping privateandbadge steps`);
            }
            
            // Wait for response from AI (if enabled)
            if (CONFIG.waitForAIResponse) {
                console.log(`Waiting for AI response...`);
                const responseReceived = await responseHandler.waitForResponse();
                if (!responseReceived) {
                    throw new Error('Failed to receive response from AI');
                }
                console.log(`AI response received successfully`);
            } else {
                console.log(`Skipping wait for AI response (disabled in config)`);
            }

            // Process follow-up prompts (if enabled)
            if (CONFIG.enableFollowupPrompts) {
                // Read follow-up prompt files
                const followup404Prompt = readFileSync(join(__dirname, '404_followup_prompt.txt'), 'utf-8');
                const followupImagePrompt = readFileSync(join(__dirname, 'image_followup_prompt.txt'), 'utf-8');
                const followupButtonLinksPrompt = readFileSync(join(__dirname, 'button_links_followup_prompt.txt'), 'utf-8');
                
                // Schedule 404 follow-up prompt (7 minutes after initial submission)
                setTimeout(async () => {
                    try {
                        console.log(`Sending 404 follow-up prompt for ${item['Company Name']}...`);
                        await responseHandler.fillInput('#chatinput', followup404Prompt);
                        await responseHandler.clickElement('button[type="submit"]');
                        console.log(`404 follow-up prompt sent for ${item['Company Name']}`);
                    } catch (error) {
                        console.error(`Error sending 404 follow-up prompt for ${item['Company Name']}:`, error);
                    }
                }, 7 * 60 * 1000); // 7 minutes
                
                // Schedule image follow-up prompt (6 minutes after 404 prompt = 13 minutes after initial)
                setTimeout(async () => {
                    try {
                        console.log(`Sending image follow-up prompt for ${item['Company Name']}...`);
                        await responseHandler.fillInput('#chatinput', followupImagePrompt);
                        await responseHandler.clickElement('button[type="submit"]');
                        console.log(`Image follow-up prompt sent for ${item['Company Name']}`);
                    } catch (error) {
                        console.error(`Error sending image follow-up prompt for ${item['Company Name']}:`, error);
                    }
                }, 13 * 60 * 1000); // 13 minutes (7 + 6)
                
                // Schedule button/links follow-up prompt (4 minutes after image prompt = 17 minutes after initial)
                setTimeout(async () => {
                    try {
                        console.log(`Sending button/links follow-up prompt for ${item['Company Name']}...`);
                        await responseHandler.fillInput('#chatinput', followupButtonLinksPrompt);
                        await responseHandler.clickElement('button[type="submit"]');
                        console.log(`Button/links follow-up prompt sent for ${item['Company Name']}`);
                    } catch (error) {
                        console.error(`Error sending button/links follow-up prompt for ${item['Company Name']}:`, error);
                    }
                }, 17 * 60 * 1000); // 17 minutes (7 + 6 + 4)
                
                console.log(`Follow-up prompts scheduled for ${item['Company Name']}`);
            } else {
                console.log(`Follow-up prompts disabled - skipping follow-up scheduling`);
            }
            
            // Rename the project (if enabled)
            if (CONFIG.enableProjectRename) {
                try {
                    console.log('Attempting to rename project...');
                    // Click the project menu button
                    await responseHandler.clickElement('button[aria-label="Project menu"], button[aria-haspopup="menu"]');
                    await page.waitForTimeout(1000);
                    
                    // Click the Rename option
                    await responseHandler.clickElement('button:has-text("Rename"), [role="menuitem"]:has-text("Rename")');
                    
                    // Fill in the new project name
                    const projectName = `${item['Company Name']}Website`;
                    await responseHandler.clickElement('input[type="text"]');
                    await responseHandler.fillInput('input[type="text"]', projectName);
                    
                    // Click Save
                    await responseHandler.clickElement('button:has-text("Save")');
                    
                    console.log('Project renamed successfully');
                } catch (renameError) {
                    console.log('Could not rename project:', renameError.message);
                }
            } else {
                console.log(`Project renaming disabled - skipping rename steps`);
            }

            return { status: 'success', error: null };
        } catch (error) {
            console.error('Error in processPrompt:', error);
            return { status: 'error', error: error.message };
        }
    }
}

async function readPromptTemplate() {
    try {
        return readFileSync(join(__dirname, CONFIG.promptTemplate), 'utf-8');
    } catch (error) {
        console.error('Error reading prompt template:', error);
        throw error;
    }
}

async function readInputSheet() {
    try {
        console.log('\n=== Google Sheet Input ===');
        
        // Get records from Google Sheets
        const records = await GoogleSheetsService.getInputRows();
        
        // Validate required fields
        const requiredFields = ['Website', 'Company Name', 'Industry'];
        for (const row of records) {
            for (const field of requiredFields) {
                if (!row[field] || row[field].trim() === '') {
                    console.warn(`Warning: Missing required field '${field}' in row with Website: ${row.Website || 'unknown'}`);
                }
            }
        }

        console.log(`✅ Successfully read ${records.length} rows from Google Sheet`);
        return records;
    } catch (error) {
        console.error('Error reading from Google Sheet:', error);
        throw error;
    }
}

async function logResultSheet(timestamp, industry, website, status, error) {
    try {
        // Create a log string similar to what CSV would have
        const logValue = `${timestamp},${industry || ''},${website || ''},${status || ''},${error ? error.toString() : ''}`;
        
        // Update the Google Sheet
        await GoogleSheetsService.appendAutomationLog(website, logValue);
    } catch (error) {
        console.error('Error logging result to Google Sheet:', error);
    }
}

async function findLatestClassificationCSV() {
    const classificationDir = join(__dirname, '../../../data/classificationoutput');
    const files = readdirSync(classificationDir)
        .filter(file => file.endsWith('.csv'))
        .map(file => ({
            name: file,
            path: join(classificationDir, file),
            time: statSync(join(classificationDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
        throw new Error('No CSV files found in classification output directory');
    }

    return files[0].path;
}

async function performInitialLogin() {
    console.log('Performing initial login...');
    
    // Create a login page
    const loginPage = await browserManager.newPage();
    const loginHandler = new LoginHandler(loginPage);
    
    try {
        // Navigate to Lovable.dev
        await loginPage.goto(CONFIG.lovableUrl);
        await loginPage.waitForLoadState('domcontentloaded');
        
        // Perform login
        const loginSuccess = await loginHandler.login();
        if (!loginSuccess) {
            throw new Error('Initial login failed');
        }
        
        console.log('Initial login successful!');
        await loginPage.waitForTimeout(2000); // Make sure login is fully processed
        await loginPage.close();
        return true;
    } catch (error) {
        console.error('Error during initial login:', error);
        await loginPage.close();
        return false;
    }
}

async function main() {
    try {
        // Initialize browser without cleaning data directory
        console.log('Initializing browser...');
        await browserManager.initialize();

        // Only perform login if enabled
        if (CONFIG.enableLogin) {
            console.log('Login is enabled, performing initial login...');
            await performInitialLogin();
        } else {
            console.log('Login is disabled, skipping login process...');
        }

        // Read records from Google Sheet directly
        console.log('Reading data from Google Sheet...');
        const records = await readInputSheet();
        console.log(`Found ${records.length} websites to process`);
        
        // Filter out websites that should be skipped
        const filteredRecords = records.filter(record => !CONFIG.skipWebsites.includes(record.Website));
        console.log(`After filtering, ${filteredRecords.length} websites will be processed`);
        
        // Check for and remove duplicate websites
        const uniqueWebsites = new Set();
        const uniqueRecords = filteredRecords.filter(record => {
            if (uniqueWebsites.has(record.Website)) {
                console.log(`Skipping duplicate website: ${record.Website}`);
                return false;
            }
            uniqueWebsites.add(record.Website);
            return true;
        });
        
        console.log(`After removing duplicates, ${uniqueRecords.length} websites will be processed`);
        
        // Set batch size dynamically - if 5 or fewer websites, process all at once
        const dynamicBatchSize = uniqueRecords.length > 5 ? CONFIG.batchSize : uniqueRecords.length;
        
        // Important: Use concurrent processing
        const batchProcessor = new WebsiteBatchProcessor({
            batchSize: dynamicBatchSize,  // Dynamic batch size
            delayBetweenBatches: CONFIG.delayBetweenBatches, // 30 seconds between batches
            maxConcurrent: dynamicBatchSize  // Process all sites in the batch concurrently
        });

        // Add all records to the queue first
        console.log('Adding all websites to processing queue...');
        
        // Create a Set to track already queued websites to prevent duplication
        const queuedWebsites = new Set();
        
        for (const record of uniqueRecords) {
            // Skip if already queued
            if (queuedWebsites.has(record.Website)) {
                console.log(`Already queued website, skipping duplicate: ${record.Website}`);
                continue;
            }
            
            // Mark as queued and add to processor
            queuedWebsites.add(record.Website);
            batchProcessor.addToQueue({
                id: record.Website,
                Website: record.Website,
                'Company Name': record['Company Name'],
                Industry: record.Industry,
                ...record
            });
        }
        
        // Now process the queue in batches
        console.log(`Processing ${uniqueRecords.length} websites in batches of ${dynamicBatchSize}...`);
        console.log(`Processing ${dynamicBatchSize} websites concurrently with ${CONFIG.delayBetweenBatches}ms delay between batches`);
        const results = await batchProcessor.processQueue();

        // Log results
        for (const [website, result] of results.entries()) {
            await logResultSheet(
                new Date().toISOString(),
                uniqueRecords.find(r => r.Website === website)?.Industry || 'unknown',
                website,
                result.status,
                result.error
            );
        }

        // Wait before starting site processing
        console.log(`\nWaiting ${CONFIG.processingDelay / 1000} seconds for sites to be generated...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.processingDelay));
        
        // Process and deploy the sites
        console.log('\nStarting site processing and deployment...');
        const siteProcessor = new SiteProcessor(join(__dirname, 'sites'));
        
        // Get successful companies
        const successfulCompanies = [];
        for (const [website, result] of results.entries()) {
            if (result.status === 'success') {
                const record = uniqueRecords.find(r => r.Website === website);
                if (record && record['Company Name']) {
                    successfulCompanies.push(record['Company Name']);
                }
            }
        }
        
        if (successfulCompanies.length > 0) {
            const deploymentResults = await siteProcessor.processCompanies(successfulCompanies);
            
            console.log('\n=== Deployment Results ===');
            deploymentResults.forEach(result => {
                if (result.status === 'success') {
                    console.log(`✅ ${result.company}: ${result.url}`);
                } else {
                    console.log(`❌ ${result.company}: ${result.error}`);
                }
            });
            
            // Summary
            const successful = deploymentResults.filter(r => r.status === 'success').length;
            console.log(`\nDeployment summary: ${successful}/${deploymentResults.length} sites successfully deployed`);
        } else {
            console.log('No successful sites to process');
        }

        // Skip browser cleanup at the end
        console.log('Processing complete. Browser will remain open.');
    } catch (error) {
        console.error('Error in main:', error);
        // Don't cleanup on error either
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
} 