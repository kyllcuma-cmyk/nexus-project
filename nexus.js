// ──────────────────────────────────────────────
// 🚀 FIREBASE CONFIGURATION
// ──────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyBPzA9mMwjuf1xfAqUi4wwqathrVFkF3-k",
    authDomain: "nexus-core-7f4ba.firebaseapp.com",
    projectId: "nexus-core-7f4ba",
    storageBucket: "nexus-core-7f4ba.firebasestorage.app",
    messagingSenderId: "154178297804",
    appId: "1:154178297804:web:59fe7395352a351b3ec769"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ──────────────────────────────────────────────
// 📌 STATE GLOBAL
// ──────────────────────────────────────────────
let bal = 0;
let active = false;
let uptime = 0;
let shares = 0;
let wallet = '';
const MIN = 10;
let rate = 0;
let baseRate = 0;
let currentUser = null;
let currentUserPass = ''; 
let hasPaidGasFee = false;
let autoSaveInterval = null;
let userListener = null; 
let txListener = null;   
let previousTxs = {};    
let lastSavedBal = 0;
let hasPendingTx = false; 
let isProcessingWd = false; 

let claimDay = 0;
let lastClaimTime = 0;

// ──────────────────────────────────────────────
// 📈 NATIVE CANVAS CANDLESTICK TUBE CHART
// ──────────────────────────────────────────────
const canvas = document.getElementById('nativeChart');
const ctx = canvas.getContext('2d');

let candleHistory = []; 
const totalSlots = 40; 
const maxHistory = 20; 
const candleWidthPct = 0.85;

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth * window.devicePixelRatio;
    canvas.height = container.clientHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawNativeChart();
}

window.addEventListener('resize', resizeCanvas);
function drawNativeChart(currentOHLC = null) {
    if (currentOHLC !== null) {
        candleHistory.push(currentOHLC);
        if (candleHistory.length > maxHistory) {
            candleHistory.shift();
        }
    }

    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    
    ctx.clearRect(0, 0, width, height);

    if (candleHistory.length < 2) return;
    let highPrices = candleHistory.map(c => c.high);
    let lowPrices = candleHistory.map(c => c.low);
    let maxP = Math.max(...highPrices);
    let minP = Math.min(...lowPrices);
    let range = maxP - minP;
    if (range < 0.1) range = 0.1; 

    const paddingY = height * 0.20;
    const stepX = width / totalSlots; 

    const getY = (price) => {
        return height - paddingY - ((price - minP) / range) * (height - paddingY * 2);
    };

    ctx.strokeStyle = 'rgba(39, 39, 42, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for(let i=1; i<4; i++) {
        let y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < candleHistory.length; i++) {
        const candle = candleHistory[i];
        let centerX = i * stepX + (stepX / 2);

        const yHigh = getY(candle.high);
        const yLow = getY(candle.low);
        const yOpen = getY(candle.open);
        const yClose = getY(candle.close);

        const isBullish = candle.close >= candle.open;
        const baseColorStr = isBullish ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'; 
        const darkColorStr = isBullish ? 'rgb(4, 150, 95)' : 'rgb(200, 40, 40)';
        ctx.strokeStyle = baseColorStr;
        ctx.lineWidth = 1.5; 
        ctx.beginPath();
        ctx.moveTo(centerX, yHigh);
        ctx.lineTo(centerX, yLow);
        ctx.stroke();

        const bodyTop = Math.min(yOpen, yClose);
        const bodyBottom = Math.max(yOpen, yClose);
        let bodyHeight = bodyBottom - bodyTop;
        if (bodyHeight < 2) bodyHeight = 2;
        const candleWidth = stepX * candleWidthPct;
        const bodyLeft = centerX - (candleWidth / 2);
        let gradient = ctx.createLinearGradient(bodyLeft, 0, bodyLeft + candleWidth, 0);
        gradient.addColorStop(0, darkColorStr);   
        gradient.addColorStop(0.5, baseColorStr); 
        gradient.addColorStop(1, darkColorStr);   

        ctx.fillStyle = gradient;
        ctx.fillRect(bodyLeft, bodyTop, candleWidth, bodyHeight);
    }
}

// ──────────────────────────────────────────────
// 🧰 HELPERS
// ──────────────────────────────────────────────
const fU = n => '$ ' + n.toFixed(4);
const fI = u => 'Rp ' + (rate > 0 ? Math.round(u * rate).toLocaleString('id-ID') : '0');
const fR = r => 'Rp ' + r.toLocaleString('id-ID');
const ts = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
};
const tsFull = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

function syncBalanceOnLoad(nodeId, fbBalance) {
    let localBal = parseFloat(localStorage.getItem('nexusBackupBal_' + nodeId)) || 0;
    if (localBal > fbBalance && (localBal - fbBalance) < 0.5) {
        updateUserBalance(nodeId, localBal);
        return localBal;
    }
    return fbBalance;
}

