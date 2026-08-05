# Implementation Plan & Technical Architecture: LinkKeeper Knowledge Base

## 1. Executive Summary / บทสรุปผู้บริหาร

โปรเจกต์ **LinkKeeper Knowledge Base** เป็นเว็บแอปพลิเคชันจัดการลิงก์บุ๊กมาร์ก บันทึกย่อ และรหัสผ่านที่เน้นความปลอดภัย ความเร็ว และความสะดวกในการใช้งาน ล่าสุดได้รับการอัปเกรดระบบการทำงานอย่างครอบคลุม ทั้งในด้าน **การซิงค์ข้อมูลถาวร (Persistent Synchronization)**, **ระบบปัญญาประดิษฐ์ (AI Summarizer & Auto-Tagging)**, **เครื่องมือเซฟลิงก์ใน 1-Click (Bookmarklet & Extension)**, **ระบบนำเข้าบุ๊กมาร์ก (Bookmarks Importer)** และ **ระบบตรวจสอบความสมบูรณ์ของลิงก์ (Broken Link Health Checker)**

---

## 2. Implemented Features & Technical Architecture (คุณสมบัติและสถาปัตยกรรมที่พัฒนาเสร็จสมบูรณ์)

### 2.1 Google Drive / Sheets Persistent Synchronization & Smooth Token Renewal
- **Smooth In-Place Top Header & Settings Reconnect**: เพิ่มปุ่ม `Reconnect` บนแถบเมนูหลักด้านบน (Top Navigation Header Bar) และในหน้า Settings/Error Banner ช่วยให้ผู้ใช้ต่ออายุ OAuth Access Token ที่หมดอายุ (อายุ 1 ชั่วโมง) ได้ทันทีใน 1-Click โดย **ไม่ต้อง Sign Out จากระบบหลัก** และ **ไม่ต้องสลับไปที่หน้า Settings**
- **OAuth Prompt Parameter**: กำหนด `prompt: 'select_account'` ใน `GoogleAuthProvider` เพื่อให้สลับ/ยืนยันสิทธิ์ได้อย่างรวดเร็ว
- **Automated Sync Retry & Offline Cache**: เมื่อได้รับ Token ใหม่สำเร็จ ระบบจะเรียกซิงค์ Google Sheets ต่อทันที และเก็บสำรองข้อมูลใน Local Browser Cache ป้องกันข้อมูลสูญหายเมื่อเครือข่ายหลุด
- **Architecture Diagram**:
```
[ Frontend (React + Vite) ] ──(401 Token Expired)──> [ Error Banner / Reconnect Button ]
          │                                                       │
          ▼                                                       ▼
[ Local Browser Cache ] <──(Save Offline Backup)─── [ Google OAuth Popup (Prompt) ]
```

---

### 2.2 AI-Powered Link Summarizer & Auto-Tagging
- **Gemini AI Integration (`gemini-2.5-flash`)**: ทำงานผ่าน Express Server (`/api/ai-summarize`) ใช้ไลบรารี `@google/genai`
- **Smart Analysis**: วิเคราะห์ URL, Title และ Note ของลิงก์ แล้วสรุปเนื้อหาเป็นข้อความกระชับ 1-2 ประโยค (ไทย/อังกฤษ) พร้อมคัดเลือกหมวดหมู่ (Category) และแท็ก (Tags) ที่เหมาะสมโดยอัตโนมัติ
- **Heuristic Fallback Engine**: มีระบบ Fallback ภายในตัวเพื่อวิเคราะห์ URL/Domain และคีย์เวิร์ดเบื้องหลัง เมื่อไม่ได้ตั้งค่า API Key หรือขณะออฟไลน์
- **UI Button**: ปุ่ม `AI Auto-Fill & Summarize` ในหน้าต่าง QuickAdd พร้อมไอคอนและสถานะ Loading

---

### 2.3 1-Click Quick Saver Tools (Bookmarklet & Chrome/Edge Web Extension)
- **Drag-and-Drop Bookmarklet**: โค้ด JavaScript สำหรับลากวางลงบน **Bookmarks Bar** ของเบราว์เซอร์ เมื่อผู้ใช้อยู่ที่หน้าเว็บใดก็ตาม แล้วกดบุ๊กมาร์กนี้ จะเปิด LinkKeeper พร้อมบันทึก URL และ Title ของหน้านั้นๆ ทันที
- **Chrome / Edge Extension Generator**: ระบบสร้างและดาวน์โหลดไฟล์ `manifest.json` (Manifest V3) และ `popup.html` เพื่อให้นำไปติดตั้งเป็น Web Extension (Developer Mode) ใน Chrome หรือ Edge ได้ทันที
- **URL Parameter Handler**: รองรับการรับค่าผ่าน Query Parameters `?add_url=...&add_title=...`

---

