/**
 * API.gs - REST API Documentation & Schemas for Personal Knowledge & Link Keeper
 * 
 * ==========================================
 * GET REQUESTS
 * ==========================================
 * 
 * 1. Initialize Spreadsheet
 *    URL: [WEB_APP_URL]?action=init
 *    Response: { "success": true, "message": "Spreadsheet initialized successfully." }
 * 
 * 2. Get All Links
 *    URL: [WEB_APP_URL]?action=getLinks
 *    Response: { "success": true, "data": [ { "ID": "...", "Title": "...", "Content": "...", "Category": "...", "Tags": "...", "Note": "...", "Favorite": false, "Pinned": false, "CreatedAt": "...", "UpdatedAt": "..." } ] }
 * 
 * 3. Get All Vault Credentials
 *    URL: [WEB_APP_URL]?action=getVault
 *    Response: { "success": true, "data": [ { "ID": "...", "Service": "...", "Username": "...", "Password": "[AES_CIPHERTEXT]", "Note": "...", "Favorite": false, "CreatedAt": "...", "UpdatedAt": "..." } ] }
 * 
 * ==========================================
 * POST REQUESTS
 * ==========================================
 * Note: Send with Content-Type: "text/plain" to bypass CORS preflight.
 * 
 * 1. Add Link
 *    URL: [WEB_APP_URL]
 *    Body: { "action": "addLink", "data": { "Title": "Google", "Content": "https://google.com", "Category": "Work", "Tags": "Search,Google", "Note": "Main search engine", "Favorite": true, "Pinned": false } }
 * 
 * 2. Update Link
 *    URL: [WEB_APP_URL]
 *    Body: { "action": "updateLink", "data": { "ID": "uuid-here", "Title": "Google US", "Favorite": false } }
 * 
 * 3. Delete Link
 *    URL: [WEB_APP_URL]?action=deleteLink&id=uuid-here
 *    OR
 *    Body: { "action": "deleteLink", "data": { "ID": "uuid-here" } }
 * 
 * 4. Add Vault Credential
 *    URL: [WEB_APP_URL]
 *    Body: { "action": "addVault", "data": { "Service": "GitHub", "Username": "octocat", "Password": "[AES_ENCRYPTED_PASSWORD_STRING]", "Note": "Personal account", "Favorite": false } }
 * 
 * 5. Update Vault Credential
 *    URL: [WEB_APP_URL]
 *    Body: { "action": "updateVault", "data": { "ID": "uuid-here", "Username": "octocat-new", "Password": "[NEW_AES_ENCRYPTED_PASSWORD]" } }
 * 
 * 6. Delete Vault Credential
 *    URL: [WEB_APP_URL]?action=deleteVault&id=uuid-here
 *    OR
 *    Body: { "action": "deleteVault", "data": { "ID": "uuid-here" } }
 */

// This file is purely for structure and endpoint reference mapping.
