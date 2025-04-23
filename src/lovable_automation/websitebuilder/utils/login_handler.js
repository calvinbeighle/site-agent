class LoginHandler {
    constructor(page, config = {}) {
        this.page = page;
        this.config = {
            timeout: 30000,
            email: 'calvinbeighle@college.harvard.edu',
            password: '2it?3W*ThLp9',
            ...config
        };
    }

    async login() {
        console.log('Attempting automatic login...');
        
        try {
            // Wait for page to be fully loaded
            await this.page.waitForLoadState('domcontentloaded');
            
            // Click the Sign in button in top right of homepage using its ID
            console.log('Clicking initial Sign in button...');
            const topRightSignIn = await this.page.waitForSelector('#login-link', {
                timeout: this.config.timeout,
                state: 'visible'
            });
            await topRightSignIn.click();
            
            // Wait for the login page to load and email input to be visible
            console.log('Waiting for login form...');
            await this.page.waitForTimeout(2000); // Give page time to transition
            
            // Fill in email on the login page
            console.log('Filling email...');
            await this.page.waitForSelector('input[type="email"]', { timeout: this.config.timeout });
            await this.page.type('input[type="email"]', this.config.email, { delay: 50 });
            
            // Fill in password
            console.log('Filling password...');
            await this.page.waitForSelector('input[type="password"]', { timeout: this.config.timeout });
            await this.page.type('input[type="password"]', this.config.password, { delay: 50 });
            
            // Click the regular Sign in button (not GitHub)
            console.log('Clicking regular Sign in button...');
            const formSignIn = await this.page.waitForSelector('button.bg-primary:has-text("Sign in")', {
                timeout: this.config.timeout,
                state: 'visible'
            });
            await formSignIn.click();
            
            // Wait for successful login by checking for the chat input
            console.log('Waiting for successful login...');
            await this.page.waitForSelector('#chatinput', { timeout: this.config.timeout });
            
            console.log('Successfully logged in!');
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    }
}

module.exports = LoginHandler; 