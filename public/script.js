// --- ส่วนจัดการหน้าจอ (UI Logic) ---

function openFeature(sectionId) {
    // 1. ซ่อนเมนูหลัก
    document.getElementById('main-menu').classList.add('hidden');
    
    // 2. แสดง Container ทำงาน
    document.getElementById('feature-container').classList.remove('hidden');
    
    // 3. ซ่อนฟีเจอร์เก่าทั้งหมดก่อน แล้วเปิดอันที่เลือก
    let features = document.querySelectorAll('.feature-box');
    features.forEach(f => f.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');

    // เคลียร์ข้อความสถานะ
    document.getElementById('status-msg').innerText = "";

    // ถ้ากด Portfolio ให้โหลดข้อมูลทันที
    if(sectionId === 'portfolio-section') {
        fetchPortfolio();
    }
}

function goHome() {
    // กลับไปหน้าเมนู
    document.getElementById('feature-container').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    
    // อัปเดตเงินบนหัวเว็บ
    fetchPortfolio(); 
}

// --- ส่วนจัดการ API (Backend Logic) ---

async function sendApi(params) {
    const status = document.getElementById('status-msg');
    status.innerText = "Processing...";
    status.style.color = "yellow";
    
    try {
        let response = await fetch(`/api/action?${params}`);
        let data = await response.json();

        if (data.error) {
            status.innerText = data.error;
            status.style.color = "#cf6679"; // Red
        } else {
            if(data.msg) {
                status.innerText = data.msg;
                status.style.color = "#03dac6"; // Green
            }
            // อัปเดต UI ส่วนกลางเสมอ
            updateHeader(data);
            if(!document.getElementById('portfolio-section').classList.contains('hidden')){
                renderPortfolioList(data);
            }
        }
        return data;
    } catch (e) {
        status.innerText = "Server Error. Check Java Console.";
        status.style.color = "red";
    }
}

// ฟังก์ชันเฉพาะกิจสำหรับโหลด Portfolio มาโชว์
function fetchPortfolio() {
    sendApi("action=check");
}

function updateHeader(data) {
    // อัปเดตเงินมุมขวาบน
    if(data && data.usd !== undefined) {
        document.getElementById('header-balance').innerText = data.usd.toFixed(2) + " $";
    }
}

function renderPortfolioList(data) {
    let list = document.getElementById('portfolio-list');
    list.innerHTML = "";
    
    // 1. USD
    list.innerHTML += `<div style="color:#03dac6"><strong>USD Balance</strong> <span>${data.usd.toFixed(2)}</span></div>`;

    // 2. Foreign
    if(data.foreign && Object.keys(data.foreign).length > 0) {
        for (let [currency, amount] of Object.entries(data.foreign)) {
            list.innerHTML += `<div><strong>${currency}</strong> <span>${amount.toFixed(2)}</span></div>`;
        }
    } else {
        list.innerHTML += `<div style="justify-content:center; color:#888;">No foreign assets.</div>`;
    }
}

// --- Action Functions (กดปุ่มแล้วทำงาน) ---

function deposit() {
    let amt = document.getElementById('dep-amount').value;
    let curr = document.getElementById('dep-curr').value;
    if(!amt) return;
    sendApi(`action=deposit&amount=${amt}&currency=${curr}`);
}

function withdraw() {
    let amt = document.getElementById('wd-amount').value;
    if(!amt) return;
    sendApi(`action=withdraw&amount=${amt}`);
}

function exchangeTo() {
    let amt = document.getElementById('ex-amount').value;
    let target = document.getElementById('ex-target').value;
    if(!amt) return;
    sendApi(`action=exchange&amount=${amt}&target=${target}`);
}

function exchangeBack() {
    let amt = document.getElementById('ex-back-amount').value;
    let source = document.getElementById('ex-back-source').value;
    if(!amt) return;
    sendApi(`action=exchangeBack&amount=${amt}&source=${source}`);
}

// ฟังก์ชันดู Rate (อันนี้ต้องยิง API ไปเช็ค ไม่เกี่ยวกับเงินในกระเป๋า)
async function checkRate() {
    let target = document.getElementById('rate-target').value;
    document.getElementById('rate-result').innerText = "Checking...";
    
    // เราจะแอบใช้ API ของ Account.viewrateexchange ที่เราเขียนไว้ใน Java
    // แต่เนื่องจากใน Java เราเขียน viewrateexchange ให้ return String
    // เราเลยต้องยิงไปที่ action=check หรือสร้าง logic ใหม่
    // แต่เพื่อความง่าย เราจะใช้ fetch ตรงๆ หรือจะฝาก Java เช็คก็ได้
    
    // ทริค: ใช้ API Frankfurter ตรงๆ จาก JS เลยก็ได้สำหรับเมนูนี้ (ถ้าไม่อยากแก้ Java)
    try {
        let res = await fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${target}`);
        let data = await res.json();
        let rate = data.rates[target];
        document.getElementById('rate-result').innerHTML = 
            `1 USD = <strong style="color:#bb86fc">${rate} ${target}</strong>`;
    } catch(e) {
        document.getElementById('rate-result').innerText = "Error checking rate.";
    }
}

// เริ่มต้น: โหลดข้อมูลเงินก่อน
fetchPortfolio();