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
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
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
}

/******************
 * Initialization *
 ******************/
const particles = [];
const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
const BASE_SPEED = 80; // px/s
const PARTICLE_COUNT = 100;
// Size of each grid cell for spatial hashing (should be >= 2 × max radius)
const CELL_SIZE = 20;
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
    const radius = random(3, 8);
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
    isPointerDown = true;
    updatePointer(e);
});

canvas.addEventListener('pointermove', (e) => {
    if (isPointerDown) updatePointer(e);
});

window.addEventListener('pointerup', () => { isPointerDown = false; });
window.addEventListener('pointercancel', () => { isPointerDown = false; });

/********************
 * Animation Loop   *
 ********************/
let lastTime = performance.now();
function animate(now) {
    const dt = (now - lastTime) / 1000; // delta time in seconds
    lastTime = now;

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