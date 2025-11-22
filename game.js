// game.js - Mini Mario upgraded: 20 Levels, increasing enemies, varied enemies, better player physics
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let DPR = Math.max(1, window.devicePixelRatio || 1);
function resize() {
    canvas.width = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
}
resize();
window.addEventListener('resize', () => { resize(); regenerateLevel(); });

// HUD elements
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const enemiesCountEl = document.getElementById('enemiesCount');

// audio simple
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx;
try { actx = new AudioCtx(); } catch (e) { actx = null; }
function playTone(freq, time = 0.08, vol = 0.06) {
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.frequency.value = freq;
    g.gain.value = vol;
    o.start(); o.stop(actx.currentTime + time);
}

// world params
const TILE = 48;
const GRAVITY = 1500;
const STEP = 1 / 60;

// level system
let currentLevel = 1;
const MAX_LEVEL = 20;

// dynamic map size depending on level
function colsForLevel(level) { return 40 + level * 6; } // wider with level
let levelCols = colsForLevel(currentLevel);
let levelRows = 12;

// data stores
let tiles = [], coins = [], enemies = [], flag = null;

// generate map for current level (procedural simple)
function generateLevelData(level) {
    const COLS = colsForLevel(level);
    const ROWS = levelRows;
    // create empty 2D grid
    const map = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    const groundRow = ROWS - 2;
    // create ground with some gaps
    for (let c = 0; c < COLS; c++) {
        // create occasional gap for challenge
        if (Math.random() < 0.04 && c > 6 && c < COLS - 8) {
            map[groundRow][c] = 0;
        } else {
            map[groundRow][c] = 1;
        }
    }
    // add platforms based on level
    const platformCount = Math.min(20, 6 + Math.floor(level * 1.2));
    for (let i = 0; i < platformCount; i++) {
        const w = 1 + Math.floor(Math.random() * 4);
        const c = 8 + Math.floor(Math.random() * (COLS - 18));
        const r = groundRow - 2 - Math.floor(Math.random() * 5);
        for (let x = c; x < c + w; x++) {
            if (x >= 0 && x < COLS) map[r][x] = 1;
        }
        // sometimes place coins above
        if (Math.random() < 0.6) {
            for (let x = c; x < c + w; x++) {
                if (Math.random() < 0.6) map[r - 1][x] = 2;
            }
        }
    }
    // question blocks sprinkle
    for (let i = 0; i < Math.floor(level / 2); i++) {
        const c = 10 + Math.floor(Math.random() * (COLS - 20));
        const r = groundRow - 3 - Math.floor(Math.random() * 3);
        map[r][c] = 3;
    }
    // enemies spawn markers - will expand to multiple enemies based on level
    // We'll not fill enemies here, we'll spawn later across map positions.
    // place flag near end
    map[groundRow][COLS - 3] = 1;
    map[groundRow - 2][COLS - 3] = 1;
    map[groundRow - 1][COLS - 1] = 9; // flag marker
    return map;
}

// convert map to tiles/coins/flag
let levelMap = [];
function layoutFromMap(map) {
    tiles = []; coins = []; enemies = []; flag = null;
    const ROWS = map.length, COLS = map[0].length;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const v = map[r][c];
            const x = c * TILE;
            const y = r * TILE;
            if (v === 1) tiles.push({ x, y, w: TILE, h: TILE, type: 'ground', col: c, row: r });
            if (v === 2) coins.push({ x: x + TILE * 0.25, y: y + TILE * 0.25, w: TILE * 0.5, h: TILE * 0.5, collected: false });
            if (v === 3) tiles.push({ x, y, w: TILE, h: TILE, type: 'qblock', col: c, row: r });
            if (v === 9) flag = { x: x, y: y - TILE, w: TILE * 0.6, h: TILE * 1.6 };
        }
    }
    // spawn enemies according to level: enemies count = level * 5
    spawnEnemiesForLevel(currentLevel, map);
}

