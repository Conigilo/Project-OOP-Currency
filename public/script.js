// State
let accountData = {
    totalWorth: 0,
    usd: 0,
    foreign: {}
};

let isLoading = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchAccountData();
});

// Notification System
function showNotification(type, title, message) {
    // Remove existing notification if any
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-icon">${icons[type]}</div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
    `;

    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Loading state helpers
function setButtonLoading(buttonElement, isLoading) {
    if (isLoading) {
        buttonElement.disabled = true;
        buttonElement.dataset.originalText = buttonElement.textContent;
        buttonElement.innerHTML = buttonElement.textContent + '<span class="loading-spinner"></span>';
    } else {
        buttonElement.disabled = false;
        buttonElement.textContent = buttonElement.dataset.originalText || buttonElement.textContent;
    }
}

// Fetch account data from server
async function fetchAccountData() {
    try {
        const response = await fetch('/api/action?action=check');
        const data = await response.json();
        accountData = data;
        updateDisplay();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Update display
async function updateDisplay() {
    // Update total value
    document.getElementById('totalValue').textContent = accountData.totalWorth.toFixed(2);
    
    // Update portfolio details
    const detailsContainer = document.getElementById('portfolioDetails');
    detailsContainer.innerHTML = '';
    
    // Add USD
    if (accountData.usd > 0) {
        detailsContainer.innerHTML += createPortfolioItem('USD', accountData.usd, accountData.usd);
    }
    
    // Add foreign currencies with USD conversion
    for (const [currency, amount] of Object.entries(accountData.foreign)) {
        if (amount > 0) {
            // Fetch real-time rate and calculate USD value
            try {
                const response = await fetch(`/api/action?action=getRate&base=${currency}&target=USD`);
                const data = await response.json();
                if (!data.error && data.rate) {
                    const usdValue = amount * data.rate;
                    detailsContainer.innerHTML += createPortfolioItem(currency, amount, usdValue);
                }
            } catch (error) {
                detailsContainer.innerHTML += createPortfolioItem(currency, amount, null);
            }
        }
    }
    
    if (detailsContainer.innerHTML === '') {
        detailsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #a0a0a0; padding: 40px;">ยังไม่มีเงินในพอร์ต</div>';
    }
}

function createPortfolioItem(currency, amount, usdValue) {
    let usdDisplay = '';
    if (currency === 'USD') {
        usdDisplay = ''; // Don't show USD conversion for USD itself
    } else if (usdValue !== null) {
        usdDisplay = `<span class="detail-usd">≈ ${usdValue.toFixed(2)} USD</span>`;
    } else {
        usdDisplay = '<span class="detail-usd">คำนวณมูลค่า...</span>';
    }
    
    return `
        <div class="detail-item">
            <span class="detail-label">${currency}</span>
            <span class="detail-value">${amount.toFixed(2)}</span>
            ${usdDisplay}
        </div>
    `;
}

// Deposit functions
function openDepositModal() {
    document.getElementById('depositModal').classList.add('active');
    document.getElementById('depositAmount').value = '';
}

function closeDepositModal() {
    document.getElementById('depositModal').classList.remove('active');
}

async function handleDeposit() {
    if (isLoading) return;
    
    const currency = document.getElementById('depositCurrency').value;
    const amount = parseFloat(document.getElementById('depositAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('error', 'ข้อผิดพลาด', 'กรุณาใส่จำนวนเงินที่ถูกต้อง');
        return;
    }
    
    const btn = event.target;
    isLoading = true;
    setButtonLoading(btn, true);
    
    try {
        const response = await fetch(`/api/action?action=deposit&currency=${currency}&amount=${amount}`);
        const data = await response.json();
        
        if (data.error) {
            showNotification('error', 'ฝากเงินไม่สำเร็จ', data.error);
        } else {
            accountData = data;
            updateDisplay();
            closeDepositModal();
            showNotification('success', 'ฝากเงินสำเร็จ!', `ฝาก ${amount.toFixed(2)} ${currency} เรียบร้อยแล้ว`);
        }
    } catch (error) {
        showNotification('error', 'เกิดข้อผิดพลาด', error.message);
    } finally {
        isLoading = false;
        setButtonLoading(btn, false);
    }
}

// Withdraw functions
function openWithdrawModal() {
    const select = document.getElementById('withdrawCurrency');
    select.innerHTML = '';
    
    // Add USD option
    if (accountData.usd >= 0) {
        const option = document.createElement('option');
        option.value = 'USD';
        option.textContent = `USD (มีอยู่: ${accountData.usd.toFixed(2)})`;
        select.appendChild(option);
    }
    
    // Add foreign currencies
    for (const [currency, amount] of Object.entries(accountData.foreign)) {
        if (amount > 0) {
            const option = document.createElement('option');
            option.value = currency;
            option.textContent = `${currency} (มีอยู่: ${amount.toFixed(2)})`;
            select.appendChild(option);
        }
    }
    
    if (select.options.length === 0) {
        showNotification('info', 'แจ้งเตือน', 'ไม่มีเงินในพอร์ตให้ถอน');
        return;
    }
    
    document.getElementById('withdrawModal').classList.add('active');
    document.getElementById('withdrawAmount').value = '';
    updateWithdrawInfo();
}

function closeWithdrawModal() {
    document.getElementById('withdrawModal').classList.remove('active');
}

function updateWithdrawInfo() {
    const currency = document.getElementById('withdrawCurrency').value;
    const balance = currency === 'USD' ? accountData.usd : (accountData.foreign[currency] || 0);
    document.getElementById('withdrawInfo').innerHTML = `
        ยอดคงเหลือ: <strong>${balance.toFixed(2)} ${currency}</strong>
    `;
}

// Add event listener for withdraw currency change
document.addEventListener('DOMContentLoaded', () => {
    const withdrawSelect = document.getElementById('withdrawCurrency');
    if (withdrawSelect) {
        withdrawSelect.addEventListener('change', updateWithdrawInfo);
    }
});

async function handleWithdraw() {
    if (isLoading) return;
    
    const currency = document.getElementById('withdrawCurrency').value;
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('error', 'ข้อผิดพลาด', 'กรุณาใส่จำนวนเงินที่ถูกต้อง');
        return;
    }
    
    const btn = event.target;
    isLoading = true;
    setButtonLoading(btn, true);
    
    try {
        const response = await fetch(`/api/action?action=withdraw&currency=${currency}&amount=${amount}`);
        const data = await response.json();
        
        if (data.error) {
            showNotification('error', 'ถอนเงินไม่สำเร็จ', data.error);
        } else {
            accountData = data;
            updateDisplay();
            closeWithdrawModal();
            showNotification('success', 'ถอนเงินสำเร็จ!', `ถอน ${amount.toFixed(2)} ${currency} เรียบร้อยแล้ว`);
        }
    } catch (error) {
        showNotification('error', 'เกิดข้อผิดพลาด', error.message);
    } finally {
        isLoading = false;
        setButtonLoading(btn, false);
    }
}

// Exchange USD to Foreign functions
function openExchangeModal() {
    if (accountData.usd <= 0) {
        showNotification('info', 'แจ้งเตือน', 'ไม่มี USD ในบัญชี');
        return;
    }
    document.getElementById('exchangeModal').classList.add('active');
    document.getElementById('exchangeAmount').value = '';
    document.getElementById('usdBalanceExchange').textContent = accountData.usd.toFixed(2);
    
    // Add event listeners for real-time calculation
    document.getElementById('exchangeCurrency').addEventListener('change', updateExchangePreview);
    document.getElementById('exchangeAmount').addEventListener('input', updateExchangePreview);
    updateExchangePreview();
}

function closeExchangeModal() {
    document.getElementById('exchangeModal').classList.remove('active');
}

async function updateExchangePreview() {
    const target = document.getElementById('exchangeCurrency').value;
    const amount = parseFloat(document.getElementById('exchangeAmount').value) || 0;
    
    if (amount <= 0) {
        document.getElementById('exchangeInfo').innerHTML = `
            ยอด USD คงเหลือ: <strong id="usdBalanceExchange">${accountData.usd.toFixed(2)}</strong>
        `;
        return;
    }
    
    try {
        const response = await fetch(`/api/action?action=getRate&base=USD&target=${target}`);
        const data = await response.json();
        
        if (!data.error && data.rate) {
            const willReceive = amount * data.rate;
            document.getElementById('exchangeInfo').innerHTML = `
                ยอด USD คงเหลือ: <strong>${accountData.usd.toFixed(2)}</strong><br>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <span style="color: #1affff;">คุณจะได้รับ: <strong>${willReceive.toFixed(2)} ${target}</strong></span><br>
                    <span style="font-size: 12px; color: #a0a0a0;">อัตรา: 1 USD = ${data.rate.toFixed(4)} ${target}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching rate:', error);
    }
}

