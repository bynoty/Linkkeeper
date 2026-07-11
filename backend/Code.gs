/**
 * Code.gs - Entry point for Google Apps Script Web App REST API.
 * 
 * To Deploy:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Copy the backend scripts (.gs files) into the editor.
 * 4. Click Save.
 * 5. Click Deploy > New Deployment.
 * 6. Select "Web App".
 * 7. Set Execute as: "Me".
 * 8. Set Who has access: "Anyone".
 * 9. Click Deploy and copy the Web App URL.
 */

/**
 * Handle incoming GET requests.
 * Query parameters: ?action=getLinks, ?action=getVault, ?action=init
 */
function doGet(e) {
  try {
    if (!e || !e.parameter) {
      return createErrorResponse("No parameters provided", 400);
    }
    
    // Check Authorization
    if (!isAuthorized(e)) {
      return createErrorResponse("Unauthorized. Invalid or missing API token.", 401);
    }
    
    const action = e.parameter.action;
    
    if (!action) {
      return createErrorResponse("Missing action parameter", 400);
    }
    
    switch (action) {
      case "init":
        initSpreadsheet();
        return createJsonResponse({ success: true, message: "Spreadsheet initialized successfully." });
        
      case "getLinks":
        const links = getLinks();
        return createJsonResponse({ success: true, data: links });
        
      case "getVault":
        const vault = getVault();
        return createJsonResponse({ success: true, data: vault });
        
      default:
        return createErrorResponse("Unknown GET action: " + action, 404);
    }
  } catch (error) {
    return createErrorResponse("Server Error: " + error.toString(), 500);
  }
}

/**
 * Handle incoming POST requests.
 * The body can be a JSON string containing the action and the data.
 */
function doPost(e) {
  try {
    if (!e) {
      return createErrorResponse("No post data provided", 400);
    }
    
    // Check Authorization
    if (!isAuthorized(e)) {
      return createErrorResponse("Unauthorized. Invalid or missing API token.", 401);
    }
    
    // Parse request body
    let requestData = {};
    if (e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (err) {
        return createErrorResponse("Failed to parse request JSON body: " + err.toString(), 400);
      }
    }
    
    // Action can be in query parameter or request body
    const action = e.parameter.action || requestData.action;
    const payload = requestData.data || requestData;
    
    if (!action) {
      return createErrorResponse("Missing action parameter in query or body", 400);
    }
    
    let result;
    
    switch (action) {
      case "addLink":
        result = addLink(payload);
        return createJsonResponse({ success: true, message: "Link added successfully", data: result });
        
      case "updateLink":
        result = updateLink(payload);
        return createJsonResponse({ success: true, message: "Link updated successfully", data: result });
        
      case "deleteLink":
        const linkId = e.parameter.id || payload.ID || payload.id;
        deleteLink(linkId);
        return createJsonResponse({ success: true, message: "Link deleted successfully", id: linkId });
        
      case "addVault":
        result = addVault(payload);
        return createJsonResponse({ success: true, message: "Credential added successfully", data: result });
        
      case "updateVault":
        result = updateVault(payload);
        return createJsonResponse({ success: true, message: "Credential updated successfully", data: result });
        
      case "deleteVault":
        const vaultId = e.parameter.id || payload.ID || payload.id;
        deleteVault(vaultId);
        return createJsonResponse({ success: true, message: "Credential deleted successfully", id: vaultId });
        
      default:
        return createErrorResponse("Unknown POST action: " + action, 404);
    }
  } catch (error) {
    return createErrorResponse("Server Error: " + error.toString(), 500);
  }
}
