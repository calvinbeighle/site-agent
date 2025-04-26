const { chromium } = require('playwright');
const { join } = require('path');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const { stringify } = require('csv-stringify/sync');

const execAsync = promisify(exec);

class GitHubSync {
    constructor(page) {
        this.page = page;
    }

    async syncToGitHub() {
        try {
            console.log('Starting GitHub sync...');
            // Click the GitHub sync button
            const syncButton = await this.page.waitForSelector('button[aria-haspopup="menu"]:has(svg)', {
                timeout: 30000,
                state: 'visible'
            });
            await syncButton.click();
            console.log('Clicked sync button');
            
            // Click the Transfer to GitHub button
            const transferButton = await this.page.waitForSelector('button:has-text("Transfer project to GitHub")', {
                timeout: 30000,
                state: 'visible'
            });
            await transferButton.click();
            console.log('Clicked transfer to GitHub button');
            
            // Click the user profile selection
            const userProfile = await this.page.waitForSelector('.flex.items-center.gap-2:has(img[src*="avatars.githubusercontent.com"])', {
                timeout: 30000,
                state: 'visible'
            });
            await userProfile.click();
            console.log('Clicked user profile');
            
            // Wait 30 seconds as specified
            console.log('Waiting 30 seconds for GitHub process...');
            await this.page.waitForTimeout(30000);
            
            // Get the GitHub URL
            const repoUrl = await this.page.evaluate(() => {
                const element = document.querySelector('button:has(svg[viewBox="0 -960 960 960"])');
                return element?.parentElement?.textContent || '';
            });
            
            if (!repoUrl) {
                throw new Error('Could not find GitHub repository URL');
            }

            console.log(`Found GitHub URL: ${repoUrl}`);
            return repoUrl;
        } catch (error) {
            console.error('Error in GitHub sync:', error);
            throw new Error(`GitHub sync failed: ${error.message}`);
        }
    }
}

class SiteProcessor {
    constructor(sitesDir) {
        this.sitesDir = sitesDir;
        this.deploymentResults = [];
        if (!existsSync(sitesDir)) {
            mkdirSync(sitesDir, { recursive: true });
        }
    }

    async processCompanies(companies) {
        const results = [];
        
        // Launch a browser for GitHub interactions
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        
        try {
            // Log in to Lovable.dev
            const page = await context.newPage();
            await this.loginToLovable(page);
            
            for (const company of companies) {
                try {
                    const result = await this.processCompany(company, page);
                    results.push({ company, status: 'success', url: result });
                    this.deploymentResults.push({ company, url: result, status: 'success' });
                } catch (error) {
                    console.error(`Error processing company ${company}:`, error);
                    results.push({ company, status: 'error', error: error.message });
                    this.deploymentResults.push({ company, url: '', status: 'error', error: error.message });
                }
            }
            
            // Save results to CSV
            this.saveResultsToCsv();
            
        } catch (error) {
            console.error('Error in processing companies:', error);
        } finally {
            // Close browser
            await browser.close();
        }
        
        return results;
    }
    
    async loginToLovable(page) {
        try {
            console.log('Logging in to Lovable.dev...');
            await page.goto('https://www.lovable.dev/');
            
            // Click login button
            const loginButton = await page.waitForSelector('#login-link', {
                timeout: 30000,
                state: 'visible'
            });
            await loginButton.click();
            
            // Wait for login form
            await page.waitForTimeout(2000);
            
            // Fill credentials
            await page.fill('input[type="email"]', 'calvinbeighle@college.harvard.edu');
            await page.fill('input[type="password"]', '2it?3W*ThLp9');
            
            // Click sign in
            const signInButton = await page.waitForSelector('button.bg-primary:has-text("Sign in")');
            await signInButton.click();
            
            // Wait for successful login
            await page.waitForSelector('#chatinput', { timeout: 30000 });
            console.log('Successfully logged in to Lovable.dev');
        } catch (error) {
            console.error('Login failed:', error);
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    async processCompany(company, page) {
        try {
            console.log(`\nProcessing company: ${company}`);
            
            // Navigate to projects
            await page.goto('https://www.lovable.dev/projects');
            await page.waitForSelector('h1:has-text("Projects")');
            
            // Search for company project
            const projectName = `${company}Website`;
            console.log(`Looking for project: ${projectName}`);
            
            // Wait for projects to load
            await page.waitForTimeout(3000);
            
            // Click on the project
            const projectCard = await page.waitForSelector(`div:has-text("${projectName}")`, {
                timeout: 30000,
                state: 'visible'
            });
            await projectCard.click();
            console.log('Clicked on project');
            
            // Wait for project to load
            await page.waitForTimeout(5000);
            
            // Sync to GitHub
            const gitHubSync = new GitHubSync(page);
            const repoUrl = await gitHubSync.syncToGitHub();
            
            // Clone repository and set up locally
            const cloneDir = join(this.sitesDir, company);
            console.log(`Cloning repository to ${cloneDir}...`);
            
            // Remove directory if it exists
            if (existsSync(cloneDir)) {
                await execAsync(`rm -rf "${cloneDir}"`);
            }
            
            // Clone the repository
            await execAsync(`git clone ${repoUrl} "${cloneDir}"`);
            console.log(`Successfully cloned repository for ${company}`);
            
            return repoUrl;
        } catch (error) {
            console.error(`Error in processCompany for ${company}:`, error);
            throw error;
        }
    }
    
    saveResultsToCsv() {
        try {
            const csvData = stringify(this.deploymentResults, { header: true });
            const csvPath = join(this.sitesDir, 'deployment_results.csv');
            writeFileSync(csvPath, csvData);
            console.log(`Saved deployment results to ${csvPath}`);
        } catch (error) {
            console.error('Error saving results to CSV:', error);
        }
    }
}

module.exports = { SiteProcessor };
