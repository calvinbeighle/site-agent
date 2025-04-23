const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');

class CheckpointManager {
    constructor(checkpointDir, checkpointFile = 'checkpoint.json') {
        this.checkpointDir = checkpointDir;
        this.checkpointFile = join(checkpointDir, checkpointFile);
        this.processedItems = new Set();
        this.loadCheckpoint();
    }

    loadCheckpoint() {
        try {
            if (existsSync(this.checkpointFile)) {
                console.log('Loading checkpoint...');
                const data = JSON.parse(readFileSync(this.checkpointFile, 'utf-8'));
                this.processedItems = new Set(data.processedItems);
                console.log(`Loaded ${this.processedItems.size} processed items from checkpoint`);
            } else {
                console.log('No checkpoint found, starting fresh');
            }
        } catch (error) {
            console.error('Error loading checkpoint:', error);
            console.log('Starting fresh due to checkpoint loading error');
        }
    }

    saveCheckpoint() {
        try {
            const data = {
                processedItems: Array.from(this.processedItems),
                timestamp: new Date().toISOString()
            };
            writeFileSync(this.checkpointFile, JSON.stringify(data, null, 2));
            console.log(`Saved checkpoint with ${this.processedItems.size} processed items`);
        } catch (error) {
            console.error('Error saving checkpoint:', error);
        }
    }

    isProcessed(item) {
        return this.processedItems.has(item.id);
    }

    markProcessed(item) {
        this.processedItems.add(item.id);
        this.saveCheckpoint();
    }

    markFailed(item) {
        this.processedItems.delete(item.id);
        this.saveCheckpoint();
    }

    getProcessedCount() {
        return this.processedItems.size;
    }

    clearCheckpoint() {
        this.processedItems.clear();
        this.saveCheckpoint();
    }
}

module.exports = CheckpointManager; 