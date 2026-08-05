# Implementation Plan: Google Drive / Sheets Persistent Synchronization Strategy

## 1. Executive Summary / บทสรุปผู้บริหาร

ในการพัฒนาแอปพลิเคชัน **LinkKeeper** การซิงค์ข้อมูลกับ Google Sheets โดยตรงจากฝั่ง Client-side (Browser) จะต้องใช้ **Google OAuth 2.0 Access Token** ซึ่งตามนโยบายความปลอดภัยมาตรฐานของ Google Access Token สำหรับฝั่ง Frontend จะมีอายุการใช้งานสูงสุดเพียง **60 นาที (1 ชั่วโมง)** เมื่อ Token หมดอายุ การเรียกใช้งาน Google Sheets API จะตอบกลับด้วยข้อความผิดพลาด `Status 401 (UNAUTHENTICATED)`

เอกสารนี้รวบรวมรายละเอียดการปรับปรุงระบบซิงค์ข้อมูลที่ได้ดำเนินการแล้ว (**แนวทางที่ 1**) โครงสร้างสถาปัตยกรรมสำหรับระบบซิงค์ถาวรไร้หมดอายุ (**แนวทางที่ 2**) พร้อมทั้งข้อเสนอแนะสำหรับการพัฒนาในระยะถัดไป (**Next Plan**)

---

## 2. Approach 1 (แนวทางที่ 1 - Implemented in LinkKeeper)
### Client-Side Smooth OAuth Token Renewal (การต่ออายุ Token แบบ 1-Click โดยไม่ต้อง Sign Out)

#### 2.1 รายละเอียดสิ่งที่ได้ปรับปรุงในโค้ด (Implemented Changes)
1. **Smooth In-Place Reconnect Button**:
   - เพิ่มปุ่ม **`Reconnect / Renew Token`** ไว้ข้างๆ ข้อมูลบัญชีผู้ใช้ในหน้าตั้งค่า (Settings) และในป้ายแจ้งเตือนความผิดพลาด (Error Banner)
   - ผู้ใช้สามารถกดปุ่มเพื่อขอ OAuth Access Token ชุดใหม่จาก Google ได้ทันทีโดย **ไม่ต้องกด Sign Out จากระบบหลัก (Firebase Auth)** ก่อน

2. **Google OAuth Custom Parameters**:
   - ปรับการตั้งค่า `GoogleAuthProvider` ให้กำหนด `prompt: 'select_account'`
   - ช่วยให้ Google แสดงหน้าต่างป๊อปอัพเลือกบัญชีและขออนุญาตสิทธิ์อย่างรวดเร็ว (Seamless Popup Flow)

3. **Automated Retry Sync**:
   - เมื่อผู้ใช้กดต่ออายุ Token และได้รับ Access Token ชุดใหม่สำเร็จ แอปจะทำการเคลียร์ข้อผิดพลาด `googleSyncError` และสั่งรันฟังก์ชัน `handleGoogleSheetsSync` เพื่อซิงค์ข้อมูลต่อโดยอัตโนมัติทันที

4. **Graceful Error Handling & Fallback**:
   - เมื่อเกิดข้อผิดพลาด `401 UNAUTHENTICATED` ระบบจะเก็บรักษารายการลิงก์และรหัสผ่านไว้ใน Local Browser Cache อย่างปลอดภัย ข้อมูลผู้ใช้ไม่สูญหาย และแสดงป้ายแจ้งเตือนพร้อมปุ่ม Reconnect ใน 1 คลิก

---

## 3. Approach 2 (แนวทางที่ 2 - Technical Blueprint)
### Server-Side Refresh Token Architecture (ระบบซิงค์อัตโนมัติถาวรไร้หมดอายุเบื้องหลัง)

เพื่อแก้ปัญหา Token หมดอายุในระยะยาวโดยที่ผู้ใช้ไม่ต้องกด Reconnect อีกเลย สามารถเลือกปรับปรุงสถาปัตยกรรมระบบเป็น **Server-Side Authorization Flow** ได้ดังนี้:

```
[ Browser / Frontend ] 
       │
       ▼ (1) Request Sync
[ Node.js Backend Server / Cloud Function ] 
       │
       ├── (2) Check Access Token
       ├── (3) If Expired -> Send Refresh Token to Google OAuth Server
       │                           │
       │                   [ Google OAuth Server ]
       │                           │ Returns fresh Access Token
       │                           ▼
       └── (4) Query Google Sheets API using fresh Access Token
               │
               ▼
[ User's Google Sheet Spreadsheet ]
```

#### 3.1 การทำงานของ OAuth 2.0 Refresh Token
1. **OAuth Offline Access Scope**:
   - ฝั่ง Backend จะส่งคำขอการยืนยันตัวตนไปยัง Google OAuth Authorization Code Flow โดยระบุ `access_type=offline` และ `prompt=consent`