// spawn enemies distributed across map columns
function spawnEnemiesForLevel(level, map) {
    enemies = [];
    const COLS = map[0].length;
    const cnt = level * 5;
    // distribute spawn columns avoiding start zone
    const possibleCols = [];
    for (let c = 6; c < COLS - 6; c++) {
        // only if ground exists under the column at ground row
        const groundRow = map.length - 2;
        if (map[groundRow][c] === 1) possibleCols.push(c);
    }
    for (let i = 0; i < cnt; i++) {
        const col = possibleCols[Math.floor(Math.random() * possibleCols.length)];
        const x = col * TILE + (Math.random() * TILE * 0.2);
        // select enemy type by i to vary shapes
        const typeIndex = i % 4;
        const y = findSurfaceYAt(col, map);
        const enemy = createEnemyByType(typeIndex, x, y);
        enemies.push(enemy);
    }
    updateHUD();
}

// determine y spawn above ground
function findSurfaceYAt(col, map) {
    for (let r = 0; r < map.length; r++) {
        if (map[r][col] === 1) {
            return r * TILE - TILE * 0.95;
        }
    }
    return (map.length - 2) * TILE - TILE * 0.95;
}

// create enemy variations
function createEnemyByType(idx, x, y) {
    // types:
    // 0: walker (simple left-right)
    // 1: big slow (wider, more HP-like but here one-hit)
    // 2: flyer (oscillates vertically horizontally)
    // 3: jumper (periodic small jumps)
    if (idx === 0) return { x, y, w: TILE * 0.85, h: TILE * 0.85, dir: Math.random() < 0.5 ? 1 : -1, speed: 70 + Math.random() * 30, alive: true, kind: 'walker', color: '#d94b4b', state: {} };
    if (idx === 1) return { x, y, w: TILE * 1.1, h: TILE * 1.1, dir: Math.random() < 0.5 ? 1 : -1, speed: 40 + Math.random() * 20, alive: true, kind: 'big', color: '#8b3bff', state: {} };
    if (idx === 2) return {
        x, y,  w: TILE * 0.7, h: TILE * 0.7, dir: Math.random() < 0.5 ? 1 : -1, speed: 90 + Math.random() * 40, alive: true, kind: 'flyer', color: '#ffb84d', state: { phase: Math.random() * Math.PI * 2 }
    };
    return { x, y, w: TILE * 0.75, h: TILE * 0.75, dir: Math.random() < 0.5 ? 1 : -1, speed: 60 + Math.random() * 40, alive: true, kind: 'jumper', color: '#2fb3ff', state: { timer: Math.random() * 1.5 } };
};

// player with better physics (accel, friction, coyote, variable jump)
const player = {
    x: TILE * 2,
    y: 0,
    w: TILE * 0.85,
    h: TILE * 0.95,
    vx: 0,
    vy: 0,
    maxSpeed: 300,
    accel: 2800,
    friction: 0.85,
    jumpPower: 650,
    grounded: false,
    alive: true,
    coyote: 0,
    canDoubleJump: false
};

let score = 0;
let lives = 3;

// camera
const camera = { x: 0, y: 0, w: canvas.width / DPR, h: canvas.height / DPR };

// input
const keys = {};
window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === ' ') keys.jump = true;
    if (e.key === 'r') restartLevel();
});
window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === ' ') keys.jump = false;
});

// touch buttons
const leftBtn = document.getElementById('left');
const rightBtn = document.getElementById('right');
const jumpBtn = document.getElementById('jump');
const restartBtn = document.getElementById('restart');
[leftBtn, rightBtn, jumpBtn].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('touchstart', e => { e.preventDefault(); if (btn === leftBtn) keys.left = true; if (btn === rightBtn) keys.right = true; if (btn === jumpBtn) keys.jump = true; });
    btn.addEventListener('touchend', e => { e.preventDefault(); if (btn === leftBtn) keys.left = false; if (btn === rightBtn) keys.right = false; if (btn === jumpBtn) keys.jump = false; });
    btn.addEventListener('mousedown', e => { if (btn === leftBtn) keys.left = true; if (btn === rightBtn) keys.right = true; if (btn === jumpBtn) keys.jump = true; });
    btn.addEventListener('mouseup', e => { if (btn === leftBtn) keys.left = false; if (btn === rightBtn) keys.right = false; if (btn === jumpBtn) keys.jump = false; });
});
restartBtn.addEventListener('click', restartLevel);

