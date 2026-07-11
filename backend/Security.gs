/**
 * Security.gs - Documentation and configuration for the end-to-end encryption architecture.
 * 
 * DESIGN PRINCIPLE: Zero-Knowledge Security
 * 
 * 1. Master Password Strategy:
 *    The Master Password is never sent to the Google Apps Script backend or stored anywhere.
 *    It is used purely client-side in the browser to derive a strong key for AES encryption 
 *    and decryption using the CryptoJS library.
 * 
 * 2. Client-Side Encryption:
 *    Before adding or updating any credential in the Vault:
 *    - The plain text password is encrypted using CryptoJS.AES.encrypt(plainText, masterPassword).
 *    - The resulting encrypted string (ciphertext) is what gets sent over the network to Google Sheets.
 * 
 * 3. Client-Side Decryption:
 *    When credentials are fetched:
 *    - The encrypted string is received from Google Sheets.
 *    - CryptoJS.AES.decrypt(ciphertext, masterPassword) is called locally in the browser to reveal the password.
 *    - If the user has not entered the correct master password, decryption fails (returns empty or garbage) 
 *      without making any server calls.
 * 
 * 4. API Endpoints Security:
 *    If REQUIRE_API_TOKEN is set to true in Utils.gs, the Apps Script will require 
 *    an API Token parameter `?token=my-secret-keeper-token` on every request.
 */

/**
 * Checks if a password string looks encrypted.
 * (Optional helper if server-side validations are ever added)
 */
function isEncryptedString(str) {
  if (!str) return false;
  // CryptoJS AES output typically starts with "U2FsdGVkX1" (Salted__ in base64)
  return str.indexOf("U2FsdGVkX1") === 0;
}
