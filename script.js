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

/******************
 * Initialization *
 ******************/
const particles = [];
const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
const BASE_SPEED = 80; // px/s
const PARTICLE_COUNT = 100;

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

// Add more particles on pointer click/tap
canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Spawn a small burst of particles at click location
    for (let i = 0; i < 10; i++) {
        spawnParticle(x, y);
    }
});

/********************
 * Animation Loop   *
 ********************/
let lastTime = performance.now();
function animate(now) {
    const dt = (now - lastTime) / 1000; // delta time in seconds
    lastTime = now;

    // Fading trail effect
    ctx.fillStyle = 'rgba(17, 17, 17, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update & draw particles
    for (const p of particles) {
        p.update(dt);
        p.draw(ctx);
    }

    // FPS counter
    const fps = Math.round(1 / dt);
    document.getElementById('fps').textContent = `${fps} FPS`;

    requestAnimationFrame(animate);
}
requestAnimationFrame(animate); 