// ──────────────────────────────────────────────
// 🧭 NAVIGASI
// ──────────────────────────────────────────────
function goPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
    if (id === 'pgDash') {
        setTimeout(resizeCanvas, 100);
    }
}

function goHome() {
    resetForm();
    goPage('pgDash');
}

function openProtocolInfo() { document.getElementById('protocolModal').classList.add('active'); }
function closeProtocolInfo() { document.getElementById('protocolModal').classList.remove('active'); }

// ──────────────────────────────────────────────
// 🛡️ API: FIREBASE REALTIME LISTENERS
// ──────────────────────────────────────────────
function setupTxListener(nodeId) {
    if (txListener) txListener();
    txListener = db.collection('transactions').where('node_id', '==', nodeId)
        .onSnapshot(snapshot => {
            let hData = [];
            let localPending = false;
            
            snapshot.forEach(doc => { 
                const data = doc.data();
                hData.push({ id: doc.id, ...data }); 
                
                if (data.status === 'PENDING') {
                    localPending = true;
                }

                if (previousTxs[doc.id] === 'PENDING' && data.status === 'SUCCESS') {
                    toast(`[TX] Pencairan $${data.amount} via ${data.method} berhasil.`);
                }
                previousTxs[doc.id] = data.status;
            });
            
            hasPendingTx = localPending; 
            
            const btnWd = document.getElementById('btnSubmitWd');
            if(btnWd) {
                if(hasPendingTx) {
                    btnWd.disabled = true;
                    btnWd.innerHTML = '<div class="btn-spinner"></div><span>PENDING SYNC...</span>';
                } else {
                    btnWd.disabled = false;
                    btnWd.innerHTML = 'Proses Penarikan';
                }
            }
            
            hData.sort((a, b) => b.tx_id - a.tx_id);
            hData = hData.slice(0, 10); 
            
            renderHistoryList(hData);
        });
}

function setupUserListener(nodeId) {
    if(userListener) userListener();
    userListener = db.collection('users').doc(nodeId).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            if (data.balance !== undefined && Math.abs(bal - data.balance) > 0.05) {
                bal = data.balance;
                lastSavedBal = bal;
                document.getElementById('balUsd').textContent = fU(bal);
                document.getElementById('balIdr').textContent = '≈ ' + fI(bal);
            }

            if (data.claim_day !== undefined) claimDay = data.claim_day;
            if (data.last_claim_time !== undefined) lastClaimTime = data.last_claim_time;
            
            // Cek Affiliate / Referral
            if (data.has_redeemed_ref) {
                updateRefUI(true, data.referral_code);
            } else {
                updateRefUI(false);
            }

            if(document.getElementById('claimModal').classList.contains('active')) {
                renderClaimGrid();
            }

            if (data.has_paid_gas === true && hasPaidGasFee === false) {
                hasPaidGasFee = true;
                toast('[SYS] Network verified Node Gas Fee.');
                
                const modalVerif = document.getElementById('verifModal');
                const modalStep2 = document.getElementById('modalStep2');
                const modalStep3 = document.getElementById('modalStep3');
                if (modalVerif.classList.contains('active') && (modalStep2.style.display === 'block' || modalStep3.style.display === 'block')) {
                    modalStep2.style.display = 'none';
                    modalStep3.style.display = 'none';
                    
                    setTimeout(() => {
                        closeModal();
                        submitWdFinal(); 
                    }, 1000);
                }
            }
        }
    });
}

async function updateUserBalance(nodeId, newBalance) {
    try {
        lastSavedBal = newBalance;
        await db.collection('users').doc(nodeId).update({ balance: newBalance });
    } catch (e) {
        console.error('Update balance error:', e);
    }
}

// ──────────────────────────────────────────────
// 🔐 AUTENTIKASI
// ──────────────────────────────────────────────
let currentAuthTab = 'login';
function switchAuth(type) {
    currentAuthTab = type;
    document.getElementById('tabLogin').classList.toggle('active', type === 'login');
    document.getElementById('tabRegister').classList.toggle('active', type === 'register');
    document.getElementById('formLogin').classList.toggle('active', type === 'login');
    document.getElementById('formRegister').classList.toggle('active', type === 'register');
}

