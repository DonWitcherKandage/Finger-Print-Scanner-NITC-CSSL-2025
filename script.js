const canvas = document.getElementById('canvas');
const c = canvas.getContext('2d');
const fingerCountEl = document.getElementById('fingerCount');
const scanCompleteEl = document.getElementById('scanComplete');

let points = [];
let scanningFingers = {};
let scanProgress = {};

// whether per-touch emitters are currently active
let emitting = false;

// particles.js emitter containers mapped by touch identifier
const emitterContainers = {}; // id -> { el, pJSEntry }
const emittersRoot = (() => document.getElementById('particle-emitters') || (() => {
    const root = document.createElement('div');
    root.id = 'particle-emitters';
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
    return root;
})())();
// Connection and performance settings (unused - particles.js used instead)

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


    // Determine whether all five fingers are present and fully scanned
    let allComplete = false;
    if (points.length === 5) {
        allComplete = true;
        for (let i = 0; i < points.length; i++) {
            const id = points[i].identifier || 0;
            if (!scanProgress[id] || scanProgress[id] < 1) {
                allComplete = false;
                break;
            }
        }
    }

    if (allComplete) {
        // Start emitters once when all five are complete
        if (!emitting) {
            for (let i = 0; i < points.length; i++) {
                const id = points[i].identifier || 0;
                if (!emitterContainers[id]) createEmitterForId(id);
            }
            emitting = true;
        }
        // Update emitter positions to follow finger tips
        for (let i = 0; i < points.length; i++) {
            const t = points[i];
            const id = t.identifier || 0;
            const emitter = emitterContainers[id];
            if (emitter && emitter.el) {
                emitter.el.style.left = `${t.clientX}px`;
                emitter.el.style.top = `${t.clientY}px`;
            }
        }
    } else {
        // If not all complete, ensure no emitters are active
        if (emitting) {
            for (const id in emitterContainers) destroyEmitter(id);
            emitting = false;
        }
    }

    // Keep scan-complete overlay hidden — particles serve as feedback
    scanCompleteEl.classList.remove('active');

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
                // destroy emitter for this id if exists
                if (emitterContainers[id]) {
                    destroyEmitter(id);
                }
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
    // destroy all emitters
    for (const id in emitterContainers) {
        destroyEmitter(id);
    }
}

