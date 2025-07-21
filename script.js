/* 2D Particle Simulator */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

/********************
 * Resize Handling *
 ********************/
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/****************
 * Particle     *
 ****************/
class Particle {
    constructor(x, y, vx, vy, radius, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.color = color;

        // Fade state
        this.prevColor = color;
        this.fadeProgress = 1; // 1 = fully new colour
    }

    update(dt) {
        // Integrate velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Wall collisions (elastic)
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -1;
        } else if (this.x + this.radius > canvas.width) {
            this.x = canvas.width - this.radius;
            this.vx *= -1;
        }

        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy *= -1;
        } else if (this.y + this.radius > canvas.height) {
            this.y = canvas.height - this.radius;
            this.vy *= -1;
        }

        // Fade progression
        if (this.fadeProgress < 1) {
            this.fadeProgress += dt / FADE_TIME;
            if (this.fadeProgress > 1) this.fadeProgress = 1;
        }
    }

    draw(ctx) {
        let fill;
        if (this.fadeProgress === 1) {
            fill = this.color;
        } else {
            const [r, g, b] = this._blendRGB();
            fill = `rgb(${r | 0},${g | 0},${b | 0})`;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
    }

    startFade(newColor) {
        if (newColor === this.color && this.fadeProgress === 1) return;

        // If a fade already running, use current blended colour as baseline
        if (this.fadeProgress < 1) {
            // compute current blended RGB and register as prevColor (as raw string)
            const curRGB = this._blendRGB();
            this.prevColor = rgbToHex(curRGB[0] | 0, curRGB[1] | 0, curRGB[2] | 0);
        } else {
            this.prevColor = this.color;
        }

        this.color = newColor;
        this.fadeProgress = 0;
    }

    _blendRGB() {
        const [r1, g1, b1] = getRGB(this.prevColor);
        const [r2, g2, b2] = getRGB(this.color);
        const p = this.fadeProgress;
        return [
            r1 + (r2 - r1) * p,
            g1 + (g2 - g1) * p,
            b1 + (b2 - b1) * p,
        ];
    }
}

function resolveCollision(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = p1.radius + p2.radius;

    // No collision if they are apart
    if (dist >= minDist || dist === 0) return;

    // Normal vector
    const nx = dx / dist;
    const ny = dy / dist;

    // Push overlap apart equally to avoid sticking
    const overlap = minDist - dist;
    p1.x -= nx * overlap / 2;
    p1.y -= ny * overlap / 2;
    p2.x += nx * overlap / 2;
    p2.y += ny * overlap / 2;

    // Tangent vector
    const tx = -ny;
    const ty = nx;

    // Project velocities onto the normal and tangent directions
    const v1n = p1.vx * nx + p1.vy * ny;
    const v1t = p1.vx * tx + p1.vy * ty;

    const v2n = p2.vx * nx + p2.vy * ny;
    const v2t = p2.vx * tx + p2.vy * ty;

    // Swap the normal components (equal mass, perfectly elastic)
    const v1nAfter = v2n;
    const v2nAfter = v1n;

    // Convert scalar normal & tangent components back to vectors
    p1.vx = v1nAfter * nx + v1t * tx;
    p1.vy = v1nAfter * ny + v1t * ty;

    p2.vx = v2nAfter * nx + v2t * tx;
    p2.vy = v2nAfter * ny + v2t * ty;

    // --- Color dominance conversion ---
    if (p1.color !== p2.color) {
        if (dominatesColor(p1.color, p2.color)) {
            // p1 overrides p2
            p2.startFade(p1.color);
        } else if (dominatesColor(p2.color, p1.color)) {
            // p2 overrides p1
            p1.startFade(p2.color);
        }
    }
}

/******************
 * Initialization *
 ******************/
const particles = [];
const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
// ----- Cross-fade support -----
const FADE_TIME = 0.15; // seconds for colour blend
// Precompute RGB triples for palette to avoid re-parsing each frame
const COLOR_RGB = Object.fromEntries(
    COLORS.map(col => {
        const num = parseInt(col.slice(1), 16);
        return [col, [(num >> 16) & 255, (num >> 8) & 255, num & 255]];
    })
);

function parseHexColor(hex) {
    const num = parseInt(hex.slice(1), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1);
}

function getRGB(colorStr) {
    return COLOR_RGB[colorStr] || parseHexColor(colorStr);
}
// Color dominance cycle (rainbow order).
const COLOR_ORDER = COLORS;
const colorIndexMap = new Map(COLOR_ORDER.map((c, i) => [c, i]));

function dominatesColor(colorA, colorB) {
    const idxA = colorIndexMap.get(colorA);
    const idxB = colorIndexMap.get(colorB);
    if (idxA === undefined || idxB === undefined) return false;
    return idxB === (idxA + 1) % COLOR_ORDER.length;
}
const BASE_SPEED = 80; // px/s
const PARTICLE_COUNT = 100;
// Size of each grid cell for spatial hashing (should be >= 2 × max radius)
const CELL_SIZE = 32;

// ----- Particle size from UI -----
let minRadius = 3;
let maxRadius = 8;

const minRadiusSlider = document.getElementById('minRadius');
const maxRadiusSlider = document.getElementById('maxRadius');
const minRadiusLabel = document.getElementById('minRadiusValue');
const maxRadiusLabel = document.getElementById('maxRadiusValue');

