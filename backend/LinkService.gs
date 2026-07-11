/**
 * LinkService.gs - Handles CRUD operations for links and knowledge notes
 */

/**
 * Fetch all links from the "Links" sheet.
 * @return {Array<Object>} List of link objects.
 */
function getLinks() {
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Links");
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return []; // Only header row or empty
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  return rows.map(row => rowToObject(headers, row));
}

/**
 * Add a new link.
 * @param {Object} data The link data.
 * @return {Object} The saved link object.
 */
function addLink(data) {
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Links");
  
  const id = generateUUID();
  const now = new Date().toISOString();
  
  const newLink = {
    ID: id,
    Title: data.Title || "Untitled Link",
    Content: data.Content || "",
    Category: data.Category || "General",
    Tags: data.Tags || "", // Stored as comma-separated string e.g. "AI,Python"
    Note: data.Note || "",
    Favorite: data.Favorite === true || data.Favorite === "true" ? true : false,
    Pinned: data.Pinned === true || data.Pinned === "true" ? true : false,
    CreatedAt: now,
    UpdatedAt: now
  };
  
  sheet.appendRow([
    newLink.ID,
    newLink.Title,
    newLink.Content,
    newLink.Category,
    newLink.Tags,
    newLink.Note,
    newLink.Favorite,
    newLink.Pinned,
    newLink.CreatedAt,
    newLink.UpdatedAt
  ]);
  
  return newLink;
}

/**
 * Update an existing link.
 * @param {Object} data The updated link data with ID.
 * @return {Object} The updated link object.
 */
function updateLink(data) {
  if (!data.ID) {
    throw new Error("Missing ID for update operation");
  }
  
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Links");
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error("No links available to update");
  }
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]);
  const rowIndex = ids.indexOf(data.ID);
  
  if (rowIndex === -1) {
    throw new Error("Link not found with ID: " + data.ID);
  }
  
  const actualRow = rowIndex + 2; // +2 for header and 0-indexing
  const now = new Date().toISOString();
  
  // Fetch current values to keep unmodified fields
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentValues = sheet.getRange(actualRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  const currentObj = rowToObject(headers, currentValues);
  
  const updatedLink = {
    ID: data.ID,
    Title: data.Title !== undefined ? data.Title : currentObj.Title,
    Content: data.Content !== undefined ? data.Content : currentObj.Content,
    Category: data.Category !== undefined ? data.Category : currentObj.Category,
    Tags: data.Tags !== undefined ? data.Tags : currentObj.Tags,
    Note: data.Note !== undefined ? data.Note : currentObj.Note,
    Favorite: data.Favorite !== undefined ? (data.Favorite === true || data.Favorite === "true") : currentObj.Favorite,
    Pinned: data.Pinned !== undefined ? (data.Pinned === true || data.Pinned === "true") : currentObj.Pinned,
    CreatedAt: currentObj.CreatedAt,
    UpdatedAt: now
  };
  
  sheet.getRange(actualRow, 1, 1, sheet.getLastColumn()).setValues([[
    updatedLink.ID,
    updatedLink.Title,
    updatedLink.Content,
    updatedLink.Category,
    updatedLink.Tags,
    updatedLink.Note,
    updatedLink.Favorite,
    updatedLink.Pinned,
    updatedLink.CreatedAt,
    updatedLink.UpdatedAt
  ]]);
  
  return updatedLink;
}

/**
 * Delete a link by ID.
 * @param {string} id The ID of the link to delete.
 * @return {boolean} True if deleted, error otherwise.
 */
function deleteLink(id) {
  if (!id) {
    throw new Error("Missing ID for delete operation");
  }
  
  initSpreadsheet();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Links");
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error("No links available to delete");
  }
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => row[0]);
  const rowIndex = ids.indexOf(id);
  
  if (rowIndex === -1) {
    throw new Error("Link not found with ID: " + id);
  }
  
  sheet.deleteRow(rowIndex + 2);
  return true;
}
