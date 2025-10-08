const canvas = document.getElementById('canvas');
const c = canvas.getContext('2d');
const fingerCountEl = document.getElementById('fingerCount');
const scanCompleteEl = document.getElementById('scanComplete');

let points = [];
let scanningFingers = {};
let scanProgress = {};
// Particle system state
let particles = [];
// Connection and performance settings
const PARTICLE_LINK_DISTANCE = 100; // px
const PARTICLE_CONNECTION_SAMPLE_LIMIT = 100; // max particles considered for connections

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
        glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
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
    fingerCountEl.style.color = points.length === 5 ? '#00ff00' : '#00ffff';

    // Emit particles continuously from each touch point while present
    for (let i = 0; i < points.length; i++) {
        const t = points[i];
        const id = t.identifier || 0;
        const progress = scanProgress[id] || 0;
        // spawn 1-3 particles per frame depending on progress (more as scan nears completion)
        const spawnCount = 1 + Math.floor(progress * 1);
        spawnParticles(t.clientX, t.clientY, spawnCount);
    }

    // keep scan-complete overlay hidden - particles serve as feedback
    scanCompleteEl.classList.remove('active');

    // Update and draw particles
    updateAndDrawParticles();

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
    particles = [];
}

// Particle helpers
function spawnParticles(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (Math.random() * 1.2),
            size: 0.1 + Math.random() * 1,
            life: 50 + Math.floor(Math.random() * 10),
            ttl: 40 + Math.floor(Math.random() * 50),
            hue: 180 + Math.floor(Math.random() * 80)
        });
        // avoid growing unbounded
        if (particles.length > 2500) particles.shift();
    }
}

function updateAndDrawParticles() {
    // Update physics and draw individual particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        // physics
        p.vy += 0.03; // gravity
        p.vx *= 0.994; // drag
        p.vy *= 0.994;
        p.x += p.vx;
        p.y += p.vy;

        const alpha = Math.max(0, p.life / p.ttl);
        c.beginPath();
        // subtle glow: draw a slightly larger translucent circle behind for softness
        c.fillStyle = `hsla(${p.hue}, 100%, 60%, ${alpha * 0.12})`;
        c.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        c.fill();

        c.beginPath();
        c.fillStyle = `hsla(${p.hue}, 100%, 60%, ${alpha})`;
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fill();

        p.life -= 1;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Draw connections (web) between nearby particles
    const len = particles.length;
    if (len > 1) {
        // choose a subset to limit O(n^2) cost when many particles
        let indices = [];
        if (len > PARTICLE_CONNECTION_SAMPLE_LIMIT) {
            // sample last N particles (recent visible ones)
            for (let i = Math.max(0, len - PARTICLE_CONNECTION_SAMPLE_LIMIT); i < len; i++) indices.push(i);
        } else {
            for (let i = 0; i < len; i++) indices.push(i);
        }

        const maxDist = PARTICLE_LINK_DISTANCE;
        const maxDistSq = maxDist * maxDist;

        // draw lines between pairs in the chosen index set
        for (let a = 0; a < indices.length; a++) {
            const i = indices[a];
            const p1 = particles[i];
            for (let b = a + 1; b < indices.length; b++) {
                const j = indices[b];
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                if (distSq <= maxDistSq) {
                    const dist = Math.sqrt(distSq);
                    const t = 1 - dist / maxDist; // 1 at zero distance, 0 at maxDist
                    const alphaLine = Math.min(0.9, t * 0.9 * (Math.min(p1.life / p1.ttl, p2.life / p2.ttl)));
                    const hueAvg = Math.round((p1.hue + p2.hue) / 2);
                    c.beginPath();
                    c.strokeStyle = `hsla(${hueAvg}, 100%, 70%, ${alphaLine})`;
                    c.lineWidth = 0.8 * t;
                    c.moveTo(p1.x, p1.y);
                    c.lineTo(p2.x, p2.y);
                    c.stroke();
                }
            }
        }
    }
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