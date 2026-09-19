// video-chat.js - Automatic MQTT Matching + PeerJS Video + Virtual Cam Fallback

let peer = null;
let currentCall = null;
let dataConn = null;
let localStream = null;
let mqttClient = null;
let myPeerId = null;
let isMatched = false;

let isMicOn = true;
let isCamOn = true;

const LOBBY_TOPIC = 'strangerchat-video-lobby-global-2026';

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const videoStatus = document.getElementById('video-status');
const videoMessages = document.getElementById('video-chat-messages');

const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const videoNextBtn = document.getElementById('video-next-btn');

const msgInput = document.getElementById('video-message-input');
const sendBtn = document.getElementById('video-send-btn');

function updateStatus(text) {
    if (videoStatus) videoStatus.textContent = text;
}

function addMessage(sender, text) {
    if (!videoMessages) return;
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.style.fontSize = '0.9rem';

    if (sender === 'System') {
        div.className = 'system-message';
        div.textContent = text;
    } else if (sender === 'You') {
        div.innerHTML = `<strong style="color: #38bdf8;">You:</strong> ${text}`;
    } else {
        div.innerHTML = `<strong style="color: #ef4444;">Stranger:</strong> ${text}`;
    }

    videoMessages.appendChild(div);
    videoMessages.scrollTop = videoMessages.scrollHeight;
}

// Dummy Stream Generator for 2nd Tab Testing
function createFakeStream() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    let count = 0;
    setInterval(() => {
        count++;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '24px sans-serif';
        ctx.fillText(`Virtual Cam (Tab 2) - ${count}`, 150, 240);
    }, 100);

    const canvasStream = canvas.captureStream(30);
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const dst = osc.connect(audioCtx.createMediaStreamDestination());
    osc.start();
    const audioTrack = dst.stream.getAudioTracks()[0];
    canvasStream.addTrack(audioTrack);

    return canvasStream;
}

// 1. Camera & Mic Access (with Fallback)
async function initMedia() {
    try {
        updateStatus('Status: Requesting camera/mic access...');
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideo) localVideo.srcObject = localStream;
        addMessage('System', 'Real Camera activated.');
    } catch (err) {
        console.warn("Hardware camera busy. Using Virtual Canvas Stream...", err);
        localStream = createFakeStream();
        if (localVideo) localVideo.srcObject = localStream;
        addMessage('System', 'Virtual testing stream activated.');
    }

    setupPeer();
}

// 2. PeerJS Setup
function setupPeer() {
    peer = new Peer();

    peer.on('open', (id) => {
        myPeerId = id;
        updateStatus('Status: Ready! Connecting to lobby...');
        addMessage('System', `Your ID: ${id}`);
        setupMQTT();
    });

    // Handle incoming video call from stranger
    peer.on('call', (call) => {
        isMatched = true;
        currentCall = call;
        call.answer(localStream);

        call.on('stream', (remoteStream) => {
            if (remoteVideo) remoteVideo.srcObject = remoteStream;
            updateStatus('Status: Connected to Stranger!');
            if (msgInput) msgInput.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            addMessage('System', 'Connected with a stranger!');
        });

        call.on('close', handleDisconnect);
    });

    // Handle incoming chat connection
    peer.on('connection', (conn) => {
        dataConn = conn;
        setupDataHandlers();
    });
}

// 3. MQTT Automatic Matchmaking Setup
function setupMQTT() {
    // Free Public MQTT Broker
    mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    mqttClient.on('connect', () => {
        mqttClient.subscribe(LOBBY_TOPIC);
        startWaitingForMatch();
    });

    mqttClient.on('message', (topic, message) => {
        if (isMatched) return;

        try {
            const data = JSON.parse(message.toString());
            // Ignore self-broadcast
            if (data.peerId === myPeerId) return;

            if (data.action === 'WAITING') {
                isMatched = true;
                updateStatus('Status: Stranger found! Connecting...');
                
                // 1. Connect Video Call
                currentCall = peer.call(data.peerId, localStream);
                currentCall.on('stream', (remoteStream) => {
                    if (remoteVideo) remoteVideo.srcObject = remoteStream;
                    updateStatus('Status: Connected to Stranger!');
                });
                currentCall.on('close', handleDisconnect);

                // 2. Connect Text Chat
                dataConn = peer.connect(data.peerId);
                setupDataHandlers();

                // Announce match found
                mqttClient.publish(LOBBY_TOPIC, JSON.stringify({
                    action: 'PAIRED',
                    targetPeerId: data.peerId
                }));
            }
        } catch (e) {
            console.error("MQTT Parse error:", e);
        }
    });
}

// 4. Broadcast waiting status to lobby
function startWaitingForMatch() {
    isMatched = false;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (msgInput) msgInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    updateStatus('Status: Looking for a stranger...');
    addMessage('System', 'Searching for someone to chat with...');

    if (mqttClient && mqttClient.connected && myPeerId) {
        mqttClient.publish(LOBBY_TOPIC, JSON.stringify({
            action: 'WAITING',
            peerId: myPeerId
        }));
    }
}

// 5. Chat Data Handlers
function setupDataHandlers() {
    if (!dataConn) return;

    dataConn.on('open', () => {
        if (msgInput) msgInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
    });

    dataConn.on('data', (data) => {
        addMessage('Stranger', data);
    });

    dataConn.on('close', handleDisconnect);
}

// Send Text Message
function sendMessage() {
    const text = msgInput.value.trim();
    if (text && dataConn && dataConn.open) {
        dataConn.send(text);
        addMessage('You', text);
        msgInput.value = '';
    }
}

// Mic Toggle
if (toggleMicBtn) {
    toggleMicBtn.addEventListener('click', () => {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isMicOn = !isMicOn;
            audioTrack.enabled = isMicOn;
            toggleMicBtn.textContent = isMicOn ? '🎤 Mic On' : '🎙️ Mic Off';
            toggleMicBtn.classList.toggle('off', !isMicOn);
        }
    });
}

// Camera Toggle
if (toggleCamBtn) {
    toggleCamBtn.addEventListener('click', () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            isCamOn = !isCamOn;
            videoTrack.enabled = isCamOn;
            toggleCamBtn.textContent = isCamOn ? '📹 Cam On' : '📷 Cam Off';
            toggleCamBtn.classList.toggle('off', !isCamOn);
        }
    });
}

// Disconnect / Reset Helper
function handleDisconnect() {
    if (remoteVideo) remoteVideo.srcObject = null;
    if (msgInput) msgInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    updateStatus('Status: Disconnected');
    addMessage('System', 'Stranger has disconnected.');
}

// Event Listeners
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (msgInput) {
    msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// "Next" Button -> Disconnect current & find new stranger automatically
if (videoNextBtn) {
    videoNextBtn.addEventListener('click', () => {
        if (currentCall) currentCall.close();
        if (dataConn) dataConn.close();
        startWaitingForMatch();
    });
}

document.addEventListener('DOMContentLoaded', initMedia);