### 2.4 Browser Bookmarks Importer & Canonical Deduplication
- **Multi-Format Support**: นำเข้าไฟล์บุ๊กมาร์กทั้งรูปแบบ Netscape HTML (`.html`) ที่ส่งออกจาก Chrome, Safari, Firefox, Edge และรูปแบบ LinkKeeper JSON
- **Folder Hierarchy Parsing**: ดึงโครงสร้างโฟลเดอร์จากไฟล์ HTML มาแปลงเป็นหมวดหมู่ (Categories) ใน LinkKeeper โดยอัตโนมัติ
- **Canonical URL Normalization**: ระบบตัดโปรโตคอล (`https://`), `www.` และพารามิเตอร์ติดตาม (`utm_source`, `utm_medium`, `ref`) เพื่อตรวจจับลิงก์ซ้ำ (Duplicates) ก่อนนำเข้า
- **Interactive Import Modal**: มีป้ายสถานะ `Existing` เตือนลิงก์ซ้ำ และตัวเลือก `Select All / Deselect All`

---

### 2.5 Broken Link & Site Health Checker
- **Server Proxy Endpoint (`/api/check-link`)**: ให้ Express Server ทำหน้าที่ส่งคำขอ `HEAD` และ `GET` (พร้อม Timeout 6 วินาที และ User-Agent) ไปยังเว็บไซต์ปลายทาง เพื่อหลีกเลี่ยงปัญหา CORS บนเบราว์เซอร์
- **Batch Health Scanner**: ปุ่ม `Check Site Health` ในหน้า Dashboard ที่ส่งตรวจสอบสถานะของทุกลิงก์พร้อมแสดง Progress Counter สด
- **Real-Time Badges**: แสดงป้ายสถานะ `Live (200)` สีเขียว หรือ `Broken (404/500/Timeout)` สีแดง บนการ์ดลิงก์อย่างชัดเจน

---

### 2.6 Link Expiration & Reminder System
- **Expiration Date Picker**: ช่องเลือกวันที่หมดอายุ/วันแจ้งเตือน (`ExpiresAt`) ในหน้า QuickAdd และแบบฟอร์มแก้ไข
- **Expiring Badges & Warning Banner**: ป้ายสถานะ `Expired` หรือ `Expiring (Xd)` พร้อมเอฟเฟกต์กะพริบแจ้งเตือน และแบนเนอร์แจ้งเตือนส่วนบนพร้อมปุ่มกรองดูเฉพาะลิงก์ที่กำลังจะหมดอายุ

---

## 3. Performance & Impact Analysis (การวิเคราะห์ประสิทธิภาพและความลื่นไหล)

| คุณสมบัติ (Feature) | ระยะเวลาพัฒนา (Estimate Time) | ผลกระทบต่อความเร็วแอป (Performance Impact) | เทคนิคการป้องการหน่วง (Optimization Technique) |
|---|---|---|---|
| **1. Smooth OAuth Renewal** | สำเร็จ (Completed) | **ไม่มีผลกระทบ (0ms)** | ทำงานเฉพาะเมื่อกด Reconnect |
| **2. AI Link Summarizer** | สำเร็จ (Completed) | **ลื่นไหล (Fast)** | ประมวลผลแบบ Async เบื้องหลังผ่าน Express Backend |
| **3. Bookmarklet & Extension** | สำเร็จ (Completed) | **ไม่มีผลกระทบ (0ms)** | โค้ดฝั่ง Client มีขนาดเล็กเบามาก (<2KB) |
| **4. Bookmarks Importer** | สำเร็จ (Completed) | **ไม่มีผลกระทบ (0ms)** | ใช้ DOMParser แปลงไฟล์ฝั่ง Browser ในเวลาไม่กี่ ms |
| **5. Site Health Checker** | สำเร็จ (Completed) | **ลื่นไหล (Controlled)** | ยิงตรวจสอบแบบ Async ทีละรายการพร้อม AbortController Timeout (6s) |
| **6. Link Expiration** | สำเร็จ (Completed) | **ไม่มีผลกระทบ (0ms)** | คำนวณความต่างวันใน Memory ผ่าน `useMemo` |

---

## 4. Next Plan Roadmap (แผนการพัฒนาในอนาคต)

1. **Firestore Primary Database Sync**:
   - ปรับเปลี่ยนโครงสร้างฐานข้อมูลหลักเป็น Firebase Firestore เพื่อความเร็วระดับ Real-time Sync ข้ามอุปกรณ์ โดยใช้ Google Sheets เป็นเพียงช่องทาง Backup รายสัปดาห์
2. **Google Drive AppData Folder Scope (`drive.appdata`)**:
   - จัดเก็บไฟล์ Spreadsheet ไว้ในโฟลเดอร์ซ่อนเฉพาะของแอปใน Google Drive เพื่อป้องกันผู้ใช้ลบหรือแก้ไขไฟล์ผิดโดยไม่ตั้งใจ
3. **Automated Background Cron Health Check**:
   - ระบบตั้งเวลาตรวจสุขภาพลิงก์อัตโนมัติในเบื้องหลังสัปดาห์ละ 1 ครั้ง และแจ้งเตือนผ่าน Email หรือ Notification Banner

---
*เอกสารนี้ได้รับการปรับปรุงล่าสุดให้ครอบคลุมการทำงานจริงทั้งหมดของระบบ LinkKeeper Knowledge Base*

