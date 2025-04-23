import { GitHubSync } from './github_sync.js';
import { DeploymentHandler } from './deployment_handler.js';

export class GitHubDeploymentManager {
    constructor(page) {
        this.githubSync = new GitHubSync(page);
        this.deploymentHandler = new DeploymentHandler();
    }

    async processProject(companyName) {
        try {
            console.log(`\n=== Processing GitHub sync and deployment for ${companyName} ===`);
            
            // Sync with GitHub
            console.log('Starting GitHub sync...');
            const repoUrl = await this.githubSync.syncToGitHub();
            console.log(`Got repository URL: ${repoUrl}`);
            
            // Clone and deploy
            console.log('Starting deployment...');
            const deployedDir = await this.deploymentHandler.cloneAndDeploy(companyName, repoUrl);
            console.log(`Successfully deployed to ${deployedDir}`);
            
            return {
                status: 'success',
                repoUrl,
                deployedDir
            };
        } catch (error) {
            console.error(`Failed to process ${companyName}:`, error.message);
            return {
                status: 'error',
                error: error.message
            };
        }
    }
} 