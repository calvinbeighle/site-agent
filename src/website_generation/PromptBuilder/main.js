import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
    promptTemplate: 'prompt_template.txt',
    logFile: 'automation_log.csv',
    lovableUrl: 'https://www.lovable.dev/',
    maxEntries: 15, // Process next 5 entries (entries 11-15)
    timeout: 120000, // 2 minutes timeout for page operations
    userDataDir: join(__dirname, 'browser-data'), // Directory to store persistent browser data
};

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

async function readPromptTemplate() {
    try {
        return readFileSync(join(__dirname, CONFIG.promptTemplate), 'utf-8');
    } catch (error) {
        console.error('Error reading prompt template:', error);
        throw error;
    }
}

async function readInputCSV(inputFile) {
    try {
        const fileContent = readFileSync(join(__dirname, inputFile), 'utf-8');
        return parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });
    } catch (error) {
        console.error('Error reading input CSV:', error);
        throw error;
    }
}

async function waitForLogin(page) {
    console.log('Please log in to Lovable.dev using GitHub...');
    console.log('Waiting for login to complete...');
    
    // Wait for either the dashboard or the new project button to appear
    await Promise.race([
        page.waitForSelector('a[href="/new-project"]', { timeout: 300000 }),
        page.waitForSelector('.dashboard', { timeout: 300000 })
    ]);
    
    console.log('Successfully logged in!');
}

async function processPrompt(page, prompt, industry, website) {
    try {
        console.log('Navigating to Lovable.dev...');
        // Navigate to Lovable.dev
        await page.goto(CONFIG.lovableUrl);
        await page.waitForLoadState('domcontentloaded');
        
        console.log('Clicking new project button...');
        // Navigate to create new project page
        await page.click('a[href="/new-project"]');
        await page.waitForLoadState('domcontentloaded');
        
        console.log('Looking for prompt input...');
        // Find and fill the prompt input
        const promptInput = await page.waitForSelector('textarea[placeholder*="prompt"]', { timeout: CONFIG.timeout });
        console.log('Found prompt input, filling with prompt...');
        await promptInput.fill(prompt);
        
        console.log('Looking for submit button...');
        // Submit the prompt
        const submitButton = await page.waitForSelector('button[type="submit"]', { timeout: CONFIG.timeout });
        console.log('Found submit button, clicking...');
        await submitButton.click();
        
        console.log('Waiting for success message...');
        // Wait for project creation confirmation
        await page.waitForSelector('.success-message', { timeout: CONFIG.timeout });
        console.log('Success message received!');
        
        return { status: 'success', error: null };
    } catch (error) {
        console.error('Error in processPrompt:', error);
        return { status: 'error', error: error.message };
    }
}

async function logResult(timestamp, industry, website, status, error) {
    await csvWriter.writeRecords([{
        timestamp,
        industry,
        website,
        status,
        error
    }]);
}

async function main() {
    // Check for input file argument
    if (process.argv.length < 3) {
        console.error('Usage: python3 main.js <input_csv_file>');
        process.exit(1);
    }
    
    const inputFile = process.argv[2];
    
    console.log('Launching browser...');
    const browser = await chromium.launchPersistentContext(CONFIG.userDataDir, {
        headless: false,
        args: ['--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        
        // First, give user time to log in
        console.log('Please log in to Lovable.dev using GitHub...');
        console.log('You have 60 seconds to log in...');
        await page.goto(CONFIG.lovableUrl);
        await page.waitForLoadState('domcontentloaded');
        
        // Wait for 60 seconds
        await new Promise(resolve => setTimeout(resolve, 60000));
        
        // Now proceed with processing the prompts
        const promptTemplate = await readPromptTemplate();
        const inputData = await readInputCSV(inputFile);

        // Take only the first 5 entries
        const entriesToProcess = inputData.slice(0, CONFIG.maxEntries);
        
        console.log('\nStarting to process prompts...');
        
        // Process all entries in parallel using separate tabs
        const promises = entriesToProcess.map(async (row) => {
            const timestamp = new Date().toISOString();
            console.log(`Processing: ${row.Industry} - ${row.Website}`);

            // Create a new tab for each prompt
            const tab = await browser.newPage();

            // Replace variables in the prompt template
            const prompt = promptTemplate
                .replace('{{INDUSTRY}}', row.Industry)
                .replace('{{SITE_URL}}', row.Website);

            try {
                console.log('Navigating to Lovable.dev in new tab...');
                await tab.goto(CONFIG.lovableUrl);
                await tab.waitForLoadState('domcontentloaded');
                
                // Wait a bit for the page to fully load
                await tab.waitForTimeout(2000);
                
                console.log('Looking for chat input...');
                // Find the main chat input box
                const chatInput = await tab.waitForSelector('textarea[placeholder*="Ask Lovable to create a portfolio website"]', { 
                    timeout: CONFIG.timeout,
                    state: 'visible'
                });
                
                if (!chatInput) {
                    throw new Error('Could not find chat input field');
                }
                
                console.log('Found chat input, filling with prompt...');
                await chatInput.fill(prompt);
                
                // Wait a bit after filling the prompt
                await tab.waitForTimeout(1000);
                
                console.log('Looking for submit button...');
                // Find the submit button next to the chat input
                const submitButton = await tab.waitForSelector('button[type="submit"]', { 
                    timeout: CONFIG.timeout,
                    state: 'visible'
                });
                
                if (!submitButton) {
                    throw new Error('Could not find submit button');
                }
                
                console.log('Found submit button, clicking...');
                await submitButton.click();
                
                console.log('Waiting for response...');
                // Wait for the response to appear
                await tab.waitForSelector('.message', { timeout: CONFIG.timeout });
                console.log('Response received!');
                
                await logResult(timestamp, row.Industry, row.Website, 'success', null);
                return { status: 'success', error: null };
            } catch (error) {
                console.error('Error in processPrompt:', error);
                await logResult(timestamp, row.Industry, row.Website, 'error', error.message);
                return { status: 'error', error: error.message };
            } finally {
                // Don't close the tab, let the user see the results
            }
        });

        // Wait for all prompts to be processed
        await Promise.all(promises);
        console.log('All prompts processed successfully!');
        
        // Keep the browser open until user presses Enter
        console.log('\nPress Enter to close the browser and exit...');
        await new Promise(resolve => process.stdin.once('data', resolve));
        
    } catch (error) {
        console.error('Error in main process:', error);
    } finally {
        await browser.close();
    }
}

// Run the script
main().catch(console.error); 