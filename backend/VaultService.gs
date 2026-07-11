/**
 * VaultService.gs - Handles CRUD operations for credential cards in the secure vault
 */

/**
 * Fetch all credentials from the "Vault" sheet.
 * @return {Array<Object>} List of credential objects.
 */
function getVault() {
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Vault");
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return []; // Only header row or empty
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  return rows.map(row => rowToObject(headers, row));
}

/**
 * Add a new credential card.
 * @param {Object} data The credential data (Password is encrypted client-side!).
 * @return {Object} The saved credential object.
 */
function addVault(data) {
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Vault");
  
  const id = generateUUID();
  const now = new Date().toISOString();
  
  const newCredential = {
    ID: id,
    Service: data.Service || "Unknown Service",
    Username: data.Username || "",
    Password: data.Password || "", // Already encrypted with CryptoJS client-side!
    Note: data.Note || "",
    Favorite: data.Favorite === true || data.Favorite === "true" ? true : false,
    CreatedAt: now,
    UpdatedAt: now
  };
  
  sheet.appendRow([
    newCredential.ID,
    newCredential.Service,
    newCredential.Username,
    newCredential.Password,
    newCredential.Note,
    newCredential.Favorite,
    newCredential.CreatedAt,
    newCredential.UpdatedAt
  ]);
  
  return newCredential;
}

/**
 * Update an existing credential card.
 * @param {Object} data The updated credential data with ID.
 * @return {Object} The updated credential object.
 */
function updateVault(data) {
  if (!data.ID) {
    throw new Error("Missing ID for update operation");
  }
  
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Vault");
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error("No credentials available to update");
  }
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]);
  const rowIndex = ids.indexOf(data.ID);
  
  if (rowIndex === -1) {
    throw new Error("Credential card not found with ID: " + data.ID);
  }
  
  const actualRow = rowIndex + 2; // +2 for header and 0-indexing
  const now = new Date().toISOString();
  
  // Fetch current values to keep unmodified fields
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentValues = sheet.getRange(actualRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentObj = rowToObject(headers, currentValues);
  
  const updatedCredential = {
    ID: data.ID,
    Service: data.Service !== undefined ? data.Service : currentObj.Service,
    Username: data.Username !== undefined ? data.Username : currentObj.Username,
    Password: data.Password !== undefined ? data.Password : currentObj.Password, // Already encrypted client-side!
    Note: data.Note !== undefined ? data.Note : currentObj.Note,
    Favorite: data.Favorite !== undefined ? (data.Favorite === true || data.Favorite === "true") : currentObj.Favorite,
    CreatedAt: currentObj.CreatedAt,
    UpdatedAt: now
  };
  
  sheet.getRange(actualRow, 1, 1, sheet.getLastColumn()).setValues([[
    updatedCredential.ID,
    updatedCredential.Service,
    updatedCredential.Username,
    updatedCredential.Password,
    updatedCredential.Note,
    updatedCredential.Favorite,
    updatedCredential.CreatedAt,
    updatedCredential.UpdatedAt
  ]]);
  
  return updatedCredential;
}

/**
 * Delete a credential card by ID.
 * @param {string} id The ID of the credential card to delete.
 * @return {boolean} True if deleted, error otherwise.
 */
function deleteVault(id) {
  if (!id) {
    throw new Error("Missing ID for delete operation");
  }
  
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Vault");
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error("No credentials available to delete");
  }
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]);
  const rowIndex = ids.indexOf(id);
  
  if (rowIndex === -1) {
    throw new Error("Credential not found with ID: " + id);
  }
  
  sheet.deleteRow(rowIndex + 2);
  return true;
}
