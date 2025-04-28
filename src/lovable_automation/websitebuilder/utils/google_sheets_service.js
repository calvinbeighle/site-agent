const { google } = require('googleapis');

/**
 * Service class for interacting with Google Sheets
 */
class GoogleSheetsService {
  constructor() {
    this.SPREADSHEET_ID = '1VufSCUXoQ6RTNV-BF2xYc3vx0K2d67paid2Cq7ha07M';
    this.SHEET_NAME = 'Sheet1';
    this.auth = null;
    this.sheets = null;
  }

  /**
   * Initialize the Google Sheets API client
   */
  async initialize() {
    try {
      // Use service account auth with specific credentials file
      this.auth = new google.auth.GoogleAuth({
        keyFile: '/Users/calvinbeighle/Desktop/SalesAgent/src/classification/google_credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      const authClient = await this.auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient });
      
      console.log('Google Sheets API initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Google Sheets API:', error);
      throw error;
    }
  }

  /**
   * Get rows from the Google Sheet that match the criteria:
   * - Classification == 1
   * - Site Build Status is empty
   * @returns {Array} Array of record objects
   */
  async getInputRows() {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      // Get all data from the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!A1:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('No data found in sheet');
        return [];
      }

      // Extract headers from first row
      const headers = rows[0];
      
      // Find column indexes
      const websiteColIndex = headers.indexOf('Website');
      const companyNameColIndex = headers.indexOf('Company Name');
      const industryColIndex = headers.indexOf('Industry');
      const classificationColIndex = headers.indexOf('Classification');
      const siteBuildStatusColIndex = headers.indexOf('Site Build Status');

      // Validate required columns exist
      if (websiteColIndex === -1 || companyNameColIndex === -1 || 
          industryColIndex === -1 || classificationColIndex === -1 ||
          siteBuildStatusColIndex === -1) {
        throw new Error('Required columns missing in Google Sheet');
      }

      // Process data rows (skip header row)
      const records = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        // Skip rows that don't meet our criteria
        if (row.length <= classificationColIndex || 
            row[classificationColIndex] !== '1' ||
            (row.length > siteBuildStatusColIndex && row[siteBuildStatusColIndex])) {
          continue;
        }

        // Create record object with all columns as properties
        const record = {};
        headers.forEach((header, index) => {
          record[header] = index < row.length ? row[index] : '';
        });

        // Validate required fields
        if (!record.Website || record.Website.trim() === '') {
          console.warn(`Warning: Skipping row ${i+1} with missing Website`);
          continue;
        }

        records.push(record);
      }

      console.log(`✅ Successfully read ${records.length} rows from Google Sheet`);
      return records;
    } catch (error) {
      console.error('Error reading from Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Append automation log to the specific row's 'Automation Log' cell
   * @param {string} website - Website URL to identify the row
   * @param {string} logValue - Log value to write
   * @returns {boolean} Success status
   */
  async appendAutomationLog(website, logValue) {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      // First, find the row with the matching website
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!A:A`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.error('No data found in sheet when trying to update log');
        return false;
      }

      // Find row index with matching website
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) { // Skip header row
        if (rows[i][0] === website) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        console.error(`Website "${website}" not found in Google Sheet`);
        return false;
      }

      // Get headers to find the Automation Log column
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!1:1`,
      });
      
      const headers = headersResponse.data.values[0];
      const automationLogColIndex = headers.indexOf('Automation Log');
      
      if (automationLogColIndex === -1) {
        console.error('Automation Log column not found in Google Sheet');
        return false;
      }

      // Convert column index to letter (0=A, 1=B, etc.)
      const colLetter = String.fromCharCode(65 + automationLogColIndex);
      
      // Update only the Automation Log cell for this row
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!${colLetter}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[logValue]]
        }
      });

      console.log(`Updated Automation Log for ${website}`);
      return true;
    } catch (error) {
      console.error(`Error updating Automation Log for ${website}:`, error);
      return false;
    }
  }

  /**
   * Update Site Build Status for a specific row
   * @param {string} website - Website URL to identify the row
   * @param {string} status - Status value to set
   * @returns {boolean} Success status
   */
  async updateSiteBuildStatus(website, status) {
    try {
      if (!this.sheets) {
        await this.initialize();
      }

      // First, find the row with the matching website
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!A:A`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.error('No data found in sheet when trying to update site build status');
        return false;
      }

      // Find row index with matching website
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) { // Skip header row
        if (rows[i][0] === website) {
          rowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        console.error(`Website "${website}" not found in Google Sheet`);
        return false;
      }

      // Get headers to find the Site Build Status column
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!1:1`,
      });
      
      const headers = headersResponse.data.values[0];
      const siteBuildStatusColIndex = headers.indexOf('Site Build Status');
      
      if (siteBuildStatusColIndex === -1) {
        console.error('Site Build Status column not found in Google Sheet');
        return false;
      }

      // Convert column index to letter (0=A, 1=B, etc.)
      const colLetter = String.fromCharCode(65 + siteBuildStatusColIndex);
      
      // Update only the Site Build Status cell for this row
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!${colLetter}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[status]]
        }
      });

      console.log(`Updated Site Build Status for ${website} to ${status}`);
      return true;
    } catch (error) {
      console.error(`Error updating Site Build Status for ${website}:`, error);
      return false;
    }
  }

  /**
   * Update Lovable Project URL for a specific row
   * @param {string} website - Website URL to identify the row
   * @param {string} projectUrl - Lovable project URL to set
   * @returns {boolean} Success status
   */
  async updateLovableProjectUrl(website, projectUrl) {
    try {
      if (!this.sheets) await this.initialize();
      const rows = (await this.sheets.spreadsheets.values.get({spreadsheetId: this.SPREADSHEET_ID, range: `${this.SHEET_NAME}!A:A`})).data.values;
      if (!rows || rows.length === 0) return false;
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) if (rows[i][0] === website) { rowIndex = i + 1; break; }
      if (rowIndex === -1) return false;
      const headers = (await this.sheets.spreadsheets.values.get({spreadsheetId: this.SPREADSHEET_ID, range: `${this.SHEET_NAME}!1:1`})).data.values[0];
      const urlColIndex = headers.indexOf('Lovable Project URL');
      if (urlColIndex === -1) return false;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!${String.fromCharCode(65 + urlColIndex)}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[projectUrl]] }
      });
      console.log(`Updated Lovable Project URL for ${website}`);
      return true;
    } catch (error) {
      console.error(`Error updating Lovable Project URL for ${website}:`, error);
      return false;
    }
  }

  /**
   * Update Lovable Site Created Date for a specific row
   * @param {string} website - Website URL to identify the row
   * @param {string} createdDate - Date string to set
   * @returns {boolean} Success status
   */
  async updateLovableSiteCreatedDate(website, createdDate) {
    try {
      if (!this.sheets) await this.initialize();
      const rows = (await this.sheets.spreadsheets.values.get({spreadsheetId: this.SPREADSHEET_ID, range: `${this.SHEET_NAME}!A:A`})).data.values;
      if (!rows || rows.length === 0) return false;
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) if (rows[i][0] === website) { rowIndex = i + 1; break; }
      if (rowIndex === -1) return false;
      const headers = (await this.sheets.spreadsheets.values.get({spreadsheetId: this.SPREADSHEET_ID, range: `${this.SHEET_NAME}!1:1`})).data.values[0];
      const dateColIndex = headers.indexOf('Lovable Site Created Date');
      if (dateColIndex === -1) return false;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!${String.fromCharCode(65 + dateColIndex)}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[createdDate]] }
      });
      console.log(`Updated Lovable Site Created Date for ${website} to ${createdDate}`);
      return true;
    } catch (error) {
      console.error(`Error updating Lovable Site Created Date for ${website}:`, error);
      return false;
    }
  }

  /**
   * Update Lovable Project Name for a specific row
   * @param {string} website - Website URL to identify the row
   * @param {string} projectName - Project name to set
   * @returns {boolean} Success status
   */
  async updateLovableProjectName(website, projectName) {
    try {
      if (!this.sheets) await this.initialize();
      const rows = (await this.sheets.spreadsheets.values.get({spreadsheetId: this.SPREADSHEET_ID, range: `${this.SHEET_NAME}!A:A`})).data.values;
      if (!rows || rows.length === 0) return false;
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) if (rows[i][0] === website) { rowIndex = i + 1; break; }
      if (rowIndex === -1) return false;
      const headers = (await this.sheets.spreadsheets.values.get({spreadsheetId: this.SPREADSHEET_ID, range: `${this.SHEET_NAME}!1:1`})).data.values[0];
      const nameColIndex = headers.indexOf('Lovable Project Name');
      if (nameColIndex === -1) return false;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!${String.fromCharCode(65 + nameColIndex)}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[projectName]] }
      });
      console.log(`Updated Lovable Project Name for ${website} to ${projectName}`);
      return true;
    } catch (error) {
      console.error(`Error updating Lovable Project Name for ${website}:`, error);
      return false;
    }
  }
}

module.exports = new GoogleSheetsService(); 