async function processAuth() {
    const isLogin = currentAuthTab === 'login';
    const nodeId = document.getElementById(isLogin ? 'logID' : 'regID').value.trim();
    const pass = document.getElementById(isLogin ? 'logPass' : 'regPass').value;
    if (!nodeId || !pass) return toast('[ERR] Kredensial tidak boleh kosong.');
    if (!isLogin) {
        const pass2 = document.getElementById('regPass2').value;
        if (pass !== pass2) return toast('[ERR] Konfirmasi kata sandi tidak cocok.');
        if (pass.length < 4) return toast('[ERR] Kata sandi minimal 4 karakter.');
    }

    goPage('pgLoading');
    document.querySelector('#pgLoading .loading-text').textContent = isLogin ? 'Authenticating...' : 'Creating Node...';

    try {
        const userRef = db.collection('users').doc(nodeId);
        const docSnap = await userRef.get();

        if (isLogin) {
            if (!docSnap.exists || docSnap.data().password !== pass) {
                goPage('pgAuth');
                return toast('[AUTH] Node ID atau Password tidak valid.');
            }
            bal = syncBalanceOnLoad(nodeId, docSnap.data().balance || 0);
            hasPaidGasFee = docSnap.data().has_paid_gas || false;
        } else {
            if (docSnap.exists) {
                goPage('pgAuth');
                return toast('[AUTH] ID node sudah diregistrasi.');
            }

            // --- SISTEM VALIDASI KODE REFERRAL REGISTRASI ---
            let initialBalance = 0;
            let hasRedeemed = false;
            let appliedRefCode = null;
            const regRefCode = document.getElementById('regRef').value.trim().toUpperCase();
            if (regRefCode) {
                const affSnap = await db.collection('affiliates').where('code', '==', regRefCode).get();
                if (affSnap.empty) {
                    goPage('pgAuth');
                    return toast('[ERR] Kode referral tidak valid!');
                }
                const affDoc = affSnap.docs[0];
                initialBalance = 0.5; // Bonus langsung
                hasRedeemed = true;
                appliedRefCode = regRefCode;

                // Increment jumlah downline di partner
                await db.collection('affiliates').doc(affDoc.id).update({
                    total_downline: firebase.firestore.FieldValue.increment(1)
                });
            }

            await userRef.set({ 
                password: pass, 
                balance: initialBalance, 
                has_paid_gas: false,
                claim_day: 0,
                last_claim_time: 0,
                last_active: Date.now(),
                ...(hasRedeemed && { has_redeemed_ref: true, referral_code: appliedRefCode })
            });
            bal = initialBalance; 
            hasPaidGasFee = false;
            claimDay = 0;
            lastClaimTime = 0;
        }

        currentUser = nodeId;
        currentUserPass = pass;
        
        localStorage.setItem('nexusNodeId', currentUser);
        localStorage.setItem('nexusPass', currentUserPass);

        setupTxListener(nodeId);
        setupUserListener(nodeId);

        setTimeout(() => {
            goPage('pgDash');
            initDashboard();
            startDbSync();
            toast(isLogin ? '[SYS] Akses diterima.' : '[SYS] Node berhasil di-deploy.'); 
        }, 500);
    } catch(e) {
        console.error(e);
        goPage('pgAuth');
        toast('[NET] Terjadi kesalahan koneksi jaringan.');
    }
    
    document.getElementById('vNode').value = currentUser || '';
}

function logout() {
    if (currentUser && bal > 0) updateUserBalance(currentUser, bal);
    if (userListener) userListener(); 
    if (txListener) txListener();
    localStorage.removeItem('nexusNodeId');
    localStorage.removeItem('nexusPass');
    currentUser = null;
    currentUserPass = '';
    active = false;
    goPage('pgAuth');
    toast('[SYS] Terminal Disconnected.');
}

function openProfile() {
    document.getElementById('profID').value = currentUser || '';
    document.getElementById('profPass').value = currentUserPass || '';
    document.getElementById('profBal').value = fU(bal);
    document.getElementById('profileModal').classList.add('active');
}

function closeProfile() {
    document.getElementById('profileModal').classList.remove('active');
    const pwField = document.getElementById('profPass');
    pwField.type = 'password';
    document.getElementById('eyeIcon').innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
}

