import { BleClient } from '@capacitor-community/bluetooth-le';

// --- KONSTANTA UUID ESP32 ---
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// --- VARIABEL STATUS GLOBAL ---
let deviceId = null;
let isRgbOn = true;

// --- ELEMEN UI ---
const statusDot = document.getElementById('statusDot');
const btStatusText = document.getElementById('btStatusText');
const connToggleBtn = document.getElementById('connToggleBtn');
const mainDashboard = document.getElementById('mainDashboard');
const modeDisplay = document.getElementById('modeDisplay');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessVal = document.getElementById('brightnessVal');
const rgbStateBadge = document.getElementById('rgbStateBadge');

// --- FUNGSI KONEKSI UTAMA ---
window.toggleBluetoothConnection = async () => {
    if (deviceId) {
        await BleClient.disconnect(deviceId);
    } else {
        connectBLE();
    }
};

async function connectBLE() {
    try {
        btStatusText.innerText = 'Initializing...';
        await BleClient.initialize({ androidNeverForLocation: true });

        btStatusText.innerText = 'Scanning...';
        const device = await BleClient.requestDevice({
            services: [SERVICE_UUID],
            optionalServices: []
        });

        deviceId = device.deviceId;
        btStatusText.innerText = 'Connecting...';
        
        await BleClient.connect(deviceId, () => onDisconnected());

        // Update UI saat terhubung
        btStatusText.innerText = 'Connected';
        statusDot.classList.add('connected');
        connToggleBtn.innerText = 'Disconnect';
        connToggleBtn.classList.add('connected');
        mainDashboard.classList.remove('panel-disabled');

        // --- SISTEM SINGLE SOURCE OF TRUTH (MENDENGARKAN ESP32) ---
        await BleClient.startNotifications(deviceId, SERVICE_UUID, TX_UUID, (value) => {
            let text = new TextDecoder().decode(value.buffer).trim(); // Bersihkan karakter kosong
            
            // 1. Menangkap status Mode (contoh: "MD:12")
            if (text.startsWith('MD:')) {
                modeDisplay.innerText = text.replace('MD:', '') + '/55';
            }
            
            // 2. Menangkap status Brightness (contoh: "BRV:128")
            if (text.startsWith('BRV:')) {
                let v = parseInt(text.replace('BRV:', ''));
                brightnessSlider.value = v;
                brightnessVal.innerText = Math.round((v/255)*100) + '%';
            }
            
            // 3. Menangkap status Nyala/Mati LED secara aktual (contoh: "RGB:1" atau "RGB:0")
            if (text.startsWith('RGB:')) {
                let state = text.replace('RGB:', '');
                updateRgbUI(state === '1');
            }
        });

        // Minta ESP32 mengirim semua status saat ini segera setelah terhubung
        setTimeout(() => window.sendCommand('SYNC'), 400);

    } catch (error) {
        console.error("BLE Error:", error);
        btStatusText.innerText = 'Failed';
        setTimeout(() => btStatusText.innerText = 'Disconnected', 2000);
    }
}

// --- PENANGANAN PUTUS KONEKSI ---
function onDisconnected() {
    deviceId = null;
    statusDot.classList.remove('connected');
    btStatusText.innerText = 'Disconnected';
    connToggleBtn.innerText = 'Connect';
    connToggleBtn.classList.remove('connected');
    mainDashboard.classList.add('panel-disabled');
}

// --- FUNGSI MENGIRIM PERINTAH KE ESP32 ---
window.sendCommand = async (cmd) => {
    if (!deviceId) return;
    try {
        const data = new TextEncoder().encode(cmd);
        const dataView = new DataView(data.buffer);
        await BleClient.write(deviceId, SERVICE_UUID, RX_UUID, dataView);
    } catch (error) {
        console.error("Write Error:", error);
    }
};

// --- FUNGSI UPDATE UI (HANYA DIPANGGIL OLEH RESPON ESP32) ---
function updateRgbUI(isOn) {
    isRgbOn = isOn;
    rgbStateBadge.innerText = isRgbOn ? 'ON' : 'OFF';
    rgbStateBadge.style.background = isRgbOn ? 'var(--grad-primary)' : 'rgba(255, 51, 102, 0.15)';
    rgbStateBadge.style.color = isRgbOn ? '#ffffff' : 'var(--danger-soft)';
}

// --- TOMBOL TRIGGER ---
window.toggleRgbState = () => {
    // Tombol hanya mengirim perintah, TIDAK mengubah UI secara langsung
    window.sendCommand('RGB_TOGGLE');
};

// --- KONTROL SLIDER ---
brightnessSlider.addEventListener('input', e => {
    // Update teks persen secara lokal saat digeser agar UI terasa responsif
    brightnessVal.innerText = Math.round((e.target.value/255)*100) + '%';
});

brightnessSlider.addEventListener('change', e => {
    // Kirim nilai akhir ke ESP32 saat geseran dilepas (contoh: "BR:200")
    window.sendCommand('BR:' + e.target.value);
});