function createEmitterForId(id) {
    // create container
    const container = document.createElement('div');
    container.className = 'emitter-container';
    container.style.position = 'absolute';
    container.style.left = '0px';
    container.style.top = '0px';
    container.style.width = '220px';
    container.style.height = '220px';
    container.style.pointerEvents = 'none';
    container.style.transform = 'translate(-50%, -50%)';
    emittersRoot.appendChild(container);

    // unique DOM id for particles.js
    const domId = `pjs-emitter-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    container.id = domId;

    // particles.js config: small particles with line connections
    const cfg = {
        particles: {
            // start small and slow; we'll animate these properties to create a smooth "ease in" effect
            number: { value: 10, density: { enable: false } },
            color: { value: '#9ff' },
            shape: { type: 'circle' },
            opacity: { value: 0.0, anim: { enable: true, speed: 1, opacity_min: 0.2, sync: false } },
            size: { value: 1.5, random: true },
            line_linked: { enable: true, distance: 20, color: '#9ff', opacity: 0.0, width: 1 },
            move: { enable: true, speed: 0.3, direction: 'none', out_mode: 'out' }
        },
        interactivity: { detect_on: 'canvas', events: { onhover: { enable: false }, onclick: { enable: false } } },
        retina_detect: true
    };

    // initialize particles.js instance on this container
    /* global particlesJS */
    try {
        particlesJS(domId, cfg);
        // store and attempt to find the created pJS instance
        let pjsInstance = null;
        if (window.pJSDom && window.pJSDom.length) {
            for (let i = 0; i < window.pJSDom.length; i++) {
                const pdom = window.pJSDom[i];
                if (pdom && pdom.pJS && pdom.pJS.canvas && pdom.pJS.canvas.el && pdom.pJS.canvas.el.id === domId) {
                    pjsInstance = pdom.pJS;
                    break;
                }
            }
        }
        emitterContainers[id] = { el: container, domId, pJS: pjsInstance, growthRaf: null };

        // Fade in container smoothly
        container.style.opacity = '0';
        container.style.transition = 'opacity 700ms ease-out, transform 700ms ease-out';
        // force reflow then set to visible
        requestAnimationFrame(() => {
            container.style.opacity = '1';
            container.style.transform = 'translate(-50%, -50%) scale(1)';
        });

        // animate pJS parameters (speed, link distance, opacity) to create gradual spread
        if (pjsInstance) animateEmitterGrowth(id, pjsInstance);
    } catch (err) {
        // fallback: just keep container but no pjs instance
        console.warn('particles.js init failed for emitter', id, err);
        emitterContainers[id] = { el: container, domId: null, pJS: null, growthRaf: null };
    }
}

// Gradually increase move.speed, line_linked.distance and opacity in the particles.js instance
function animateEmitterGrowth(id, pjsInstance) {
    const duration = 1400; // ms
    const start = performance.now();

    // initial and target values
    const initSpeed = pjsInstance.particles.move.speed || 0.3;
    const targetSpeed = 2.2;
    const initLink = (pjsInstance.particles.line_linked && pjsInstance.particles.line_linked.distance) || 20;
    const targetLink = 90;
    const initOpacity = (pjsInstance.particles.opacity && pjsInstance.particles.opacity.value) || 0.0;
    const targetOpacity = 0.8;

    function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic-like

        // interpolate
        const speed = initSpeed + (targetSpeed - initSpeed) * ease;
        const link = initLink + (targetLink - initLink) * ease;
        const opacity = initOpacity + (targetOpacity - initOpacity) * ease;

        try {
            if (pjsInstance && pjsInstance.particles) {
                pjsInstance.particles.move.speed = speed;
                if (pjsInstance.particles.line_linked) pjsInstance.particles.line_linked.distance = link;
                if (pjsInstance.particles.opacity) pjsInstance.particles.opacity.value = opacity;
                // also update the color alpha for links if present
                if (pjsInstance.particles.line_linked) pjsInstance.particles.line_linked.opacity = Math.min(0.7, opacity * 0.7);
            }
        } catch (e) {
            // ignore
        }

        // keep requestAnimationFrame id to allow cancellation on destroy
        const entry = emitterContainers[id];
        if (t < 1 && entry) {
            entry.growthRaf = requestAnimationFrame(step);
        } else if (entry) {
            entry.growthRaf = null;
        }
    }

    emitterContainers[id].growthRaf = requestAnimationFrame(step);
}

function destroyEmitter(id) {
    const e = emitterContainers[id];
    if (!e) return;
    try {
        // particles.js attaches a window.pJSDom entry we can remove
        if (e.domId && window.pJSDom) {
            for (let i = window.pJSDom.length - 1; i >= 0; i--) {
                if (window.pJSDom[i].pJS && window.pJSDom[i].pJS.canvas && window.pJSDom[i].pJS.canvas.el.id === e.domId) {
                    window.pJSDom[i].pJS.fn.vendors.destroypJS();
                    window.pJSDom.splice(i, 1);
                    break;
                }
            }
        }
    } catch (err) {
        // ignore
    }
    // cancel growth animation if running
    if (e.growthRaf) {
        cancelAnimationFrame(e.growthRaf);
        e.growthRaf = null;
    }

    // fade out then remove element
    if (e.el) {
        try {
            e.el.style.transition = 'opacity 500ms ease-out, transform 500ms ease-out';
            e.el.style.opacity = '0';
            e.el.style.transform = 'translate(-50%, -50%) scale(0.9)';
            setTimeout(() => {
                if (e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el);
            }, 500);
        } catch (err) {
            if (e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el);
        }
    }

    delete emitterContainers[id];
}

// Particle helpers
/* old custom particle system removed — using particles.js emitters instead */

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