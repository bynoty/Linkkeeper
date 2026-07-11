/**
 * Utils.gs - Helper functions and configuration for the Google Sheets REST API
 */

// Enable this to require a pre-shared API Token in the request headers or parameters (for security)
const REQUIRE_API_TOKEN = false;
const API_TOKEN = "my-secret-keeper-token"; // Change this to secure your API

/**
 * Initialize the Google Spreadsheet with the required sheets and headers if they do not exist.
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Initialize Links Sheet
  let linksSheet = ss.getSheetByName("Links");
  if (!linksSheet) {
    linksSheet = ss.insertSheet("Links");
    linksSheet.appendRow(["ID", "Title", "Content", "Category", "Tags", "Note", "Favorite", "Pinned", "CreatedAt", "UpdatedAt"]);
    // Style headers
    linksSheet.getRange("A1:J1").setFontWeight("bold").setBackground("#f3f4f6");
    linksSheet.setFrozenRows(1);
  }
  
  // 2. Initialize Vault Sheet
  let vaultSheet = ss.getSheetByName("Vault");
  if (!vaultSheet) {
    vaultSheet = ss.insertSheet("Vault");
    vaultSheet.appendRow(["ID", "Service", "Username", "Password", "Note", "Favorite", "CreatedAt", "UpdatedAt"]);
    // Style headers
    vaultSheet.getRange("A1:H1").setFontWeight("bold").setBackground("#f3f4f6");
    vaultSheet.setFrozenRows(1);
  }
  
  // 3. Initialize Settings Sheet
  let settingsSheet = ss.getSheetByName("Settings");
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet("Settings");
    settingsSheet.appendRow(["Key", "Value"]);
    settingsSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#f3f4f6");
    settingsSheet.setFrozenRows(1);
    
    // Add default settings
    settingsSheet.appendRow(["categories", "Work,Personal,Education,Reference,Finance,Social,Entertainment"]);
    settingsSheet.appendRow(["theme", "light"]);
  }
}

/**
 * Creates a CORS-compliant JSON output.
 * @param {Object} data The object to stringify and return.
 * @return {TextOutput} The standard Google Apps Script text output.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates a CORS-compliant error JSON output.
 * @param {string} message The error message.
 * @param {number} code The HTTP-like status code.
 * @return {TextOutput} The standard Google Apps Script text output.
 */
function createErrorResponse(message, code = 400) {
  return createJsonResponse({
    success: false,
    error: message,
    code: code,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper to generate a unique UUID (version 4 approximation).
 * @return {string} A random UUID string.
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validates the API token if enabled.
 * @param {Object} e The request event object.
 * @return {boolean} True if authorized, false otherwise.
 */
function isAuthorized(e) {
  if (!REQUIRE_API_TOKEN) return true;
  
  const token = e.parameter.token || (e.postData && e.postData.contents && JSON.parse(e.postData.contents).token);
  return token === API_TOKEN;
}

/**
 * Converts a sheet row range into a key-value object using the headers.
 * @param {Array} headers The array of column names.
 * @param {Array} rowValues The array of values in the row.
 * @return {Object} The key-value mapped object.
 */
function rowToObject(headers, rowValues) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    let val = rowValues[i];
    
    // Convert string representations of booleans
    if (val === "TRUE" || val === true) val = true;
    else if (val === "FALSE" || val === false) val = false;
    
    obj[key] = val;
  }
  return obj;
}
