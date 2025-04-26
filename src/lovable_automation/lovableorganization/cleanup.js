const fs = require('fs');
const path = require('path');

// Directory to clean
const directoryPath = __dirname;

// List all files in the directory
fs.readdir(directoryPath, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    return;
  }

  console.log(`Found ${files.length} files in ${directoryPath}`);
  
  // Files to preserve (don't delete these)
  const preserveFiles = [
    'lovable_projects.csv',
    'lovable_projects_updated.csv',
    'project-updater.js',
    'cleanup.js'
  ];
  
  let deletedCount = 0;
  let preservedCount = 0;
  let errorCount = 0;
  
  // Process each file
  files.forEach(file => {
    const filePath = path.join(directoryPath, file);
    
    // Check if this is a file (not a directory)
    if (fs.lstatSync(filePath).isFile()) {
      // Check if this is a debug PNG file or other temporary file we can delete
      if (file.startsWith('debug-') && file.endsWith('.png')) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Deleted: ${file}`);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting ${file}:`, error);
          errorCount++;
        }
      } else if (!preserveFiles.includes(file)) {
        // For other files, check if they should be preserved
        console.log(`Preserving: ${file}`);
        preservedCount++;
      } else {
        console.log(`Essential file, preserving: ${file}`);
        preservedCount++;
      }
    } else {
      console.log(`Directory, skipping: ${file}`);
    }
  });
  
  console.log('\nCleanup Summary:');
  console.log(`- Deleted: ${deletedCount} files`);
  console.log(`- Preserved: ${preservedCount} files`);
  console.log(`- Errors: ${errorCount} files`);
}); 