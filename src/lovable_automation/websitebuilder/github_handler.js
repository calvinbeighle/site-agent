import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const execAsync = promisify(exec);

export class GitHubHandler {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.reposDir = join(baseDir, 'repos');
        
        // Create repos directory if it doesn't exist
        if (!existsSync(this.reposDir)) {
            mkdirSync(this.reposDir, { recursive: true });
        }
    }

    async waitForRepo(companyName, maxAttempts = 12) { // 12 attempts * 30 seconds = 6 minutes
        console.log(`Waiting for repository for ${companyName}...`);
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const repoUrl = `https://github.com/lovable-tech/${companyName}Website`;
                const response = await fetch(repoUrl);
                
                if (response.status === 200) {
                    console.log(`Repository found for ${companyName}!`);
                    return repoUrl;
                }
            } catch (error) {
                console.log(`Attempt ${attempt}/${maxAttempts}: Repository not ready yet...`);
            }
            
            // Wait 30 seconds before next attempt
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
        
        throw new Error(`Repository for ${companyName} not found after ${maxAttempts} attempts`);
    }

    async cloneRepo(companyName, repoUrl) {
        const companyDir = join(this.reposDir, companyName);
        
        // Create company directory if it doesn't exist
        if (!existsSync(companyDir)) {
            mkdirSync(companyDir, { recursive: true });
        }

        console.log(`Cloning repository for ${companyName}...`);
        try {
            await execAsync(`git clone ${repoUrl} ${companyDir}`);
            console.log(`Successfully cloned repository for ${companyName}`);
            return companyDir;
        } catch (error) {
            throw new Error(`Failed to clone repository for ${companyName}: ${error.message}`);
        }
    }

    async setupRepo(companyDir) {
        console.log('Installing dependencies...');
        try {
            await execAsync('npm install', { cwd: companyDir });
            console.log('Dependencies installed successfully');
        } catch (error) {
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }
    }
} 