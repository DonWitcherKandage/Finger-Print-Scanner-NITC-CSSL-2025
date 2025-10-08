const canvas = document.getElementById('canvas');
const c = canvas.getContext('2d');
const fingerCountEl = document.getElementById('fingerCount');
const scanCompleteEl = document.getElementById('scanComplete');

let points = [];
let scanningFingers = {};
let scanProgress = {};

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Fingerprint pattern SVG path data (simplified version)
function drawFingerprint(x, y, radius, progress, identifier) {
    const lines = 8;
    const maxRadius = radius;
    
    c.save();
    c.translate(x, y);
    
    // Draw concentric fingerprint lines
    for (let i = 0; i < lines; i++) {
        const r = (maxRadius / lines) * (i + 1);
        const lineProgress = Math.max(0, Math.min(1, (progress * lines - i)));
        
        if (lineProgress > 0) {
            c.beginPath();
            c.arc(0, 0, r, 0, Math.PI * 2 * lineProgress);
            
            // Gradient effect
            const gradient = c.createRadialGradient(0, 0, 0, 0, 0, r);
            gradient.addColorStop(0, `rgba(0, 255, 255, ${0.8 * lineProgress})`);
            gradient.addColorStop(1, `rgba(0, 150, 255, ${0.4 * lineProgress})`);
            
            c.strokeStyle = gradient;
            c.lineWidth = 3;
            c.stroke();
        }
    }
    
    // Add some characteristic fingerprint curves
    if (progress > 0.3) {
        const curves = 3;
        for (let i = 0; i < curves; i++) {
            const angle = (Math.PI * 2 / curves) * i;
            const curveProgress = Math.max(0, Math.min(1, (progress - 0.3) * 2));
            
            c.beginPath();
            c.arc(
                Math.cos(angle) * maxRadius * 0.3,
                Math.sin(angle) * maxRadius * 0.3,
                maxRadius * 0.4,
                angle,
                angle + Math.PI * curveProgress
            );
            c.strokeStyle = `rgba(0, 255, 255, ${0.6 * curveProgress})`;
            c.lineWidth = 2;
            c.stroke();
        }
    }
    
    // Outer glow
    if (progress > 0.8) {
        c.beginPath();
        c.arc(0, 0, maxRadius + 10, 0, Math.PI * 2);
        const glowGradient = c.createRadialGradient(0, 0, maxRadius, 0, 0, maxRadius + 20);
        glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
        glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        c.strokeStyle = glowGradient;
        c.lineWidth = 10;
        c.stroke();
    }
    
    c.restore();
}

function loop() {
    // Handle canvas resize
    if (canvas.height !== window.innerHeight || canvas.width !== window.innerWidth) {
        resizeCanvas();
    }

    // Clear canvas completely (no trail effect)
    c.clearRect(0, 0, canvas.width, canvas.height);

    // Update scan progress for each finger
    for (let id in scanningFingers) {
        if (!scanProgress[id]) {
            scanProgress[id] = 0;
        }
        scanProgress[id] = Math.min(1, scanProgress[id] + 0.03);
    }

    // Draw fingerprints for each touch point
    for (let i = 0; i < points.length; i++) {
        const touch = points[i];
        const identifier = touch.identifier || 0;
        const progress = scanProgress[identifier] || 0;
        
        drawFingerprint(touch.clientX, touch.clientY, 60, progress, identifier);
        
        // Draw finger number
        c.fillStyle = 'rgba(255, 255, 255, 0.8)';
        c.font = 'bold 16px Arial';
        c.textAlign = 'center';
        c.fillText(`F${i + 1}`, touch.clientX, touch.clientY - 80);
    }

    // Update finger count display
    fingerCountEl.textContent = `${points.length}/5`;
    fingerCountEl.style.color = points.length === 5 ? '#00ff00' : '#ffffffff';

    // Show scan complete message
    if (points.length === 5) {
        let allComplete = true;
        for (let i = 0; i < points.length; i++) {
            const id = points[i].identifier || 0;
            if (!scanProgress[id] || scanProgress[id] < 1) {
                allComplete = false;
                break;
            }
        }
        if (allComplete) {
            scanCompleteEl.classList.add('active');
        } else {
            scanCompleteEl.classList.remove('active');
        }
    } else {
        scanCompleteEl.classList.remove('active');
    }

    requestAnimationFrame(loop);
}

function positionHandler(e) {
    if (e.type === 'touchstart' || e.type === 'touchmove') {
        points = Array.from(e.touches);
        
        // Track which fingers are being scanned
        const currentIds = {};
        for (let i = 0; i < e.touches.length; i++) {
            const id = e.touches[i].identifier;
            currentIds[id] = true;
            scanningFingers[id] = true;
        }
        
        // Remove fingers that are no longer touching
        for (let id in scanningFingers) {
            if (!currentIds[id]) {
                delete scanningFingers[id];
                delete scanProgress[id];
            }
        }
        
        e.preventDefault();
    } else if (e.type === 'mousemove') {
        // For desktop testing with mouse
        points = [{ clientX: e.clientX, clientY: e.clientY, identifier: 0 }];
        scanningFingers[0] = true;
    }
}

function clearHandler(e) {
    points = [];
    scanningFingers = {};
    scanProgress = {};
}

function init() {
    resizeCanvas();
    
    canvas.addEventListener('mousemove', positionHandler, false);
    canvas.addEventListener('touchstart', positionHandler, false);
    canvas.addEventListener('touchmove', positionHandler, false);
    canvas.addEventListener('touchend', clearHandler, false);
    canvas.addEventListener('touchcancel', clearHandler, false);
    canvas.addEventListener('mouseleave', clearHandler, false);
    
    window.addEventListener('resize', resizeCanvas, false);
    
    loop();
}

window.addEventListener('load', () => {
    setTimeout(init, 100);
}, false);