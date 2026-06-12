# HD-IC Web App

ระบบ Infection Control สำหรับผู้ป่วยไตเทียมแบบ static web app ใช้งานผ่าน browser และเก็บข้อมูลใน `localStorage`

## การเปิดใช้งาน

เปิดผ่าน local server เช่น Live Server:

```text
http://127.0.0.1:5500/index.html
```

ไม่แนะนำให้เปิดด้วย `file://` เพราะ ES modules และ service worker อาจทำงานไม่ครบ

## ข้อมูลและการสำรอง

- ข้อมูลทั้งหมดเก็บใน browser ของเครื่องนั้น ๆ ด้วย key `hd_ic_v1`
- ใช้ `Export JSON` เพื่อสำรองข้อมูลทั้งระบบ
- ใช้ `Import JSON` เพื่อนำข้อมูลกลับเข้า ระบบจะตรวจรูปแบบไฟล์ก่อนเขียนทับข้อมูลเดิม
- ใช้ `Export CSV` เพื่อส่งออก infection event สำหรับงานรายงาน

## สิ่งที่ระบบมี

- Login และ role พื้นฐาน: Admin, Editor, Viewer
- ทะเบียนผู้ป่วย
- Serology HBV/HCV/HIV และ due alert
- Vascular access และ exit site assessment
- Infection events
- Surveillance summary
- Monthly report
- JSON backup/restore และ CSV export
- PWA manifest, icon และ service worker cache สำหรับไฟล์หลัก
- Auto refresh ข้อมูลในหน้าเว็บเมื่อข้อมูลใน `localStorage` เปลี่ยน โดยไม่ต้องกด F5
- Responsive UI แบบ mobile-first สำหรับ mobile, tablet, desktop และ installed PWA mode

## Login / Role

ครั้งแรกระบบจะสร้างผู้ใช้เริ่มต้น:

```text
Username: admin
Password: admin123
```

Role ในระบบ:

- `Admin`: จัดการข้อมูลทั้งหมด ผู้ใช้ และล้างข้อมูล
- `Editor`: เพิ่ม/แก้ไขข้อมูลผู้ป่วยและข้อมูล clinical, import/export
- `Viewer`: ดูข้อมูล สร้างรายงาน และ export เท่านั้น

ระบบนี้เป็นการควบคุมสิทธิ์ในฝั่ง browser สำหรับงาน local/prototype ไม่ใช่ security boundary สำหรับข้อมูลผู้ป่วยจริง

## Auto Refresh

ระบบจะ refresh หน้าปัจจุบันอัตโนมัติเมื่อข้อมูลถูกบันทึกหรือเมื่อ `localStorage` เปลี่ยนจากอีกแท็บ/หน้าต่างของ browser เดียวกัน จึงไม่ต้องกด F5 หลังเพิ่ม แก้ไข ลบ หรือ import ข้อมูล

## Responsive / PWA

ระบบถูกปรับให้เริ่มจาก mobile-first โดยใช้ Grid/Flex, `clamp()`, safe-area inset, bottom navigation บนมือถือ และ sidebar บน tablet/desktop ตารางจะเปลี่ยนเป็น card list บนจอเล็ก

ขนาดหน้าจอที่ควรตรวจเมื่อแก้ UI:

- 320, 375, 390, 414 px
- 768, 1024 px
- 1366, 1440, 1920 px
- PWA installed mode บน iOS/Android

## การตรวจโค้ด

ต้องมี Node.js แล้วรัน:

```bash
npm run check
```

คำสั่งนี้ตรวจ syntax ของไฟล์ JavaScript หลักทั้งหมด

## ข้อจำกัดก่อนใช้งานจริง

- ยังไม่มี backend/database กลาง
- ยังไม่มี audit log ว่าใครเพิ่ม แก้ หรือลบข้อมูล
- ยังไม่มี test เชิง workflow ใน browser

ถ้าจะใช้กับข้อมูลผู้ป่วยจริง ควรวาง backend, authentication, backup policy, audit trail และนโยบายสิทธิ์เข้าถึงข้อมูลก่อน