2. **การรับ Refresh Token**:
   - ในการเข้าใช้งานครั้งแรก Google จะส่งคืนทั้ง `access_token` (อายุ 1 ชั่วโมง) และ **`refresh_token`** (ไม่มีวันหมดอายุ จนกว่าผู้ใช้จะยกเลิกสิทธิ์)
3. **การจัดเก็บความปลอดภัย**:
   - บันทึก `refresh_token` ไว้ในส่วนที่มีความปลอดภัยสูง เช่น **Google Cloud Secret Manager** หรือ **Firestore Database (Server-side Rule Protected)**

#### 3.2 การแลกเปลี่ยน Access Token อัตโนมัติ (Automated Background Refresh)
- เมื่อ Backend ต้องการอ่าน/เขียนข้อมูลลง Google Sheets จะทำการตรวจสอบอายุของ Access Token
- หากหมดอายุ Backend จะส่ง `refresh_token` ไปที่ `https://oauth2.googleapis.com/token` เพื่อรับ Access Token ใหม่เบื้องหลังในระดับ milliseconds โดยผู้ใช้ไม่ต้องโต้ตอบกับป๊อปอัพใดๆ

#### 3.3 ทางเลือกเสริม: Google Service Account Integration
- สร้าง **Google Service Account** ใน Google Cloud Console
- ให้ Email ของ Service Account สิทธิ์เป็น Editor ใน Google Sheet ของผู้ใช้
- แอปจะสามารถเชื่อมต่อ Google Sheets API ได้ตลอด 24 ชั่วโมง โดยไม่ต้องอิงกับ Session การล็อกอินของผู้ใช้เลย

---

## 4. Recommendations for Next Plan (แผนการพัฒนาและข้อเสนอแนะขั้นถัดไป)

ขอแนะนำแผนพัฒนาในระยะถัดไป (Next Plan Roadmap) สำหรับแอปพลิเคชัน LinkKeeper เพื่อยกระดับความเสถียรและความปลอดภัย:

### 🚀 Next Plan Item 1: Real-time Cloud Persistence with Firestore (Primary Database)
- **แนวทาง**: ใช้ **Firebase Firestore** เป็นฐานข้อมูลหลักของแอปพลิเคชัน
- **ประโยชน์**:
  - การบันทึกและอ่านข้อมูลลิงก์/รหัสผ่านจะเกิดผลทันทีในระดับ milliseconds (Real-time Multi-device Sync)
  - ไม่ต้องพึ่งพา OAuth Scope หรือปัญหาสิทธิ์หมดอายุของ Google Sheets สำหรับการใช้งานประจำวัน
  - ใช้ Google Sheets เป็นเพียง **Destination สำหรับการ Backup / Export ข้อมูลรายสัปดาห์**

### 📁 Next Plan Item 2: Google Drive AppData Folder Scope (`drive.appdata`)
- **แนวทาง**: เปลี่ยนตำแหน่งการบันทึกไฟล์ Spreadsheet จากโฟลเดอร์หลักของผู้ใช้ ไปยัง **Application Data Folder** ของ Google Drive
- **ประโยชน์**:
  - ไฟล์ฐานข้อมูลจะถูกซ่อนไว้ในโฟลเดอร์แอปโดยเฉพาะ ไม่เกะกะโฟลเดอร์หลักของผู้ใช้
  - ป้องกันผู้ใช้เผลอลบหรือแก้ไขโครงสร้างตารางโดยไม่ตั้งใจ

### 🔔 Next Plan Item 3: Automatic Interceptor & Silent Renew Modal
- **แนวทาง**: สร้าง Axios / Fetch Interceptor ในฝั่ง Frontend
- **ประโยชน์**:
  - เมื่อระบบตรวจพบ response status 401 ในระหว่างการทำงาน จะแสดง Modal ขนาดเล็กแจ้งเตือน "Google Session Refresh Required" พร้อมปุ่มกด Renew ทันทีโดยไม่ตัดการทำงานของหน้าปัจจุบัน

### 🛠️ Next Plan Item 4: Serverless API Endpoint (`/api/sync`)
- **แนวทาง**: สร้าง Serverless Cloud Function หรือ Express Proxy Route สำหรับซิงค์ Google Sheets
- **ประโยชน์**:
  - ซ่อนการเรียกใช้ API Keys และจัดการ Refresh Token บน Server สอดคล้องกับแนวทางสถาปัตยกรรมแบบ Full-stack (Server + Client)

---

**สรุปการดำเนินการ**:
ขณะนี้ LinkKeeper ได้รับการอัปเดตตาม **แนวทางที่ 1** เรียบร้อยแล้ว ผู้ใช้สามารถใช้งานปุ่ม **`Reconnect / Renew Token`** เพื่อต่ออายุการซิงค์ข้อมูลได้ทันทีแบบ 1-Click โดยไม่ต้องกด Sign Out
