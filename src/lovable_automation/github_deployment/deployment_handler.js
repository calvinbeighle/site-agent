import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DeploymentHandler {
    constructor() {
        this.baseDir = '/Users/calvinbeighle/Desktop/AngusDesign/angusdesign';
        
        // Create base directory if it doesn't exist
        if (!existsSync(this.baseDir)) {
            mkdirSync(this.baseDir, { recursive: true });
        }
    }

    async cloneAndDeploy(companyName, repoUrl) {
        try {
            const companyDir = join(this.baseDir, companyName);
            
            // Create company directory if it doesn't exist
            if (existsSync(companyDir)) {
                console.log(`Directory ${companyDir} already exists, removing...`);
                await execAsync(`rm -rf ${companyDir}`);
            }

            // Clone the repository
            console.log(`Cloning repository to ${companyDir}...`);
            await execAsync(`git clone ${repoUrl} ${companyDir}`);
            
            // Deploy with Vercel
            console.log('Deploying with Vercel...');
            await execAsync('vercel --prod', { cwd: companyDir });
            
            return companyDir;
        } catch (error) {
            throw new Error(`Deployment failed: ${error.message}`);
        }
    }
} 