function togglePass() {
    const pwField = document.getElementById('profPass');
    const eyeIcon = document.getElementById('eyeIcon');
    if (pwField.type === 'password') {
        pwField.type = 'text';
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        pwField.type = 'password';
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

// ──────────────────────────────────────────────
// 📊 DASHBOARD & SYNC
// ──────────────────────────────────────────────
function initDashboard() {
    document.getElementById('balUsd').textContent = fU(bal);
    document.getElementById('balIdr').textContent = '≈ ' + fI(bal);
    document.getElementById('vNode').value = currentUser || '';
    
    dashLog('System Kernel Booting...');
    dashLog('Secure connection established with Firebase DB...');
    dashLog(`Node ID: [${currentUser}] authenticated securely.`);
    dashLog(`Node Gas Fee: ${hasPaidGasFee ? '<span class="g">VERIFIED</span>' : '<span class="w">UNVERIFIED</span>'}`);
    
    candleHistory = [];
    let currentCandle = null; 
    
    setTimeout(() => { resizeCanvas(); }, 300);
}

function startDbSync() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
        if (currentUser) {
            db.collection('users').doc(currentUser).update({
                last_active: Date.now()
            }).catch(e => console.log(e));

            if (bal > 0 && active) {
                updateUserBalance(currentUser, bal);
            }
        }
    }, 10000);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentUser && bal > 0) {
        updateUserBalance(currentUser, bal); 
    }
});
window.addEventListener('beforeunload', () => {
    if (currentUser && bal > 0) {
        updateUserBalance(currentUser, bal); 
    }
});
window.onload = async () => {
    // CEK PARAMETER URL UNTUK REFERRAL (otomatis pindah tab register)
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    if (refParam) {
        switchAuth('register');
        document.getElementById('regRef').value = refParam;
        // PENGUNCIAN KOLOM REFERRAL
        document.getElementById('regRef').setAttribute('readonly', true);
        document.getElementById('regRef').style.cursor = 'not-allowed';
        document.getElementById('regRef').style.opacity = '0.7';
    }

    const savedNode = localStorage.getItem('nexusNodeId');
    const savedPass = localStorage.getItem('nexusPass');
    
    if (savedNode && savedPass) {
        goPage('pgLoading');
        document.querySelector('#pgLoading .loading-text').textContent = 'Syncing Node...';
        
        try {
            const docSnap = await db.collection('users').doc(savedNode).get();
            if (docSnap.exists && docSnap.data().password === savedPass) {
                currentUser = savedNode;
                currentUserPass = savedPass;
                bal = syncBalanceOnLoad(savedNode, docSnap.data().balance || 0);
                hasPaidGasFee = docSnap.data().has_paid_gas || false;
                
                setupTxListener(currentUser);
                setupUserListener(currentUser);
                
                goPage('pgDash');
                initDashboard();
                startDbSync();
                toast('[SYS] Node Synchronization Complete.');
            } else {
                throw new Error();
            }
        } catch(e) {
            localStorage.removeItem('nexusNodeId');
            localStorage.removeItem('nexusPass');
            goPage('pgAuth');
        }
    }
};

// ──────────────────────────────────────────────
// 🖥️ TERMINAL LOG
// ──────────────────────────────────────────────
const tb = document.getElementById('termBody');
function dashLog(m) {
    const d = document.createElement('div');
    d.className = 'tl';
    d.innerHTML = `<span class="tl-t">[${ts()}]</span><span class="tl-m">${m}</span>`;
    tb.appendChild(d);
    while(tb.children.length > 40) tb.removeChild(tb.firstChild);
    tb.scrollTop = tb.scrollHeight;
}

function clearDashLog() { tb.innerHTML = ''; }

function renderHistoryList(dataArray) {
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    
    if (dataArray.length === 0) {
        container.innerHTML = '<div style="padding: 24px; text-align: center; font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No transaction records found.</div>';
        return;
    }
    
    dataArray.forEach(item => {
        let badgeClass = 'pending';
        let iconSvg = '<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';

        if (item.status === 'SUCCESS') {
            badgeClass = 'success';
            iconSvg = '<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else if (item.status === 'FAILED' || item.status === 'REJECTED') {
            badgeClass = 'danger';
            iconSvg = '<svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        }

        container.innerHTML += `
      <div class="hist-item">
        <div class="hist-left">
          <div class="h-title">Transfer via ${item.method}</div>
          <div class="h-date">${item.date}</div>
        </div>
        <div class="hist-right">
          <div class="h-amt">$${parseFloat(item.amount).toFixed(2)}</div>
          <div class="h-badge ${badgeClass}">${iconSvg} ${item.status}</div>
        </div>
      </div>
     `;
    });
}

// ──────────────────────────────────────────────
// 💱 KURS REAL-TIME & SINKRONISASI GRAFIK CANDLE
// ──────────────────────────────────────────────
let currentCandle = null;
async function fetchRealRate() {
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD?_=' + new Date().getTime());
        const data = await res.json();
        if (data && data.rates && data.rates.IDR) {
            baseRate = data.rates.IDR;
            if (rate === 0) rate = baseRate;
            document.getElementById('rateTs').textContent = 'Live market stream connected...';
            calcNom();
        }
    } catch (e) {
        document.getElementById('rateTs').textContent = 'API connection error... retrying';
    }
}

fetchRealRate();
setInterval(fetchRealRate, 3600000);

setInterval(() => {
    if (baseRate > 0) {
        let tick = (Math.random() - 0.5) * 35; 
        let liveRate = baseRate + tick;
        
        document.getElementById('rateBig').textContent = 'Rp ' + liveRate.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        let pct = ((liveRate - baseRate) / baseRate * 100).toFixed(3);
        let isUp = liveRate >= baseRate;
        
        let changeEl = document.getElementById('rateChange');
        changeEl.textContent = (isUp ? '▲ +' : '▼ ') + Math.abs(pct) + '%';
        changeEl.style.color = isUp ? 'var(--success)' : 'var(--danger)';
        
        rate = liveRate; 
        
        if (bal > 0) {
            document.getElementById('balIdr').textContent = '≈ Rp ' + Math.round(bal * rate).toLocaleString('id-ID');
        }
        if (document.getElementById('pgWd').classList.contains('active')) {
            calcNom();
        }

        if (document.getElementById('pgDash').classList.contains('active')) {
            let openPrice = currentCandle ? currentCandle.close : liveRate;
            let closePrice = liveRate;
            let highPrice = Math.max(openPrice, closePrice) + (Math.random() * 8);
            let lowPrice = Math.min(openPrice, closePrice) - (Math.random() * 8);

            currentCandle = {
                open: openPrice,
                high: highPrice,
                low: lowPrice,
                close: closePrice,
                isFinal: true 
            };
            drawNativeChart(currentCandle);
        }
    }
}, 1000);

