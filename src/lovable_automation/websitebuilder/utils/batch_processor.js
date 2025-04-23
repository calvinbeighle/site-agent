class BatchProcessor {
    constructor(config = {}) {
        this.config = {
            batchSize: 5,
            delayBetweenBatches: 30000,
            maxConcurrent: 5,
            delayBetweenItems: 5000,  // 5 second delay between opening tabs
            ...config
        };
        this.queue = [];
        this.processing = false;
        this.results = new Map();
    }

    addToQueue(item) {
        this.queue.push(item);
        return this.queue.length;
    }

    async processQueue() {
        if (this.processing) {
            console.log('Queue is already being processed');
            return this.results;
        }

        this.processing = true;
        console.log(`Starting queue processing with ${this.queue.length} items`);

        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.config.batchSize);
            console.log(`Processing batch of ${batch.length} items`);

            // Process items with a delay between opening each tab
            const promises = [];
            for (const item of batch) {
                // Add delay before processing each item
                if (promises.length > 0) {
                    console.log(`Waiting ${this.config.delayBetweenItems}ms before opening next tab...`);
                                await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenItems));
                            }

                // Add the promise to the array
                promises.push((async () => {
                    try {
                        console.log(`Processing item: ${item.Website}`);
                        const result = await this.processItem(item);
                        this.results.set(item.Website, result);
                        console.log(`Completed processing: ${item.Website}`);
                        return result;
                    } catch (error) {
                        console.error(`Error processing ${item.Website}:`, error);
                        this.results.set(item.Website, { status: 'error', error: error.message });
                        return { status: 'error', error: error.message };
                            }
                })());
                }

            // Wait for all items in the batch to complete
            await Promise.all(promises);

            // Add delay between batches
            if (this.queue.length > 0) {
                console.log(`Waiting ${this.config.delayBetweenBatches}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
            }
        }

        this.processing = false;
        return this.results;
    }

    async processItem(item) {
        return await this.onProcessItem(item);
    }

    getResults() {
        return this.results;
    }

    getQueueLength() {
        return this.queue.length;
    }

    isProcessing() {
        return this.processing;
    }
}

module.exports = BatchProcessor; 