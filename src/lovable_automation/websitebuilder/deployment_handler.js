import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { writeFileSync } from 'fs';

const execAsync = promisify(exec);

export class DeploymentHandler {
    constructor(baseDomain = 'angusdesign.com') {
        this.baseDomain = baseDomain;
    }

    generateNginxConfig(companyName, projectDir) {
        const subdomain = `${companyName.toLowerCase()}.${this.baseDomain}`;
        const config = `
server {
    listen 80;
    server_name ${subdomain};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`;
        
        const configPath = join(projectDir, 'nginx.conf');
        writeFileSync(configPath, config);
        return configPath;
    }

    async setupSSL(subdomain) {
        console.log(`Setting up SSL for ${subdomain}...`);
        try {
            // On macOS, certbot works slightly differently
            await execAsync(`sudo certbot --nginx -d ${subdomain} --non-interactive --agree-tos --email admin@${this.baseDomain}`);
            console.log('SSL setup completed successfully');
        } catch (error) {
            throw new Error(`Failed to setup SSL: ${error.message}`);
        }
    }

    async deployProject(companyName, projectDir) {
        const subdomain = `${companyName.toLowerCase()}.${this.baseDomain}`;
        console.log(`Deploying to ${subdomain}...`);

        try {
            // Build the project
            console.log('Building project...');
            await execAsync('npm run build', { cwd: projectDir });

            // Generate and copy nginx config
            console.log('Setting up nginx configuration...');
            const configPath = this.generateNginxConfig(companyName, projectDir);
            
            // macOS nginx paths are different
            const nginxConfigDir = '/usr/local/etc/nginx/servers';
            await execAsync(`sudo mkdir -p ${nginxConfigDir}`);
            await execAsync(`sudo cp ${configPath} ${nginxConfigDir}/${subdomain}.conf`);

            // Start the Next.js application in production mode
            console.log('Starting Next.js application...');
            await execAsync(`pm2 delete "${subdomain}" || true`); // Delete if exists
            await execAsync(`pm2 start npm --name "${subdomain}" -- start`, { cwd: projectDir });

            // Test nginx config and reload
            console.log('Reloading nginx...');
            await execAsync('sudo nginx -t');
            await execAsync('sudo brew services restart nginx');

            // Setup SSL
            await this.setupSSL(subdomain);

            console.log(`Deployment completed successfully for ${subdomain}`);
            return `https://${subdomain}`;
        } catch (error) {
            throw new Error(`Deployment failed: ${error.message}`);
        }
    }
} 