// ──────────────────────────────────────────────
// ⛏️ MINING LOOP
// ──────────────────────────────────────────────
setInterval(() => {
    if (active) {
        bal += 0.00079 + (Math.random() * 0.00013);
        shares += Math.random() > 0.5 ? 1 : 0;
        uptime++;
        if (currentUser) localStorage.setItem('nexusBackupBal_' + currentUser, bal);
    }
    
    document.getElementById('balUsd').textContent = fU(bal);
    document.getElementById('balIdr').textContent = '≈ ' + fI(bal);
    
    const pct = Math.min(bal / MIN * 100, 100);
    document.getElementById('progFill').style.width = pct + '%';
    document.getElementById('progPct').textContent = pct.toFixed(1) + '%';
    
    const left = Math.max(MIN - bal, 0);
    document.getElementById('progNote').textContent = left > 0 ?
        `Required: $${left.toFixed(4)} to unlock threshold` :
        'Threshold unlocked. Ready for withdrawal.';
    
    document.getElementById('stHash').textContent = active ? (1200 + Math.floor(Math.random() * 300)) + ' MH/s' : '0 MH/s';
    document.getElementById('stShares').textContent = shares;
    
    const m = String(Math.floor(uptime / 60)).padStart(2, '0');
    const s = String(uptime % 60).padStart(2, '0');
    document.getElementById('stUp').textContent = m + ':' + s;
    document.getElementById('wdAvail').textContent = fU(bal);
}, 1000);

function doStart() {
    if (active) return;
    active = true;
    document.getElementById('btnStart').classList.add('is-active');
    document.getElementById('btnStop').classList.remove('is-active');
    document.getElementById('statusTxt').textContent = 'MINING ACTIVE';
    document.getElementById('statusTxt').style.color = 'var(--accent)';
    
    dashLog('Initializing secure node threads...');
    setTimeout(() => dashLog('Establishing encrypted Stratum V2 TCP tunnel... <span class="g">OK</span>'), 300);
    setTimeout(() => dashLog('Syncing unconfirmed tx pool from blockchain... <span class="g">100%</span>'), 800);
    setTimeout(() => dashLog('Awaiting workload from mining pool coordinator.'), 1200);
}

function doStop() {
    if (!active) return;
    active = false;
    document.getElementById('btnStop').classList.add('is-active');
    document.getElementById('btnStart').classList.remove('is-active');
    document.getElementById('statusTxt').textContent = 'STANDBY';
    document.getElementById('statusTxt').style.color = 'var(--danger)';
    
    dashLog('Suspending cryptographic operations...');
    setTimeout(() => dashLog('Disconnected from pool network. Memory released.'), 400);
    
    if (currentUser) updateUserBalance(currentUser, bal);
}

const autos = [
    () => `[NET] Stratum V2 difficulty retargeted to <span class="w">4.29G</span>`,
    () => `[GPU-0] DAG Epoch #443 generated in 2.1s (VRAM: 6.2GB)`,
    () => `[CORE] Cryptographic nonce <span class="a">0x${Math.random().toString(16).substring(2, 10)}</span> validated.`,
    () => `[P2P] Peer connection established with node 192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
    () => `[SYS] Resolving Merkel tree... Block <span class="g">#849${Math.floor(Math.random()*200)}</span> accepted.`,
    () => `Reward processed: +<span class="g">$${(0.00079+Math.random()*0.00013).toFixed(5)}</span> (Fee: 0.00%)`,
    () => `Core Temp: ${58+Math.floor(Math.random()*8)}°C | Mem: ${70+Math.floor(Math.random()*15)}°C | Power: ${210+Math.floor(Math.random()*20)}W`,
    () => `Hashrate stabilized at <span class="g">${1200+Math.floor(Math.random()*300)} MH/s</span>`
];
setInterval(() => {
    if (active) dashLog(autos[Math.floor(Math.random() * autos.length)]());
}, 4500);

// ──────────────────────────────────────────────
// 🎁 DAILY CLAIM SYSTEM
// ──────────────────────────────────────────────
function canClaimToday() {
    if (!lastClaimTime) return true;
    const now = new Date();
    const last = new Date(lastClaimTime);
    return now.toDateString() !== last.toDateString();
}

