# Change Log - LinkKeeper Knowledge Base

All notable changes to the **LinkKeeper Knowledge Base** project will be documented in this file.

---

## [2.1.2] - 2026-08-06 (Chrome Extension MV3 Popup CSP Fix)

### 🐛 Fixed (การแก้ไขข้อผิดพลาด)
- **Manifest V3 Inline Script Violation Fix (แก้ไขปุ่ม Extension ไม่ตรวจจับชื่อเว็บ/กดแล้วไม่ทำงาน)**:
  - แก้ไขสาเหตุที่ Chrome Extension ค้างอยู่ที่ `"Detecting tab title..."` และกดปุ่ม `➕ Save Webpage to LinkKeeper` แล้วไม่มีอะไรเกิดขึ้น
  - **สาเหตุ:** นโยบายความปลอดภัย Content Security Policy (CSP) ของ Chrome Extension Manifest V3 ไม่อนุญาตให้ใช้ Inline `<script>` code ร่วมกับ `popup.html`
  - **การแก้ไข:** แยก Logic Script ทั้งหมดออกเป็นไฟล์ `popup.js` ภายในแพ็กเกจ ZIP และเรียกใช้ผ่าน `<script src="popup.js"></script>` พร้อมปรับเปลี่ยนคำสั่งเปิดแท็บเป็น `chrome.tabs.create()` เพื่อให้ตรวจจับ URL และ Title ของหน้าเว็บที่กำลังเปิดอยู่ได้อย่างแม่นยำ 100%

---

## [2.1.1] - 2026-08-06 (Chrome Web Extension Zip Package & Quick Saver Prefill Fix)

### 🐛 Fixed (การแก้ไขข้อผิดพลาด)
- **Chrome Extension Manifest V3 Icon Path Fix**:
  - แก้ไขปัญหา `Invalid value for 'icons["128"]'. Could not load manifest.` ใน Chrome / Edge Developer mode
  - เปลี่ยนโครงสร้าง `manifest.json` จากเดิมที่อ้างอิง URL ภายนอก เป็นไฟล์ไอคอนในโฟลเดอร์ส่วนขยาย (`icon128.png`)
  - เพิ่มระบบสร้างแพ็กเกจ **`LinkKeeperExtension.zip`** อัตโนมัติใน 1-Click (ใช้ `JSZip`) เมื่อแตกไฟล์ ZIP แล้วสามารถนำไปโหลดใน `chrome://extensions` ได้ทันทีโดยไม่พบข้อผิดพลาด

- **Bookmarklet & Extension Auto-Prefill Handling**:
  - เพิ่มระบบรองรับ Parameter `add_url` และ `add_title` จาก URL Search Query
  - เมื่อผู้ใช้กดปุ่ม **Save to LinkKeeper** จาก Bookmarklet หรือ Chrome Extension ระบบจะเปิดหน้า **Quick Add** พร้อมกรอก URL, ชื่อเว็บ (Title), แนะนำหมวดหมู่อัตโนมัติ (Category Suggestion), และตรวจสอบลิงก์ซ้ำให้อย่างราบรื่น

---

## [2.1.0] - 2026-08-05 (Auto Weekly Backup & Explicit Status Badges)

### 🚀 Added (ฟีเจอร์ใหม่)
- **Auto Backup Schedule to Google Drive / Sheets**:
  - ตั้งเวลาสำรองข้อมูลลง Google Sheets อัตโนมัติในเบื้องหลัง (ความถี่เริ่มต้น: สัปดาห์ละ 1 ครั้ง หรือเลือกปรับเป็นรายเดือนได้)
  - ระบบตรวจสอบวันที่สำรองข้อมูลล่าสุด (`lastAutoBackupDate`) และรันการสำรองข้อมูลลง Google Sheet ส่วนตัวอัตโนมัติเมื่อผู้ใช้เข้าใช้งานแอปพลิเคชัน
  - สามารถเปิด/ปิด ตั้งค่าความถี่ และดูวันเวลาสำรองข้อมูลล่าสุดได้จากหน้า **Settings -> Google Drive Direct Synchronization**

### 🛠️ Changed (การปรับปรุง UI/UX)
- **Explicit Status Indicators & Smart Token Renewal Handling**:
  - **แยกสถานะการล็อกอินและ Access Token ชัดเจน**: ปรับปรุงหน้า Diagnostics ให้แยกแยะระหว่าง **"การเข้าสู่ระบบหลัก (Firebase Auth) ซึ่งยังคงทำงานปกติ 24/7"** กับ **"Google OAuth Access Token สำหรับ Google Sheets API ซึ่งหมดอายุตามนโยบายความปลอดภัย 1 ชั่วโมงของ Google"**
  - เปลี่ยนการแสดงผลจากเดิมที่เป็นสีแดงเตือน "Error Detected" เมื่อ Token หมดอายุ เป็นสีส้ม **`⚡ Token Renewal Needed`** พร้อมแบนเนอร์คำอธิบายและปุ่ม **`[ ⚡ Reconnect / Renew Token ]`** เพื่อต่ออายุสิทธิ์ Google Sheets ได้ใน 1-Click
  - ระบบล้างสถานะข้อผิดพลาดอัตโนมัติทันทีที่กด Reconnect หรือเข้าสู่ระบบสำเร็จ
  - ปรับปรุงป้ายสถานะบนแถบเมนูหลักส่วนบน (Top Header Navigation Bar) ให้แยกสถานะอย่างชัดเจน:
    1. **`Net: Online / Offline`**: แสดงสถานะการเชื่อมต่ออินเทอร์เน็ตของเบราว์เซอร์
    2. **`Sheets: Active / Reconnect`**: แสดงสถานะการเชื่อมต่อซิงค์ไฟล์กับ Google Drive / Google Sheets (และเตือนเมื่อ OAuth Access Token หมดอายุเพื่อให้กด Reconnect ได้ทันที)

