const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { join } = require('path');

// Function to find the latest CSV file
function findLatestClassificationCSV() {
    const classificationDir = join(__dirname, '../../../data/classificationoutput');
    const files = readdirSync(classificationDir)
        .filter(file => file.endsWith('.csv') && !file.endsWith('_with_prompts.csv'))
        .map(file => ({
            name: file,
            path: join(classificationDir, file),
            time: statSync(join(classificationDir, file)).birthtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
        throw new Error('No CSV files found in classification output directory');
    }

    return files[0].path;
}

// Find the latest CSV file
const csvFile = findLatestClassificationCSV();
console.log(`Using latest CSV file: ${csvFile}`);

// Read the CSV file
const csvData = readFileSync(csvFile, 'utf-8');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

// Read the prompt template
const templateFile = join(__dirname, 'prompt_template.txt');
const promptTemplate = readFileSync(templateFile, 'utf-8');

// Generate prompts for each company
const enhancedRecords = records.map(record => {
  // Replace variables in the prompt template
  const customPrompt = promptTemplate
    .replace(/\{\{INDUSTRY\}\}/g, record.Industry)
    .replace(/\{\{SITE_URL\}\}/g, record.Website);
  
  // Add the prompt to the record
  return {
    ...record,
    prompt: customPrompt
  };
});

// Save the enhanced records with prompts back to the original CSV
const outputCsv = stringify(enhancedRecords, { header: true });
writeFileSync(csvFile, outputCsv);

console.log(`Generated prompts for ${enhancedRecords.length} companies`);
console.log(`Updated original file: ${csvFile}`); 