// helpers
function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// level control
function regenerateLevel() {
    levelCols = colsForLevel(currentLevel);
    levelMap = generateLevelData(currentLevel);
    layoutFromMap(levelMap);
    // reset player position relative to world height
    player.x = TILE * 2;
    player.y = (levelRows - 6) * TILE;
    player.vx = player.vy = 0;
    player.alive = true;
    camera.x = 0; camera.y = 0;
    updateHUD();
}
function nextLevel() {
    currentLevel++;
    if (currentLevel > MAX_LEVEL) {
        alert('Congratulations! You finished all levels. Score: ' + score);
        currentLevel = 1;
        score = 0; lives = 3;
    }
    regenerateLevel();
}
function restartLevel() {
    // keep current level number but reset player & map
    regenerateLevel();
    score = 0; lives = 3;
    updateHUD();
}

// spawn initially
regenerateLevel();

// HUD update
function updateHUD() {
    levelEl.textContent = 'Level: ' + currentLevel + ' / ' + MAX_LEVEL;
    scoreEl.textContent = 'Score: ' + score;
    livesEl.textContent = 'Lives: ' + lives;
    enemiesCountEl.textContent = 'Enemies: ' + enemies.filter(e => e.alive).length;
}

// fixed timestep loop
let last = performance.now() / 1000;
let accumulator = 0;

