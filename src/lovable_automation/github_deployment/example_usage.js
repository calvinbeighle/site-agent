import { chromium } from 'playwright';
import { GitHubDeploymentManager } from './main.js';

async function example() {
    // Launch browser
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Create deployment manager
    const deploymentManager = new GitHubDeploymentManager(page);
    
    // Process a company
    const result = await deploymentManager.processProject('ExampleCompany');
    console.log('Result:', result);
    
    await browser.close();
}

// Run the example
example().catch(console.error); 