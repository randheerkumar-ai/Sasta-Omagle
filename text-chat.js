// text-chat.js - PeerJS Text Messaging Logic

let peer = null;
let conn = null;

const statusDisplay = document.getElementById('chat-status');
const messagesBox = document.getElementById('messages-box');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const nextBtn = document.getElementById('next-btn');

// System message append function
function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

// User message append function
function addChatMessage(sender, text) {
    const div = document.createElement('div');
    div.style.marginBottom = '8px';
    div.style.lineHeight = '1.4';
    
    if (sender === 'You') {
        div.innerHTML = `<strong style="color: #38bdf8;">You:</strong> ${text}`;
    } else {
        div.innerHTML = `<strong style="color: #ef4444;">Stranger:</strong> ${text}`;
    }
    
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

// Initialize PeerJS
function initPeer() {
    statusDisplay.textContent = 'Status: Connecting to network...';
    
    // Create new Peer connection
    peer = new Peer();

    peer.on('open', (id) => {
        statusDisplay.textContent = 'Status: Ready! Share your Peer ID or click New Chat';
        addSystemMessage(`Your ID is: ${id}`);
    });

    // Listen for incoming text connections
    peer.on('connection', (connection) => {
        conn = connection;
        setupChatHandlers();
    });

    peer.on('error', (err) => {
        addSystemMessage(`Connection error: ${err.type}`);
        statusDisplay.textContent = 'Status: Error connecting';
    });
}

// Setup Data Connection Handlers
function setupChatHandlers() {
    statusDisplay.textContent = 'Status: Connected to a Stranger!';
    addSystemMessage('You are now chatting with a random stranger. Say Hi!');
    
    messageInput.disabled = false;
    sendBtn.disabled = false;

    // Receive Message
    conn.on('data', (data) => {
        addChatMessage('Stranger', data);
    });

    // Handle Disconnect
    conn.on('close', () => {
        addSystemMessage('Stranger has disconnected.');
        statusDisplay.textContent = 'Status: Disconnected';
        messageInput.disabled = true;
        sendBtn.disabled = true;
    });
}

// Send Message
function sendMessage() {
    const text = messageInput.value.trim();
    if (text && conn && conn.open) {
        conn.send(text);
        addChatMessage('You', text);
        messageInput.value = '';
    }
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Manual Connect / New Chat Prompt
nextBtn.addEventListener('click', () => {
    const targetId = prompt("Enter Stranger's Peer ID (or ask friend to enter yours):");
    if (targetId) {
        if (conn) conn.close();
        conn = peer.connect(targetId);
        setupChatHandlers();
    }
});

// Start Peer on load
document.addEventListener('DOMContentLoaded', initPeer);