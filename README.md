# Project-OOP-Currency
How to run this program:
Compile ด้วยคำสั่งjava -cp ".;lib/json-20250517.jar" MainServer  เพื่อcompile file javaเพื่อนำไปใช้งาน



what is this program do?:


โปรแกรมนี้เป็น Web Server เขียนด้วย Java โดยใช้ com.sun.net.httpserver.HttpServer เพื่อให้บริการหน้าเว็บ (HTML/CSS/JS) และให้ API สำหรับการทำธุรกรรมเกี่ยวกับการ:

ฝากเงิน (Deposit)
ถอนเงิน (Withdraw)
ซื้อสกุลเงินต่างประเทศ (Exchange To)
ขายสกุลเงินต่างประเทศกลับเป็น USD (Exchange Back)
ดึงอัตราแลกเปลี่ยนปัจจุบันจาก API จริง
เรียกดูมูลค่ารวม (Total Asset Value)
เซิร์ฟเวอร์นี้ทำงานบนพอร์ต 8080 และอ่านไฟล์เว็บจากโฟลเดอร์ /public

แต่ละส่วนใช้ทำอะไรบ้าง:
1. RateProvider (Interface)
เป็น interface กำหนดสัญญาว่า
ต้องมีเมธอด getRate(from, to) สำหรับดึงอัตราแลกเปลี่ยนเงิน

2. ApiRateProvider
คลาสนี้ ดึงอัตราแลกเปลี่ยนจริง จาก API ของ Frankfurter.dev
หน้าที่หลักส่ง HTTP GET requestอ่าน JSON ผลลัพธ์ดึงค่าอัตราแลกเปลี่ยนของสกุลเงินที่ระบุถ้า from == to → อัตรา = 1.0

3. Accountคลาสนี้เก็บสถานะของบัญชีเงินทั้งหมดของผู้ใช้ข้อมูลที่เก็บยอดเงิน USD (usdBalance)สกุลเงินต่างประเทศที่ถืออยู่ (Map<String, Double> foreignHoldings)ตัวดึงอัตราแลกเปลี่ยน (RateProvider)

ฟีเจอร์หลักของคลาส
ฝากเงิน (Deposit)
ถ้าเงินเป็น USD → บวกเข้าบัญชี
ถ้าเป็นเงินต่างประเทศ → เก็บแยกใน Map

ถอนเงิน (Withdraw)
ทำงานทั้ง USD และสกุลเงินอื่น
เช็คยอดก่อนถอน

ซื้อเงินต่างประเทศ (exchangeTo)
ใช้เงิน USD ซื้อสกุลเงินตามต้องการ
เช็คอัตราแลกเปลี่ยนผ่าน API
ตัดเงิน USD ออก แล้วเพิ่มเงินต่างประเทศเข้าพอร์ต

ขายเงินกลับเป็น USD (exchangeFrom)
ขายสกุลเงินต่างประเทศ
แปลงเป็น USD

มูลค่ารวมทั้งหมดเป็น USD
นำยอดเงินทุกสกุลมาคูณอัตราแลกเปลี่ยน แล้วรวมเป็น USD

4. StaticFileHandlerใช้เสิร์ฟไฟล์จากโฟลเดอร์ public
ถ้าเข้า / → ส่ง index.htmlเช็คไฟล์ที่ร้องขอ เช่น .css, .js, .htmlกำหนด Content-Type อัตโนมัติถ้าไม่มีไฟล์ → ส่ง 404

5. MainServerเป็นคลาสหลักที่รันเว็บเซิร์ฟเวอร์สิ่งที่ทำใน mainเปิดเซิร์ฟเวอร์บนพอร์ต 8080สร้าง endpoint → เสิร์ฟไฟล์เว็บ (HTML, CSS, JS)/api/action → รับคำสั่งทางการเงินเริ่มการทำงานของเซิร์ฟเวอร์

6. ApiHandlerส่วนนี้คือ REST-like API ของระบบรองรับ action ต่อไปนี้:

getRateดึงอัตราแลกเปลี่ยนตามสกุลเงิน

getHistoryดึงข้อมูลอัตราย้อนหลัง 30 วันเพื่อนำไป plot กราฟ

depositฝากเงิน

withdrawถอนเงิน

exchangeซื้อเงินต่างประเทศ

exchangeBackขายเงินต่างประเทศกลับเป็น USD

checkอัปเดตสถานะบัญชี ทุกresponse คืนเป็น JSON:

totalWorth
usd (ยอด USD)

foreign (เงินต่างประเทศ)
msg หรือ error
