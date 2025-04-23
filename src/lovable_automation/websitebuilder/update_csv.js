const { readFileSync, writeFileSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify');
const { join } = require('path');

// Read the CSV file
const csvFile = join(__dirname, '../../../data/classificationoutput/ng_0415_1658.csv');
console.log(`Reading CSV file: ${csvFile}`);
const csvData = readFileSync(csvFile, 'utf-8');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

// Read the prompt template
const templateFile = join(__dirname, 'prompt_template.txt');
console.log(`Reading prompt template: ${templateFile}`);
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

// Write back to the original CSV file
stringify(enhancedRecords, { header: true }, (err, output) => {
  if (err) {
    console.error('Error generating CSV:', err);
    return;
  }

  try {
    // Write to the original file
    writeFileSync(csvFile, output);
    console.log(`Updated ${enhancedRecords.length} records with prompts in ${csvFile}`);

    // Update main.js to use the updated CSV with the original path
    const mainJsPath = join(__dirname, 'main.js');
    let mainJsContent = readFileSync(mainJsPath, 'utf-8');

    // Make sure main.js uses the original CSV file path
    const updatedMainJs = mainJsContent.replace(
      `// Use the CSV file with prompts
        const inputFile = join(__dirname, 'ng_0415_1658_with_prompts.csv');`,
      `// Use the specified CSV file which now contains prompts
        const inputFile = join(__dirname, '../../../data/classificationoutput/ng_0415_1658.csv');`
    );

    // Also update the part that processes prompts
    const finalMainJs = updatedMainJs.replace(
      `// Replace variables in the prompt template
                const prompt = promptTemplate
                    .replace(/\{\{industry_type\}\}/g, row.industry)
                    .replace(/\{\{current_website_url\}\}/g, row.website);`,
      `// Use the pre-generated prompt from the CSV
                const prompt = row.prompt || promptTemplate
                    .replace(/\{\{industry_type\}\}/g, row.industry)
                    .replace(/\{\{current_website_url\}\}/g, row.website);`
    );

    // Write the updated main.js
    writeFileSync(mainJsPath, finalMainJs);
    console.log(`Updated main.js to use the CSV with prompts`);
  } catch (error) {
    console.error(`Error updating files:`, error);
  }
}); 