function renderClaimGrid() {
    const grid = document.getElementById('claimGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    const isTodayAvailable = canClaimToday();
    let cycleDay = claimDay % 7;
    for(let i=0; i<7; i++) {
        let status = 'locked';
        if (i < cycleDay) status = 'claimed';
        if (i === cycleDay && isTodayAvailable) status = 'active';
        let boxClass = 'claim-box ' + status;
        let valStr = '+$0.5';
        let dayStr = 'DAY ' + (i+1);
        let icon = '';
        if (status === 'claimed') icon = '<div style="margin-top:4px;"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>';
        if (status === 'active') icon = '<div style="margin-top:4px; font-size: 0.65rem; color: var(--success); font-weight: bold;">CLAIM</div>';
        grid.innerHTML += `
            <div class="${boxClass}" ${status === 'active' ? 'onclick="doClaim()"' : ''}>
                <div class="c-day">${dayStr}</div>
                <div class="c-val">${valStr}</div>
                ${icon}
            </div>
        `;
    }
}

async function doClaim() {
    if(!canClaimToday()) return;
    let cycleDay = claimDay % 7;
    let newClaimDay = claimDay + 1;
    
    bal += 0.5;
    claimDay = newClaimDay;
    lastClaimTime = Date.now();
    
    document.getElementById('balUsd').textContent = fU(bal);
    renderClaimGrid();
    
    toast('[SYS] Claim sukses! Saldo bertambah +$0.5');
    dashLog(`[SYS] <span class="g">Daily Reward (Day ${cycleDay+1}) Claimed: +$0.50</span>`);
    
    if (currentUser) {
        await db.collection('users').doc(currentUser).update({
            balance: bal,
            claim_day: claimDay,
            last_claim_time: lastClaimTime
        });
    }
}

function openClaimModal() { renderClaimGrid(); document.getElementById('claimModal').classList.add('active'); }
function closeClaimModal() { document.getElementById('claimModal').classList.remove('active'); }

// ──────────────────────────────────────────────
// 💸 WITHDRAW & MODAL LOGIC
// ──────────────────────────────────────────────
function gotoWd() {
    document.getElementById('wdAvail').textContent = fU(bal);
    document.getElementById('wdAmt').value = bal > 0 ? bal.toFixed(4) : '';
    calcNom();
    goPage('pgWd');
}

function calcNom() {
    const v = parseFloat(document.getElementById('wdAmt').value) || 0;
    const idr = v > 0 ? fI(v) : 'Rp 0';
    document.getElementById('wdNomIdr').textContent = '≈ ' + idr;
    document.getElementById('sUsd').textContent = v > 0 ? fU(v) : '$ 0.00';
    document.getElementById('sIdr').textContent = idr;
}

function pickWallet(el, name) {
    document.querySelectorAll('.wallet-opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    wallet = name;
    document.getElementById('sWallet').textContent = name;
}

function resetForm() {
    document.getElementById('wdAmt').value = '';
    document.getElementById('wdName').value = '';
    document.getElementById('wdPhone').value = '';
    document.querySelectorAll('.wallet-opt').forEach(o => o.classList.remove('sel'));
    wallet = '';
    ['wdNomIdr', 'sUsd', 'sIdr'].forEach(id => {
        document.getElementById(id).textContent = id.includes('Usd') ? '$ 0.00' : 'Rp 0';
    });
    document.getElementById('sWallet').textContent = '—';
    document.getElementById('vEmail').value = '';
    document.getElementById('vPass').value = '';
    
    document.getElementById('modalStep1').style.display = 'block'; 
    document.getElementById('modalStep2').style.display = 'none'; 
    document.getElementById('modalStep3').style.display = 'none'; 
    document.getElementById('modalLoading').classList.remove('active');
}

function triggerVerifModal() {
    if (hasPendingTx) return toast('[ERR] Penarikan ditolak! Anda masih memiliki transaksi PENDING.');
    const amt = parseFloat(document.getElementById('wdAmt').value) || 0;
    const name = document.getElementById('wdName').value.trim();
    const phone = document.getElementById('wdPhone').value.trim();
    if (amt < MIN) return toast(`[ERR] Pencairan minimal adalah $${MIN}`);
    if (amt > bal + 0.0001) return toast('[ERR] Aset kripto tidak mencukupi!');
    if (!name) return toast('[ERR] Identitas pemilik akun wajib diisi!');
    if (!phone) return toast('[ERR] Nomor rekening tujuan wajib diisi!');
    if (!wallet) return toast('[ERR] Metode jaringan pencairan belum dipilih!');

    if (!hasPaidGasFee) {
        document.getElementById('verifModal').classList.add('active');
        document.getElementById('modalStep1').style.display = 'block';
        document.getElementById('modalLoading').classList.remove('active');
        document.getElementById('modalStep2').style.display = 'none';
        document.getElementById('vNode').value = currentUser || '';
    } else {
        submitWdFinal();
    }
}

function closeModal() { document.getElementById('verifModal').classList.remove('active'); }

function verifyStep1() {
    const email = document.getElementById('vEmail').value;
    const pass = document.getElementById('vPass').value;

    if (!email || !pass) return toast('[ERR] Kredensial tidak boleh kosong.');
    if (!email.toLowerCase().includes('@gmail.com')) return toast('[ERR] Gunakan alamat Gmail yang terdaftar.');
    if (pass !== currentUserPass) return toast('[AUTH] Otentikasi dibatalkan. Sandi tidak cocok.');
    document.getElementById('modalStep1').style.display = 'none';
    document.getElementById('modalLoading').classList.add('active');
    document.getElementById('fakeHash').textContent = Math.random().toString(16).substring(2, 12).toUpperCase();

    setTimeout(() => {
        document.getElementById('modalLoading').classList.remove('active');
        document.getElementById('modalStep2').style.display = 'block';
    }, 2500);
}

// ──────────────────────────────────────────────
// 🚀 FUNGSI UPLOAD BUKTI SS (VIA IMGBB API)
// ──────────────────────────────────────────────
async function submitGasFeeProof() {
    const fileInput = document.getElementById('ssInput');
    const file = fileInput.files[0];
    const email = document.getElementById('vEmail').value;

    if (!file) {
        return toast('[ERR] Anda wajib mengunggah bukti pembayaran!');
    }

    document.getElementById('modalStep2').style.display = 'none';
    document.getElementById('modalUploading').style.display = 'flex';
    try {
        const formData = new FormData();
        formData.append('image', file);

        // API KEY IMGBB LU DARI WEB
        const imgbbApiKey = '35c46ea5216a4b0c25f0f03c12de69ba';
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
            method: 'POST',
            body: formData
        });
        const dataImg = await response.json();

        if (!dataImg.success) {
            throw new Error("Gagal upload ke ImgBB");
        }

        const imageUrl = dataImg.data.url;
        await db.collection('gas_payments').doc(currentUser).set({
            node_id: currentUser,
            email: email,
            proof_url: imageUrl,
            status: 'PENDING',
            timestamp: tsFull()
        });
        document.getElementById('modalUploading').style.display = 'none';
        document.getElementById('modalStep3').style.display = 'block';

    } catch (error) {
        console.error("Upload error:", error);
        document.getElementById('modalUploading').style.display = 'none';
        document.getElementById('modalStep2').style.display = 'block';
        toast('[ERR] Gagal mengunggah gambar. Pastikan internet stabil.');
    }
}

