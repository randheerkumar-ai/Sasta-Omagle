// main.js - Home Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const textBtn = document.querySelector('.btn-text');
    const videoBtn = document.querySelector('.btn-video');

    // Page redirect logic with smooth handling
    if (textBtn) {
        textBtn.addEventListener('click', (e) => {
            console.log("Navigating to Text Chat...");
        });
    }

    if (videoBtn) {
        videoBtn.addEventListener('click', (e) => {
            console.log("Navigating to Video Chat...");
        });
    }
});