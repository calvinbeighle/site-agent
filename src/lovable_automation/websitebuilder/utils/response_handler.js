class ResponseHandler {
    constructor(page, config = {}) {
        this.page = page;
        this.config = {
            initialTimeout: 120000,     // Increased to 2 minutes
            thinkingTimeout: 300000,    // Increased to 5 minutes
            finalTimeout: 120000,       // Increased to 2 minutes
            maxRetries: 3,
            retryDelay: 1000,
            ...config
        };
    }

    async waitForResponse() {
        try {
            console.log('Waiting for initial response...');
            
            // Wait for any of these selectors that might indicate a response
            await Promise.race([
                this.page.waitForSelector('.message', { timeout: this.config.initialTimeout }),
                this.page.waitForSelector('[data-testid="chat-message"]', { timeout: this.config.initialTimeout }),
                this.page.waitForSelector('.chat-message', { timeout: this.config.initialTimeout }),
                this.page.waitForSelector('.response', { timeout: this.config.initialTimeout })
            ]);
            
            console.log('Initial response detected, waiting for completion...');
            
            // Check for thinking/loading indicators
            const thinkingSelectors = [
                '.thinking-indicator', 
                '.loading-spinner',
                '.loading',
                '[aria-label="Loading"]', 
                '[data-state="loading"]',
                '.typing-indicator'
            ];
            
            // Check each potential thinking indicator
            for (const selector of thinkingSelectors) {
                const isThinking = await this.page.$(selector);
                if (isThinking) {
                    console.log(`Detected thinking indicator: ${selector}`);
                    // Wait for thinking to complete
                    await this.page.waitForSelector(selector, { 
                        state: 'detached',
                        timeout: this.config.thinkingTimeout 
                    }).catch(e => console.log(`Waiting for thinking to complete (${selector}): ${e.message}`));
                }
            }
            
            // Give the page a moment to stabilize
            await this.page.waitForTimeout(5000);
            
            console.log('Response generation completed');
            return true;
        } catch (error) {
            console.error('Response detection failed:', error);
            return false;
        }
    }

    async retryOperation(operation) {
        for (let i = 0; i < this.config.maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (error.message.includes('not attached to the DOM')) {
                    console.log(`Retry ${i + 1}/${this.config.maxRetries} due to detached element`);
                    await this.page.waitForTimeout(this.config.retryDelay * (i + 1)); // Exponential backoff
                    continue;
                }
                throw error;
            }
        }
        throw new Error(`Operation failed after ${this.config.maxRetries} retries`);
    }

    async waitForElement(selector, options = {}) {
        return this.retryOperation(async () => {
            return await this.page.waitForSelector(selector, {
                timeout: this.config.initialTimeout,
                ...options
            });
        });
    }

    async clickElement(selector, options = {}) {
        return this.retryOperation(async () => {
            const element = await this.waitForElement(selector, options);
            await element.click();
        });
    }

    async fillInput(selector, value, options = {}) {
        return this.retryOperation(async () => {
            const element = await this.waitForElement(selector, options);
            await element.fill(value);
        });
    }
}

module.exports = ResponseHandler; 