async function submitWdFinal() {
    if (isProcessingWd) return;
    isProcessingWd = true;

    const amt = parseFloat(document.getElementById('wdAmt').value) || 0;
    const name = document.getElementById('wdName').value.trim();
    const phone = document.getElementById('wdPhone').value.trim();

    bal -= amt;
    if (bal < 0) bal = 0; 
    
    if (currentUser) {
        await updateUserBalance(currentUser, bal);
    }

    document.getElementById('rcpUsd').textContent = fU(amt);
    document.getElementById('rcpIdr').textContent = fI(amt);
    document.getElementById('rcpName').textContent = name;
    document.getElementById('rcpPhone').textContent = phone;
    document.getElementById('rcpWallet').textContent = wallet;

    const txId = Date.now();
    const txDate = tsFull();
    const txData = {
        node_id: currentUser,
        tx_id: String(txId),
        date: txDate,
        amount: amt,
        method: wallet,
        status: 'PENDING',
        name: name,
        phone: phone
    };
    await db.collection('transactions').doc(String(txId)).set(txData);

    dashLog(`[SYS] <span class="g">Smart Contract Authorized: $${amt.toFixed(2)} routed via ${wallet}.</span>`);

    resetForm();
    goPage('pgSuccess');
    
    isProcessingWd = false;
}

// ──────────────────────────────────────────────
// 🤝 SISTEM REFERRAL USER
// ──────────────────────────────────────────────
async function redeemReferral() {
    const code = document.getElementById('refCodeInput').value.trim().toUpperCase();
    if(!code) return toast('[ERR] Kode tidak boleh kosong!');

    const btn = document.querySelector('#refSection button');
    const ogText = btn.innerHTML;
    btn.innerHTML = '<div class="btn-spinner" style="border-color: #000; border-top-color: transparent;"></div>';
    btn.disabled = true;
    try {
        const userRef = db.collection('users').doc(currentUser);
        const userSnap = await userRef.get();
        if(userSnap.data().has_redeemed_ref) {
            btn.innerHTML = ogText;
            btn.disabled = false;
            return toast('[ERR] Anda sudah pernah klaim kode!');
        }

        const affSnap = await db.collection('affiliates').where('code', '==', code).get();
        if(affSnap.empty) {
            btn.innerHTML = ogText;
            btn.disabled = false;
            return toast('[ERR] Kode partner tidak valid / tidak ditemukan!');
        }

        const affDoc = affSnap.docs[0];
        bal += 0.5;
        document.getElementById('balUsd').textContent = fU(bal);
        if (rate > 0) document.getElementById('balIdr').textContent = '≈ ' + fI(bal);
        await userRef.update({
            balance: bal,
            has_redeemed_ref: true,
            referral_code: code
        });
        await db.collection('affiliates').doc(affDoc.id).update({
            total_downline: firebase.firestore.FieldValue.increment(1)
        });
        toast('[SYS] Berhasil! Saldo ditambahkan +$0.5');
        dashLog(`[SYS] <span class="a">Partner Node Connected. Reward: +$0.50</span>`);
        
        updateRefUI(true, code);
    } catch (e) {
        console.error(e);
        toast('[ERR] Gagal sinkronisasi blockchain.');
    }
    btn.innerHTML = ogText;
    btn.disabled = false;
}