function update(dt) {
    if (!player.alive) return;
    // horizontal control with accel/friction
    if (keys.left) player.vx -= player.accel * dt;
    if (keys.right) player.vx += player.accel * dt;
    // clamp
    if (player.vx > player.maxSpeed) player.vx = player.maxSpeed;
    if (player.vx < -player.maxSpeed) player.vx = -player.maxSpeed;
    // apply friction when no input
    if (!keys.left && !keys.right) player.vx *= Math.pow(player.friction, dt * 60);

    // gravity
    player.vy += GRAVITY * dt;

    // coyote time & jump
    const COYOTE = 0.12;
    player.coyote = player.grounded ? COYOTE : Math.max(0, player.coyote - dt);
    if (keys.jump && player.coyote > 0) {
        player.vy = -player.jumpPower;
        player.grounded = false;
        player.coyote = 0;
        playTone(220, 0.08, 0.05);
    }

    // variable jump (if released early)
    if (!keys.jump && player.vy < 0) player.vy += GRAVITY * dt * 0.55;

    // move horizontally & handle horizontal collisions
    player.x += player.vx * dt;
    for (const t of tiles) {
        if (t.type === 'ground' || t.type === 'qblock') {
            if (rectsOverlap(player, t)) {
                // resolve small push depending on prev position
                if (player.vx > 0) player.x = t.x - player.w - 0.01;
                else if (player.vx < 0) player.x = t.x + t.w + 0.01;
                player.vx = 0;
            }
        }
    }

    // move vertically & collision
    player.y += player.vy * dt;
    player.grounded = false;
    for (const t of tiles) {
        if (t.type === 'ground' || t.type === 'qblock') {
            if (rectsOverlap(player, t)) {
                const prevBottom = player.y + player.h - player.vy * dt;
                if (prevBottom <= t.y + 1) {
                    // landed
                    player.y = t.y - player.h - 0.01;
                    player.vy = 0;
                    player.grounded = true;
                } else {
                    // head hit
                    player.y = t.y + t.h + 0.01;
                    player.vy = Math.max(0, player.vy);
                }
                // qblock logic
                if (t.type === 'qblock' && prevBottom <= t.y + 1) {
                    t.type = 'ground';
                    coins.push({ x: t.x + TILE * 0.25, y: t.y - TILE * 0.5, w: TILE * 0.5, h: TILE * 0.5, collected: false, vy: -200, bounce: true });
                }
            }
        }
    }

    // collect coins
    for (const c of coins) {
        if (c.collected) continue;
        if (rectsOverlap(player, c)) {
            c.collected = true;
            score += 1;
            playTone(880, 0.06, 0.04);
            updateHUD();
        }
    }
    // coin bounce updates
    for (const c of coins) {
        if (c.bounce && !c.collected) {
            c.vy += GRAVITY * dt;
            c.y += c.vy * dt;
            if (c.y > canvas.height / DPR) c.collected = true;
        }
    }

    // enemies behavior
    for (const e of enemies) {
        if (!e.alive) continue;
        if (e.kind === 'walker' || e.kind === 'big') {
            // move and turn if collision with tiles
            e.x += e.dir * e.speed * dt;
            let collided = false;
            for (const t of tiles) {
                if (t.type !== 'ground') continue;
                if (rectsOverlap(e, t)) {
                    collided = true;
                    if (e.dir > 0) e.x = t.x - e.w - 0.01;
                    else e.x = t.x + t.w + 0.01;
                    e.dir *= -1;
                }
            }
        } else if (e.kind === 'flyer') {
            // horizontal drift + vertical sinus motion
            e.x += e.dir * e.speed * dt;
            e.state.phase += dt * (0.8 + Math.random() * 0.6);
            e.y += Math.sin(e.state.phase) * 12 * dt * 60;
        } else if (e.kind === 'jumper') {
            e.x += e.dir * e.speed * dt * 0.6;
            e.state.timer -= dt;
            if (e.state.timer <= 0) {
                e.state.timer = 1.0 + Math.random() * 1.8;
                e.vy = -300 - Math.random() * 180;
            }
            if (e.vy === undefined) e.vy = 0;
            e.vy += GRAVITY * dt;
            e.y += e.vy * dt;
            // ground collision for jumper
            for (const t of tiles) {
                if (t.type !== 'ground') continue;
                if (rectsOverlap(e, t)) {
                    const prevBottom = e.y + e.h - (e.vy * dt);
                    if (prevBottom <= t.y + 1) {
                        e.y = t.y - e.h - 0.01;
                        e.vy = 0;
                    }
                }
            }
        }

        // player-enemy collision
        if (rectsOverlap(player, e) && e.alive) {
            const playerPrevBottom = player.y + player.h - player.vy * dt;
            if (playerPrevBottom <= e.y + 4 && player.vy > 0) { // stomp
                e.alive = false;
                player.vy = -player.jumpPower * 0.45;
                score += 2;
                playTone(1200, 0.06, 0.04);
                updateHUD();
            } else {
                // hit from side -> lose life
                hurtPlayer();
            }
        }
    }

    // reach flag?
    if (flag && rectsOverlap(player, flag)) {
        // next level after short delay
        player.alive = false;
        setTimeout(() => {
            nextLevel();
        }, 300);
    }

    // fall off map
    if (player.y > canvas.height / DPR + 300) {
        hurtPlayer();
    }

    // camera smoothing follow
    const targetX = player.x + player.w / 2 - camera.w / 2;
    const targetY = player.y + player.h / 2 - camera.h / 2;
    camera.x += (targetX - camera.x) * Math.min(1, 6 * dt);
    camera.y += (targetY - camera.y) * Math.min(1, 6 * dt);
    // clamp
    const worldWidth = levelMap[0].length * TILE;
    camera.x = Math.max(0, Math.min(camera.x, worldWidth - camera.w));
    camera.y = Math.max(0, Math.min(camera.y, levelMap.length * TILE - camera.h));
}

