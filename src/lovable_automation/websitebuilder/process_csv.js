const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify');
const { join } = require('path');

// Function to find the latest CSV file in the classification output directory
function findLatestClassificationCSV() {
    const classificationDir = join(__dirname, '../../../data/classificationoutput');
    console.log('Looking for latest CSV in:', classificationDir);
    
    try {
        // Get all files in the directory
        const files = readdirSync(classificationDir)
            .filter(file => file.endsWith('.csv'))
            .map(file => ({
                name: file,
                path: join(classificationDir, file),
                mtime: statSync(join(classificationDir, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first
        
        if (files.length === 0) {
            throw new Error('No CSV files found in classification output directory');
        }
        
        console.log('Found latest CSV:', files[0].name);
        return files[0].path; // Return the absolute path
    } catch (error) {
        console.error('Error finding latest CSV:', error);
        throw error;
    }
}

// Read the CSV file
const csvFile = findLatestClassificationCSV();
const csvData = readFileSync(csvFile, 'utf-8');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

// Read the prompt template
const templateFile = join(__dirname, 'prompt_template.txt');
const promptTemplate = readFileSync(templateFile, 'utf-8');

// Generate prompts for each company
const enhancedRecords = records.map(record => {
  // Replace variables in the prompt template
  const customPrompt = promptTemplate
    .replace(/\{\{industry_type\}\}/g, record.industry)
    .replace(/\{\{current_website_url\}\}/g, record.website);
  
  // Add the prompt to the record
  return {
    ...record,
    prompt: customPrompt
  };
});

// Save back to the original CSV file
stringify(enhancedRecords, { header: true }, (err, output) => {
  if (err) {
    console.error('Error writing CSV:', err);
    return;
  }
  writeFileSync(csvFile, output);
  console.log(`Generated prompts for ${enhancedRecords.length} companies`);
  console.log(`Updated CSV file: ${csvFile}`);

  // Also update main.js to use these prompts
  const mainJsPath = join(__dirname, 'main.js');
  let mainJsContent = readFileSync(mainJsPath, 'utf-8');

  // Update the relevant part of main.js to use the prompt from CSV
  const updatedMainJs = mainJsContent.replace(
    // Find the part where it generates the prompt from the template
    `// Replace variables in the prompt template
                const prompt = promptTemplate
                    .replace(/\{\{industry_type\}\}/g, row.industry)
                    .replace(/\{\{current_website_url\}\}/g, row.website);`,
    // Replace with using the prompt from the CSV
    `// Use the pre-generated prompt from the CSV
                const prompt = row.prompt || promptTemplate
                    .replace(/\{\{industry_type\}\}/g, row.industry)
                    .replace(/\{\{current_website_url\}\}/g, row.website);`
  );

  // Write the updated main.js
  writeFileSync(mainJsPath, updatedMainJs);
  console.log(`Updated main.js to use the pre-generated prompts`);
}); 