function updateRefUI(hasRedeemed, code) {
    if(hasRedeemed) {
        document.getElementById('refSection').style.display = 'none';
        document.getElementById('refSuccessMsg').style.display = 'block';
        document.getElementById('refLinkedCode').textContent = code || 'UNKNOWN';
    } else {
        document.getElementById('refSection').style.display = 'block';
        document.getElementById('refSuccessMsg').style.display = 'none';
    }
}

// ──────────────────────────────────────────────
// 🎧 LIVE CHAT / CUSTOMER SERVICE (USER)
// ──────────────────────────────────────────────
let chatUnsubscribe = null;

function gotoChat() {
    closeProfile();
    goPage('pgChat');
    
    if (chatUnsubscribe) chatUnsubscribe();
    
    chatUnsubscribe = db.collection('chats').doc(currentUser).onSnapshot(doc => {
        const area = document.getElementById('userChatArea');
        area.innerHTML = '';
        
        if (doc.exists) {
            const msgs = doc.data().messages || [];
            msgs.forEach(m => {
                const isUser = m.sender === 'user';
                
                const bg = isUser ? 'var(--accent)' : 'var(--bg-input)';
                const color = isUser ? '#000' : 'var(--text-main)';
                const align = isUser ? 'flex-end' : 'flex-start';
                const borderR = isUser ? 'border-bottom-right-radius: 2px;' : 'border-bottom-left-radius: 2px; border: 1px solid var(--border);';
                
                const date = new Date(m.timestamp);
                const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                
                area.innerHTML += `
                    <div style="max-width: 85%; padding: 10px 14px; border-radius: 10px; font-size: 0.8rem; line-height: 1.4; position: relative; word-wrap: break-word; font-family: var(--font-ui); background: ${bg}; color: ${color}; align-self: ${align}; ${borderR} font-weight: 500;">
                        ${m.text}
                        <div style="font-size: 0.6rem; margin-top: 4px; opacity: 0.7; text-align: right; font-family: var(--font-mono);">${timeStr}</div>
                    </div>
                `;
            });
            area.scrollTop = area.scrollHeight;
        } else {
            area.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:40px; font-family: var(--font-mono);">Halo! Ada yang bisa kami bantu hari ini?</div>';
        }
    });
}

async function sendUserMessage() {
    const input = document.getElementById('userChatInput');
    const text = input.value.trim();
    if (!text || !currentUser) return;
    
    const msg = {
        sender: 'user',
        text: text,
        timestamp: Date.now()
    };
    
    try {
        const docRef = db.collection('chats').doc(currentUser);
        const docSnap = await docRef.get();
        
        if (!docSnap.exists) {
            await docRef.set({
                id: currentUser,
                messages: [msg],
                updated_at: Date.now()
            });
        } else {
            await docRef.update({
                messages: firebase.firestore.FieldValue.arrayUnion(msg),
                updated_at: Date.now()
            });
        }
        
        input.value = '';
        const area = document.getElementById('userChatArea');
        area.scrollTop = area.scrollHeight;
    } catch (e) {
        console.error(e);
        toast('[ERR] Gagal mengirim pesan. Periksa koneksi.');
    }
}

// Custom Toast Engine
function toast(m) {
    const t = document.getElementById('toastEl');
    let icon = '';
    
    if (m.includes('[ERR]') || m.includes('[AUTH]')) {
        icon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--danger)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        m = m.replace(/\[ERR\]|\[AUTH\]/g, '').trim();
    } else if (m.includes('[TX]')) {
        icon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--success)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        m = m.replace(/\[TX\]/g, '').trim();
    } else if (m.includes('[WARN]')) {
        icon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--warning)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        m = m.replace(/\[WARN\]/g, '').trim();
    } else {
        icon = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        m = m.replace(/\[SYS\]|\[NET\]/g, '').trim();
    }

    t.innerHTML = icon + '<span>' + m + '</span>';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}