// player hurt / respawn
function hurtPlayer() {
    if (!player.alive) return;
    playTone(120, 0.12, 0.08);
    lives -= 1;
    updateHUD();
    player.alive = false;
    if (lives <= 0) {
        setTimeout(() => {
            alert('Game Over! Score: ' + score);
            currentLevel = 1; score = 0; lives = 3;
            regenerateLevel();
        }, 300);
    } else {
        setTimeout(() => {
            respawnPlayer();
        }, 700);
    }
}
function respawnPlayer() {
    player.x = TILE * 2; player.y = (levelRows - 6) * TILE; player.vx = player.vy = 0; player.alive = true;
}

// rendering: parallax + world + entities + UI
function drawParallax() {
    const w = canvas.width / DPR, h = canvas.height / DPR;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#a9e6ff'); g.addColorStop(1, '#7ec8ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // distant hills (layer 1)
    const p1 = camera.x * 0.18;
    ctx.fillStyle = '#6bbf73';
    for (let i = -2; i < 12; i++) {
        const hx = (i * 420 - (p1 % 420));
        const hy = h * 0.72;
        ctx.beginPath(); ctx.ellipse(hx, hy, 260, 120, 0, 0, Math.PI * 2); ctx.fill();
    }
    // clouds
    const p2 = camera.x * 0.33;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 9; i++) {
        const cx = (i * 300 - (p2 % 300));
        const cy = 80 + (i % 3) * 28;
        ctx.beginPath(); ctx.ellipse(cx, cy, 70, 30, 0, 0, Math.PI * 2); ctx.ellipse(cx + 50, cy + 6, 50, 22, 0, 0, Math.PI * 2); ctx.fill();
    }
    // trees layer
    const p3 = camera.x * 0.66;
    for (let i = -4; i < 12; i++) {
        const tx = (i * 200 - (p3 % 200));
        const ty = h * 0.82;
        ctx.fillStyle = '#6b3b21'; ctx.fillRect(tx + 20, ty - 40, 14, 40);
        ctx.fillStyle = '#2f9b4b'; ctx.beginPath(); ctx.ellipse(tx + 27, ty - 60, 36, 30, 0, 0, Math.PI * 2); ctx.fill();
    }
}