---

## [2.0.0] - 2026-08-05 (Firebase Firestore & Hybrid Sync Update)

### 🚀 Added (ฟีเจอร์ใหม่)
- **Firebase Firestore Integration (Primary Database)**:
  - เพิ่มระบบฐานข้อมูลคลาวด์เรียลไทม์ (Cloud Firestore) เป็นฐานข้อมูลหลักของแอปพลิเคชัน
  - รองรับการเข้าสู่ระบบแบบค้างไว้ตลอดเวลา (Permanent Stay Signed In เหมือน Google Keep) ไม่ต้องล็อกอินใหม่ซ้ำซ้อน
  - ซิงค์ข้อมูลเรียลไทม์ (Real-time Synchronization) อัตโนมัติทันทีที่เพิ่ม แก้ไข หรือลบลิงก์/รหัสผ่านข้ามอุปกรณ์
  - เพิ่มระบบ IndexedDB Offline Persistence รองรับการใช้งานแม้ไม่มีอินเทอร์เน็ต
- **Hybrid Cloud Architecture (Firestore + Google Sheets)**:
  - ปรับสถาปัตยกรรมระบบเป็นแบบ Hybrid: ใช้ Firestore เป็นคลาวด์ DB หลักเพื่อความเร็วสูงสุด และใช้ Google Sheets เป็นระบบสำรองข้อมูลส่วนตัว (Hybrid Backup)
  - เพิ่มป้ายสถานะและแบนเนอร์คำอธิบายเกี่ยวกับสถาปัตยกรรม Hybrid Cloud ในหน้า Settings
- **Batch Real-time Sync**:
  - เมื่อกดเชื่อมต่อ หรือรวมข้อมูล (Merge) ระบบจะบันทึกข้อมูลย้อนหลังกลับไปยัง Firestore และ Google Sheets โดยอัตโนมัติ

### 🛠️ Changed (การปรับปรุง)
- ปรับปรุง Flow การบันทึกและลบข้อมูลให้ประมวลผล Firestore ล่วงหน้าอย่างรวดเร็ว ก่อนที่จะส่งสำรองไปยัง Google Sheets API เบื้องหลัง

---

## [1.5.0] - 2026-08-05 (AI & Smart Tools Suite)

### 🚀 Added (ฟีเจอร์ใหม่)
- **AI-Powered Link Summarizer & Auto-Tagging**:
  - ผสานรวม Gemini AI Model (`gemini-2.5-flash`) บน Express Server Endpoint (`/api/ai-summarize`)
  - ฟังก์ชันสรุปเนื้อหาเว็บไซต์อัตโนมัติ 1-2 ประโยค คัดเลือกหมวดหมู่ และสร้างแท็กอัตโนมัติ
  - เพิ่มระบบ Heuristic Fallback สำหรับวิเคราะห์คีย์เวิร์ดกรณีออฟไลน์หรือไม่มี API Key
- **Quick Saver Tools (Bookmarklet & Web Extension)**:
  - สร้าง Drag-and-Drop Bookmarklet สำหรับลากวางลงบนเบราว์เซอร์เพื่อบันทึกลิงก์ใน 1-Click
  - เครื่องมือสร้างไฟล์ติดตั้ง Chrome/Edge Extension Generator (Manifest V3 + Popup)
- **Browser Bookmarks Importer**:
  - นำเข้าบุ๊กมาร์ก Netscape HTML (.html) จาก Chrome, Safari, Firefox, Edge และ JSON
  - แปลงโครงสร้างโฟลเดอร์เป็นหมวดหมู่อัตโนมัติ พร้อมตรวจจับลิงก์ซ้ำด้วย Canonical URL Normalization
- **Broken Link & Site Health Checker**:
  - เพิ่ม Express Backend Server Proxy (`/api/check-link`) ตรวจสอบความสมบูรณ์ของเว็บไซต์
  - Batch Scanner ตรวจสอบลิงก์ทั้งหมดในคลังพร้อมแสดง Progress สด และแสดงป้าย `Live (200)` / `Broken`
- **Link Expiration & Reminder System**:
  - ตั้งวันที่หมดอายุ/วันแจ้งเตือน (`ExpiresAt`) พร้อมป้ายกะพริบแจ้งเตือนและแบนเนอร์เตือนลิงก์ที่กำลังจะหมดอายุ

---

## [1.0.0] - 2026-08-04 (Initial Release)

### 🚀 Added (ฟีเจอร์แรกเริ่ม)
- **Core Link Keeper Engine**:
  - จัดเก็บ ค้นหา กรองหมวดหมู่ แท็ก และติดดาว (Favorite/Pin) บุ๊กมาร์ก
  - การ์ดแสดงผลสไตล์ทันสมัย รองรับ Light / Dark Mode
- **Credentials Vault**:
  - คลังเก็บชื่อผู้ใช้และรหัสผ่านส่วนตัวพร้อมระบบซ่อน/เปิดดูรหัสผ่าน และคัดลอกใน 1-Click
- **Google Sheets Direct Persistence**:
  - เชื่อมต่อและสร้างไฟล์ Google Sheet ใน Google Drive ส่วนตัวเพื่อบันทึกข้อมูล
- **Local Storage Caching**:
  - บันทึกข้อมูลลงเบราว์เซอร์เพื่อใช้งานแบบ Offline-First