function syncRadiusUI(e) {
    // Ensure constraints: min <= max
    if (parseInt(minRadiusSlider.value, 10) > parseInt(maxRadiusSlider.value, 10)) {
        if (e && e.target === minRadiusSlider) {
            maxRadiusSlider.value = minRadiusSlider.value;
        } else {
            minRadiusSlider.value = maxRadiusSlider.value;
        }
    }
    minRadius = parseInt(minRadiusSlider.value, 10);
    maxRadius = parseInt(maxRadiusSlider.value, 10);
    minRadiusLabel.textContent = minRadius;
    maxRadiusLabel.textContent = maxRadius;
}

if (minRadiusSlider && maxRadiusSlider) {
    syncRadiusUI();
    ['input', 'change'].forEach(evt => {
        minRadiusSlider.addEventListener(evt, syncRadiusUI);
        maxRadiusSlider.addEventListener(evt, syncRadiusUI);
    });
}
// NEW: Continuous-spawn parameters and pointer tracking
let spawnRate = 200; // particles per second while held (can be adjusted via slider)
let isPointerDown = false;
let pointerX = 0;
let pointerY = 0;
let spawnAccumulator = 0;

// Slider elements for adjusting spawn rate
const rateSlider = document.getElementById('spawnRate');
const rateValueLabel = document.getElementById('spawnRateValue');
if (rateSlider && rateValueLabel) {
    // Initialize from slider value
    spawnRate = parseInt(rateSlider.value, 10);
    rateValueLabel.textContent = rateSlider.value;

    // Listen for changes
    rateSlider.addEventListener('input', () => {
        spawnRate = parseInt(rateSlider.value, 10);
        rateValueLabel.textContent = rateSlider.value;
    });
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function spawnParticle(x, y) {
    const radius = random(minRadius, maxRadius);
    const angle = random(0, Math.PI * 2);
    const speed = random(BASE_SPEED * 0.5, BASE_SPEED * 1.5);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    particles.push(new Particle(x, y, vx, vy, radius, color));
}

// Create initial batch
for (let i = 0; i < PARTICLE_COUNT; i++) {
    spawnParticle(random(0, canvas.width), random(0, canvas.height));
}

function updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
}

// Replace single-burst behaviour with continuous spawning while held
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isPointerDown = true;
    updatePointer(e);
    if (canvas.setPointerCapture) {
        canvas.setPointerCapture(e.pointerId);
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    e.preventDefault();
    updatePointer(e);
});

canvas.addEventListener('pointerup', () => {
    isPointerDown = false;
});

canvas.addEventListener('pointercancel', () => {
    isPointerDown = false;
});

/********************
 * Animation Loop   *
 ********************/
let lastTime = performance.now();
function pollRadiusSliders() {
    if (!minRadiusSlider || !maxRadiusSlider) return;
    const minVal = parseInt(minRadiusSlider.value, 10);
    const maxVal = parseInt(maxRadiusSlider.value, 10);
    if (minVal !== minRadius || maxVal !== maxRadius) {
        minRadius = minVal;
        maxRadius = maxVal;
        minRadiusLabel.textContent = minRadius;
        maxRadiusLabel.textContent = maxRadius;
        // Ensure constraints visually if user crossed sliders too fast
        if (minRadius > maxRadius) {
            maxRadius = minRadius;
            maxRadiusSlider.value = minRadius;
            maxRadiusLabel.textContent = maxRadius;
        }
    }
}
function animate(now) {
    const dt = (now - lastTime) / 1000; // delta time in seconds
    lastTime = now;

    // Poll sliders each frame (covers mobile edge-cases where 'input' isn't fired)
    pollRadiusSliders();

    // Continuous spawn while pointer is down
    if (isPointerDown) {
        spawnAccumulator += spawnRate * dt;
        while (spawnAccumulator >= 1) {
            spawnParticle(pointerX, pointerY);
            spawnAccumulator -= 1;
        }
    }

    // Fading trail effect
    ctx.fillStyle = 'rgba(17, 17, 17, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Update particle positions
    for (const p of particles) {
        p.update(dt);
    }

    // 2. Build spatial hash grid
    const grid = new Map(); // key -> array of particle indices
    const getKey = (x, y) => `${x},${y}`;

    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const gx = Math.floor(p.x / CELL_SIZE);
        const gy = Math.floor(p.y / CELL_SIZE);
        const key = getKey(gx, gy);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
    }

    // 3. Resolve collisions within each cell and with select neighbouring cells
    const NEIGHBOR_OFFSETS = [
        [0, 0],  // same cell
        [1, 0],  // right
        [0, 1],  // below
        [1, 1],  // below-right (diagonal)
        [-1, 1], // below-left
    ];

    for (const [key, bucket] of grid) {
        const [cx, cy] = key.split(',').map(Number);

        for (const [dx, dy] of NEIGHBOR_OFFSETS) {
            const neighborKey = getKey(cx + dx, cy + dy);
            if (!grid.has(neighborKey)) continue;

            const neighborBucket = grid.get(neighborKey);

            // If checking the same bucket, avoid duplicate pairs by j > i
            if (neighborBucket === bucket) {
                for (let a = 0; a < bucket.length; a++) {
                    for (let b = a + 1; b < bucket.length; b++) {
                        resolveCollision(particles[bucket[a]], particles[bucket[b]]);
                    }
                }
            } else {
                // Different buckets: check all pairs (i from bucket, j from neighborBucket)
                for (const ia of bucket) {
                    for (const ib of neighborBucket) {
                        resolveCollision(particles[ia], particles[ib]);
                    }
                }
            }
        }
    }

    // 4. Draw particles
    for (const p of particles) {
        p.draw(ctx);
    }

    // FPS counter
    const fps = Math.round(1 / dt);
    document.getElementById('fps').textContent = `${fps} FPS`;

    requestAnimationFrame(animate);
}
requestAnimationFrame(animate); 