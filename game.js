// ---------------------------
// Canvas & Context
// ---------------------------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ---------------------------
// Game Variables
// ---------------------------
let plane = { x: canvas.width / 2 - 30, y: canvas.height - 100, width: 60, height: 60 };
let bullets = [];
let enemies = [];

let score = 0;
let misses = 0;
let level = 1;

let autoFireInterval = null;
let enemySpawnInterval = null;

let targetX = plane.x; // smooth movement
let gameRunning = false;

// ---------------------------
// Auto-Fire (Slower)
function startAutoFire() {
    autoFireInterval = setInterval(() => {
        bullets.push({
            x: plane.x + plane.width / 2 - 4,
            y: plane.y,
            width: 6,
            height: 12,
            speed: 5 // د اوسني سرعت نیمایي
        });
    }, 300); // interval ورو شوی
}

function stopAutoFire() {
    clearInterval(autoFireInterval);
}

// ---------------------------
// Enemy Spawning (Slower)
function startEnemySpawn() {
    enemySpawnInterval = setInterval(() => {
        enemies.push({
            x: Math.random() * (canvas.width - 40),
            y: -40,
            width: 40,
            height: 40,
            speed: 1 + level * 0.15 // د اوسني سرعت نیمایي
        });
    }, 1500); // interval ورو شوی
}

function stopEnemySpawn() {
    clearInterval(enemySpawnInterval);
}

// ---------------------------
// Smooth Movement Update
function updatePlaneMovement() {
    plane.x += (targetX - plane.x) * 0.15;

    // Bounds
    if (plane.x < 0) plane.x = 0;
    if (plane.x + plane.width > canvas.width)
        plane.x = canvas.width - plane.width;
}

// ---------------------------
// Bullet Update
function updateBullets() {
    bullets = bullets.filter(b => b.y > -20);
    bullets.forEach(b => b.y -= b.speed);
}

// ---------------------------
// Enemy Update
function updateEnemies() {
    enemies.forEach(e => e.y += e.speed);

    // Miss counter
    enemies = enemies.filter(e => {
        if (e.y > canvas.height) {
            misses++;
            if (misses >= 3) gameOver();
            return false;
        }
        return true;
    });
}

// ---------------------------
// Collision
function checkCollisions() {
    bullets.forEach((b, bi) => {
        enemies.forEach((e, ei) => {
            if (
                b.x < e.x + e.width &&
                b.x + b.width > e.x &&
                b.y < e.y + e.height &&
                b.y + b.height > e.y
            ) {
                score++;
                enemies.splice(ei, 1);
                bullets.splice(bi, 1);

                if (score % 10 === 0) level++;
            }
        });
    });
}

// ---------------------------
// Draw Everything
function drawPlane() {
    ctx.fillStyle = "#5bc0ff";
    ctx.fillRect(plane.x, plane.y, plane.width, plane.height);
}

function drawBullets() {
    ctx.fillStyle = "yellow";
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
}

function drawEnemies() {
    ctx.fillStyle = "red";
    enemies.forEach(e => ctx.fillRect(e.x, e.y, e.width, e.height));
}

function drawHUD() {
    document.getElementById("score").textContent = score;
    document.getElementById("misses").textContent = misses;
    document.getElementById("level").textContent = level;
}

// ---------------------------
// Main Loop
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updatePlaneMovement();
    updateBullets();
    updateEnemies();
    checkCollisions();

    drawPlane();
    drawBullets();
    drawEnemies();
    drawHUD();

    requestAnimationFrame(gameLoop);
}

// ---------------------------
// Start Game
function startGame() {
    gameRunning = true;
    score = 0;
    misses = 0;
    level = 1;
    bullets = [];
    enemies = [];
    plane.x = canvas.width / 2 - 30;
    targetX = plane.x;

    startAutoFire();
    startEnemySpawn();

    requestAnimationFrame(gameLoop);
}

// ---------------------------
// Game Over
function gameOver() {
    gameRunning = false;

    stopAutoFire();
    stopEnemySpawn();

    alert("GAME OVER!\nYour Score: " + score);
}

// ---------------------------
// Keyboard Controls
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") targetX -= 80;
    if (e.key === "ArrowRight") targetX += 80;
});

// ---------------------------
// Mobile Touch Controls
let isDragging = false;

canvas.addEventListener("touchstart", (e) => {
    isDragging = true;
});

canvas.addEventListener("touchend", () => {
    isDragging = false;
});

canvas.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    let touch = e.touches[0];
    let rect = canvas.getBoundingClientRect();
    targetX = touch.clientX - rect.left - plane.width / 2;
});

// ---------------------------
// Mouse Controls
let isMouseDown = false;

canvas.addEventListener("mousedown", (e) => {
    isMouseDown = true;
    movePlaneWithMouse(e);
});

canvas.addEventListener("mouseup", () => {
    isMouseDown = false;
});

canvas.addEventListener("mousemove", (e) => {
    if (isMouseDown) movePlaneWithMouse(e);
});

function movePlaneWithMouse(e) {
    let rect = canvas.getBoundingClientRect();
    targetX = e.clientX - rect.left - plane.width / 2;
}

// ---------------------------
// Start Button Event
document.getElementById("startButton").addEventListener("click", () => {
    if (!gameRunning) startGame();
});
