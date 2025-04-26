import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitHubSync {
    constructor(page) {
        this.page = page;
        this.baseDir = '/Users/calvinbeighle/Desktop/AngusDesign/angusdesign';
        
        // Create base directory if it doesn't exist
        if (!existsSync(this.baseDir)) {
            mkdirSync(this.baseDir, { recursive: true });
        }
    }

    async syncToGitHub() {
        try {
            // Click the GitHub sync button
            const syncButton = await this.page.waitForSelector('button[aria-haspopup="menu"]:has(svg)', {
                timeout: 30000,
                state: 'visible'
            });
            await syncButton.click();
            
            // Click the Transfer to GitHub button
            const transferButton = await this.page.waitForSelector('button:has-text("Transfer project to GitHub")', {
                timeout: 30000,
                state: 'visible'
            });
            await transferButton.click();
            
            // Click the user profile selection
            const userProfile = await this.page.waitForSelector('.flex.items-center.gap-2:has(img[src*="avatars.githubusercontent.com"])', {
                timeout: 30000,
                state: 'visible'
            });
            await userProfile.click();
            
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

            return repoUrl;
        } catch (error) {
            throw new Error(`GitHub sync failed: ${error.message}`);
        }
    }
} 