function drawWorld() {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // tiles
    for (const t of tiles) {
        if (t.type === 'ground') {
            ctx.fillStyle = '#8b5a2b'; ctx.fillRect(t.x, t.y, t.w, t.h);
            ctx.fillStyle = '#39a845'; ctx.fillRect(t.x, t.y, t.w, t.h * 0.25);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(t.x + 4, t.y + t.h * 0.25 + 4); ctx.lineTo(t.x + t.w - 4, t.y + t.h * 0.25 + 4); ctx.stroke();
        } else if (t.type === 'qblock') {
            ctx.fillStyle = '#ffd54f'; ctx.fillRect(t.x, t.y, t.w, t.h);
            ctx.fillStyle = '#e0a800'; ctx.fillRect(t.x + 6, t.y + 6, t.w - 12, t.h - 12);
            ctx.fillStyle = '#5a3b00'; ctx.font = (t.w * 0.5) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('?', t.x + t.w / 2, t.y + t.h / 2 + 2);
        }
    }

    // coins
    for (const c of coins) {
        if (c.collected) continue;
        ctx.save();
        ctx.beginPath(); ctx.fillStyle = 'rgba(255,215,0,0.18)'; ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w * 0.9, c.h * 0.9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w * 0.6, c.h * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    // enemies
    for (const e of enemies) {
        if (!e.alive) continue;
        // draw varied shapes
        ctx.save();
        if (e.kind === 'walker') {
            // rectangle with feet
            ctx.fillStyle = e.color; ctx.fillRect(e.x, e.y, e.w, e.h);
            ctx.fillStyle = '#00000022'; ctx.fillRect(e.x + 4, e.y + e.h - 8, e.w - 8, 6);
        } else if (e.kind === 'big') {
            // rounded big enemy
            ctx.fillStyle = e.color; ctx.beginPath(); roundRect(ctx, e.x, e.y, e.w, e.h, 8); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillRect(e.x + e.w * 0.18, e.y + e.h * 0.18, e.w * 0.18, e.h * 0.16); ctx.fillRect(e.x + e.w * 0.6, e.y + e.h * 0.18, e.w * 0.18, e.h * 0.16);
        } else if (e.kind === 'flyer') {
            // circular with wing-like ellipse
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(e.x + e.w * 0.55, e.y + e.h * 0.35, e.w * 0.12, e.h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        } else if (e.kind === 'jumper') {
            // triangular playful enemy
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.moveTo(e.x + e.w / 2, e.y); ctx.lineTo(e.x + e.w, e.y + e.h); ctx.lineTo(e.x, e.y + e.h); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    // flag
    if (flag) {
        ctx.fillStyle = '#7b3eb3'; ctx.fillRect(flag.x, flag.y, 6, flag.h);
        ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.moveTo(flag.x + 6, flag.y + 6); ctx.lineTo(flag.x + 6 + 36, flag.y + flag.h * 0.18 + 6); ctx.lineTo(flag.x + 6, flag.y + flag.h * 0.36 + 6); ctx.closePath(); ctx.fill();
    }

    // player draw with simple lively animation (bobbing when idle & tilt when moving)
    if (player.alive) {
        ctx.save();
        ctx.translate(player.x, player.y);
        // tilt effect by velocity
        const tilt = Math.max(-0.2, Math.min(0.2, player.vx / player.maxSpeed * 0.18));
        ctx.translate(player.w / 2, player.h / 2);
        ctx.rotate(tilt);
        ctx.translate(-player.w / 2, -player.h / 2);
        // body
        ctx.fillStyle = '#ff3b3b';
        roundRect(ctx, 0, 0, player.w, player.h, 6);
        // eyes
        ctx.fillStyle = '#fff'; ctx.fillRect(player.w * 0.12, player.h * 0.18, player.w * 0.12, player.h * 0.12); ctx.fillRect(player.w * 0.5, player.h * 0.18, player.w * 0.12, player.h * 0.12);
        ctx.restore();
    } else {
        ctx.fillStyle = 'rgba(200,0,0,0.5)';
        ctx.fillRect(player.x, player.y, player.w, player.h);
    }

    ctx.restore();
}

// utility: rounded rect
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// main loop
let nowPrev = performance.now() / 1000;
let acc = 0;
function frame(t) {
    const now = t / 1000;
    let dt = now - nowPrev;
    nowPrev = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
    }
    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawParallax();
    drawWorld();
    // update enemies count display
    enemiesCountEl.textContent = 'Enemies: ' + enemies.filter(e => e.alive).length;
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// initial updateHUD
updateHUD();

// --- Helper: when level changes regenerate --- //
function regenerateLevel() {
    levelMap = generateLevelData(currentLevel);
    layoutFromMap(levelMap);
    player.x = TILE * 2;
    player.y = (levelRows - 6) * TILE;
    player.vx = player.vy = 0;
    player.alive = true;
    camera.x = 0;
    camera.y = 0;
    updateHUD();
}
function nextLevel() {
    currentLevel++;
    if (currentLevel > MAX_LEVEL) {
        alert('completed 20 levels ' + score);
        currentLevel = 1;
        score = 0; lives = 3;
    }
    regenerateLevel();
}
function regenerateLevel() { regenerateLevel ? regenerateLevel() : null; } // placeholder to satisfy linter (we call above regenerateLevel actual func)
// Note: actual regenerate used earlier - keep it consistent by calling prior functions

// fix: define regenerateLevel actual once (rename to avoid confusion)
function regenerateLevel() {
    levelCols = colsForLevel(currentLevel);
    const map = generateLevelData(currentLevel);
    levelMap = map;
    layoutFromMap(map);
    player.x = TILE * 2;
    player.y = (levelRows - 6) * TILE;
    player.vx = player.vy = 0;
    player.alive = true;
    camera.x = 0; camera.y = 0;
    updateHUD();
}

// ensure regenerate called initially
regenerateLevel();

// end of file