async function handleExchange() {
    if (isLoading) return;
    
    const target = document.getElementById('exchangeCurrency').value;
    const amount = parseFloat(document.getElementById('exchangeAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('error', 'ข้อผิดพลาด', 'กรุณาใส่จำนวนเงินที่ถูกต้อง');
        return;
    }
    
    if (amount > accountData.usd) {
        showNotification('error', 'ยอดเงินไม่เพียงพอ', 'USD ในบัญชีไม่เพียงพอสำหรับการแลกเงิน');
        return;
    }
    
    const btn = event.target;
    isLoading = true;
    setButtonLoading(btn, true);
    
    try {
        const response = await fetch(`/api/action?action=exchange&target=${target}&amount=${amount}`);
        const data = await response.json();
        
        if (data.error) {
            showNotification('error', 'แลกเงินไม่สำเร็จ', data.error);
        } else {
            accountData = data;
            updateDisplay();
            closeExchangeModal();
            showNotification('success', 'แลกเงินสำเร็จ!', data.msg || `แลก ${amount.toFixed(2)} USD เป็น ${target} แล้ว`);
        }
    } catch (error) {
        showNotification('error', 'เกิดข้อผิดพลาด', error.message);
    } finally {
        isLoading = false;
        setButtonLoading(btn, false);
    }
}

// Exchange Foreign to USD functions
function openExchangeBackModal() {
    const select = document.getElementById('exchangeBackCurrency');
    select.innerHTML = '';
    
    // Add foreign currencies
    for (const [currency, amount] of Object.entries(accountData.foreign)) {
        if (amount > 0) {
            const option = document.createElement('option');
            option.value = currency;
            option.textContent = `${currency} (มีอยู่: ${amount.toFixed(2)})`;
            select.appendChild(option);
        }
    }
    
    if (select.options.length === 0) {
        showNotification('info', 'แจ้งเตือน', 'ไม่มีสกุลเงินต่างประเทศให้ขาย');
        return;
    }
    
    document.getElementById('exchangeBackModal').classList.add('active');
    document.getElementById('exchangeBackAmount').value = '';
    
    // Add event listeners for real-time calculation
    document.getElementById('exchangeBackCurrency').addEventListener('change', updateExchangeBackPreview);
    document.getElementById('exchangeBackAmount').addEventListener('input', updateExchangeBackPreview);
    updateExchangeBackPreview();
}

function closeExchangeBackModal() {
    document.getElementById('exchangeBackModal').classList.remove('active');
}

async function updateExchangeBackPreview() {
    const currency = document.getElementById('exchangeBackCurrency').value;
    const balance = accountData.foreign[currency] || 0;
    const amount = parseFloat(document.getElementById('exchangeBackAmount').value) || 0;
    
    if (amount <= 0) {
        document.getElementById('exchangeBackInfo').innerHTML = `
            ยอดคงเหลือ: <strong>${balance.toFixed(2)} ${currency}</strong>
        `;
        return;
    }
    
    try {
        const response = await fetch(`/api/action?action=getRate&base=${currency}&target=USD`);
        const data = await response.json();
        
        if (!data.error && data.rate) {
            const willReceive = amount * data.rate;
            document.getElementById('exchangeBackInfo').innerHTML = `
                ยอดคงเหลือ: <strong>${balance.toFixed(2)} ${currency}</strong><br>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                    <span style="color: #1affff;">คุณจะได้รับ: <strong>${willReceive.toFixed(2)} USD</strong></span><br>
                    <span style="font-size: 12px; color: #a0a0a0;">อัตรา: 1 ${currency} = ${data.rate.toFixed(4)} USD</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching rate:', error);
    }
}

function updateExchangeBackInfo() {
    updateExchangeBackPreview();
}

// Add event listener for exchange back currency change
document.addEventListener('DOMContentLoaded', () => {
    const exchangeBackSelect = document.getElementById('exchangeBackCurrency');
    if (exchangeBackSelect) {
        exchangeBackSelect.addEventListener('change', updateExchangeBackInfo);
    }
});

async function handleExchangeBack() {
    if (isLoading) return;
    
    const source = document.getElementById('exchangeBackCurrency').value;
    const amount = parseFloat(document.getElementById('exchangeBackAmount').value);
    
    if (!amount || amount <= 0) {
        showNotification('error', 'ข้อผิดพลาด', 'กรุณาใส่จำนวนเงินที่ถูกต้อง');
        return;
    }
    
    const btn = event.target;
    isLoading = true;
    setButtonLoading(btn, true);
    
    try {
        const response = await fetch(`/api/action?action=exchangeBack&source=${source}&amount=${amount}`);
        const data = await response.json();
        
        if (data.error) {
            showNotification('error', 'ขายเงินไม่สำเร็จ', data.error);
        } else {
            accountData = data;
            updateDisplay();
            closeExchangeBackModal();
            showNotification('success', 'ขายเงินสำเร็จ!', data.msg || `ขาย ${amount.toFixed(2)} ${source} เป็น USD แล้ว`);
        }
    } catch (error) {
        showNotification('error', 'เกิดข้อผิดพลาด', error.message);
    } finally {
        isLoading = false;
        setButtonLoading(btn, false);
    }
}

// Exchange Rates functions
let rateChart = null;

function openRatesModal() {
    document.getElementById('ratesModal').classList.add('active');
    document.getElementById('rateDisplay').style.display = 'none';
}

function closeRatesModal() {
    document.getElementById('ratesModal').classList.remove('active');
    if (rateChart) {
        rateChart.destroy();
        rateChart = null;
    }
}

async function loadRateHistory() {
    const target = document.getElementById('rateTarget').value;
    const btn = event.target;
    setButtonLoading(btn, true);
    
    try {
        const response = await fetch(`/api/action?action=getHistory&target=${target}`);
        const data = await response.json();
        
        if (data.error || !data.rates) {
            showNotification('error', 'ไม่สามารถดึงข้อมูล', 'ไม่สามารถดึงข้อมูลอัตราแลกเปลี่ยนได้');
            return;
        }
        
        // Parse history data
        const dates = Object.keys(data.rates).sort();
        const rates = dates.map(date => data.rates[date][target]);
        
        if (rates.length === 0) {
            showNotification('error', 'ไม่พบข้อมูล', 'ไม่มีข้อมูลอัตราแลกเปลี่ยนสำหรับสกุลเงินนี้');
            return;
        }
        
        // Get current and previous rate
        const currentRate = rates[rates.length - 1];
        const previousRate = rates[rates.length - 2] || currentRate;
        const change = currentRate - previousRate;
        const changePercent = ((change / previousRate) * 100).toFixed(2);
        
        // Update display
        document.getElementById('currentRate').textContent = currentRate.toFixed(4);
        document.getElementById('ratePair').textContent = `1 USD = ${currentRate.toFixed(4)} ${target}`;
        
        const changeElement = document.getElementById('changeValue');
        const isPositive = change >= 0;
        changeElement.className = `rate-change-value ${isPositive ? 'positive' : 'negative'}`;
        changeElement.innerHTML = `
            <span>${isPositive ? '▲' : '▼'}</span>
            <span>${Math.abs(change).toFixed(4)} (${isPositive ? '+' : ''}${changePercent}%)</span>
        `;
        
        document.getElementById('rateDisplay').style.display = 'block';
        
        // Draw chart
        drawRateChart(dates, rates, target);
        
    } catch (error) {
        showNotification('error', 'เกิดข้อผิดพลาด', error.message);
    } finally {
        setButtonLoading(btn, false);
    }
}

function drawRateChart(dates, rates, target) {
    const ctx = document.getElementById('rateChart').getContext('2d');
    
    // Destroy existing chart
    if (rateChart) {
        rateChart.destroy();
    }
    
    // Format dates for display
    const labels = dates.map(date => {
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth() + 1}`;
    });
    
    rateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `USD to ${target}`,
                data: rates,
                borderColor: '#1affff',
                backgroundColor: 'rgba(26, 255, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5,
                pointBackgroundColor: '#1affff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 33, 62, 0.95)',
                    titleColor: '#1affff',
                    bodyColor: '#fff',
                    borderColor: '#1affff',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `1 USD = ${context.parsed.y.toFixed(4)} ${target}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#a0a0a0',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                y: {
                    ticks: {
                        color: '#a0a0a0',
                        callback: function(value) {
                            return value.toFixed(4);
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                }
            }
        }
    });
}

async function checkExchangeRate() {
    const base = document.getElementById('rateFrom').value;
    const target = document.getElementById('rateTo').value;
    
    if (base === target) {
        showNotification('info', 'ข้อมูล', 'กรุณาเลือกสกุลเงินที่แตกต่างกัน');
        return;
    }
    
    const btn = event.target;
    setButtonLoading(btn, true);
    
    try {
        const response = await fetch(`/api/action?action=getRate&base=${base}&target=${target}`);
        const data = await response.json();
        
        if (data.error) {
            showNotification('error', 'ไม่สามารถดึงข้อมูล', data.error);
        } else {
            const resultBox = document.getElementById('rateResult');
            resultBox.innerHTML = `
                <strong>อัตราแลกเปลี่ยน:</strong><br>
                1 ${base} = ${data.rate.toFixed(4)} ${target}
            `;
            resultBox.style.display = 'block';
        }
    } catch (error) {
        showNotification('error', 'เกิดข้อผิดพลาด', error.message);
    } finally {
        setButtonLoading(btn, false);
    }
}