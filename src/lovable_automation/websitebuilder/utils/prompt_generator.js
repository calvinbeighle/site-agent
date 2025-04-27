const { readFileSync } = require('fs');
const { join } = require('path');

class PromptGenerator {
    constructor(config = {}) {
        this.config = {
            promptTemplatePath: join(__dirname, '../prompt_template.txt'),
            ...config
        };
        this.template = this.readTemplate();
    }

    readTemplate() {
        try {
            return readFileSync(this.config.promptTemplatePath, 'utf-8');
        } catch (error) {
            console.error('Error reading prompt template:', error);
            return '';
        }
    }

    generatePrompt(record) {
        if (!this.template) {
            throw new Error('Prompt template is empty or could not be read');
        }

        if (!record.Industry || !record.Website) {
            throw new Error('Record missing required fields (Industry, Website)');
        }

        // If the record already has a prompt, use that
        if (record.prompt) {
            return record.prompt;
        }

        // Otherwise generate a prompt using the template
        let prompt = this.template
            .replace(/\{\{INDUSTRY\}\}/g, record.Industry)
            .replace(/\{\{SITE_URL\}\}/g, record.Website);

        return prompt;
    }
}

module.exports = PromptGenerator; 