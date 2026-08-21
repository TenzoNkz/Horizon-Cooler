import { BleClient } from '@capacitor-community/bluetooth-le';

// Konstanta ESP32
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const TX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

let deviceId = null;
let isRgbOn = true;

// Elemen UI
const statusDot = document.getElementById('statusDot');
const btStatusText = document.getElementById('btStatusText');
const connToggleBtn = document.getElementById('connToggleBtn');
const mainDashboard = document.getElementById('mainDashboard');

// Fungsi Koneksi Global
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

        btStatusText.innerText = 'Connected';
        statusDot.classList.add('connected');
        connToggleBtn.innerText = 'Disconnect';
        connToggleBtn.classList.add('connected');
        mainDashboard.classList.remove('panel-disabled');

        await BleClient.startNotifications(deviceId, SERVICE_UUID, TX_UUID, (value) => {
            let text = new TextDecoder().decode(value.buffer);
            if (text.startsWith('MD:')) document.getElementById('modeDisplay').innerText = text.replace('MD:', '') + '/55';
            if (text.startsWith('BRV:')) {
                let v = parseInt(text.replace('BRV:', ''));
                document.getElementById('brightnessSlider').value = v;
                document.getElementById('brightnessVal').innerText = Math.round((v/255)*100) + '%';
            }
        });

        setTimeout(() => window.sendCommand('SYNC'), 400);

    } catch (error) {
        console.error("BLE Error:", error);
        btStatusText.innerText = 'Failed';
        setTimeout(() => btStatusText.innerText = 'Disconnected', 2000);
    }
}

function onDisconnected() {
    deviceId = null;
    statusDot.classList.remove('connected');
    btStatusText.innerText = 'Disconnected';
    connToggleBtn.innerText = 'Connect';
    connToggleBtn.classList.remove('connected');
    mainDashboard.classList.add('panel-disabled');
}

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

window.toggleRgbState = () => {
    isRgbOn = !isRgbOn;
    const b = document.getElementById('rgbStateBadge');
    b.innerText = isRgbOn ? 'ON' : 'OFF';
    b.style.background = isRgbOn ? 'var(--grad-primary)' : 'rgba(255, 51, 102, 0.15)';
    b.style.color = isRgbOn ? '#ffffff' : 'var(--danger-soft)';
    window.sendCommand('RGB_TOGGLE');
};

// Slider Event Listeners
const slider = document.getElementById('brightnessSlider');
slider.addEventListener('input', e => {
    document.getElementById('brightnessVal').innerText = Math.round((e.target.value/255)*100) + '%';
});
slider.addEventListener('change', e => window.sendCommand('BR:' + e.target.value));
