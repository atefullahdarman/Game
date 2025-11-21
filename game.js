

(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('overlay');
    const menu = document.getElementById('menu');
    const pausePanel = document.getElementById('pausePanel');
    const gameOverPanel = document.getElementById('gameOver');
    const startBtn = document.getElementById('startBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const restartBtn = document.getElementById('restartBtn');
    const goMenuBtn = document.getElementById('goMenuBtn');
    const tryAgainBtn = document.getElementById('tryAgainBtn');
    const scoreEl = document.getElementById('score');
    const missesEl = document.getElementById('misses');
    const levelEl = document.getElementById('level');
    const bestEl = document.getElementById('best');
    const menuBest = document.getElementById('menuBest');
    const menuLevel = document.getElementById('menuLevel');
    const finalScore = document.getElementById('finalScore');
    const finalBest = document.getElementById('finalBest');
    // Mobile controls
    const mobileControls = document.getElementById('mobile-controls');
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const fireBtn = document.getElementById('fireBtn');
    // Canvas resize helper (keeps internal resolution stable)
    function fitCanvas() {
        const wrap = canvas.parentElement;
        const rect = wrap.getBoundingClientRect();
        // maintain aspect ratio 3:2
        const targetW = Math.max(320, Math.min(980, rect.width));
        const targetH = Math.round(targetW * 2 / 3);
        canvas.width = targetW;
        canvas.height = targetH;
    }
    fitCanvas();
    window.addEventListener('resize'
        , () => {
            fitCanvas();
            draw(); // redraw immediate
        });
    // Game state
    let running = false;
    let paused = false;
    let score = 0;
    let misses = 0;
    let level = 1;
    let best = parseInt(localStorage.getItem('plane_best') || '0', 10);
    // Player
    const player = {
        x: 0,
        y: 0,
        w: 64,
        h: 28,
        speed: 3
    };
    // Collections
    let bullets = [];
    let enemies = [];
    // Timers
    let lastTime = 0;
    let spawnTimer = 0;
    let spawnInterval = 1100; // ms
    let canShoot = true;
    const shootCooldown = 200;
    // Controls
    const keys = { left: false, right: false, space: false };
    let touchSide = null; // 'left'|'right' for mobile touch hold
    // init positions
    function resetEntities() {
        bullets = [];
        enemies = [];
        spawnTimer = 0;
        spawnInterval = 1100;
        player.x = canvas.width / 2;
        player.y = canvas.height - 70;
        
    }
    // UI init
    scoreEl.textContent = score;
    missesEl.textContent = misses;
    levelEl.textContent = level;
    bestEl.textContent = best;
    menuBest.textContent = best;
    menuLevel.textContent = level;
    // Start game
    function startGame() {
        running = true;
        paused = false;
        score = 0;
        misses = 0;
        level = 1;
        resetEntities();
        updateHUD();
        showOverlay(null);
        lastTime = performance.now();
        requestAnimationFrame(loop);
    }
    function updateHUD() {
        scoreEl.textContent = score;
        missesEl.textContent = misses;
        levelEl.textContent = level;
        bestEl.textContent = best;
        menuBest.textContent = best;
        menuLevel.textContent = level;
    }
    // Pause / Resume
    function pauseGame() {
        paused = true;
        showOverlay('pause');
    }
    function resumeGame() {
        paused = false;
        showOverlay(null);
        lastTime = performance.now();
        requestAnimationFrame(loop);
    }
    // Game Over
    function endGame() {
        running = false;
        // update best
        if (score > best) {
            best = score;
            localStorage.setItem('plane_best'
                , String(best));
        }
        finalScore.textContent = score;
        finalBest.textContent = best;
        showOverlay('gameover');
    }
    // Overlay helper: null | 'menu' | 'pause' | 'gameover'
    function showOverlay(panel) {
        document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden'));
        overlay.style.pointerEvents = panel ? 'auto' : 'none';
        if (!panel) {
            // hide all
            overlay.classList.remove('visible');
            return;
        }
        overlay.classList.add('visible');
        if (panel ===
            'menu') menu.classList.remove('hidden');
        if (panel ===
            'pause') pausePanel.classList.remove('hidden');
        if (panel ===
            'gameover') gameOverPanel.classList.remove('hidden');
    }
    // Entities factory
    function spawnEnemy() {
        const size = 48 + Math.random() * 32;
        const x = Math.random() * (canvas.width - size - 20) + 10;
        const speed = 0.6 + Math.random() * (0.9 + level * 0.12); // faster with level
        const hp = 1;
        enemies.push({ x, y: -size, w: size, h: size, speed, hp });
    }
    function shoot() {
        if (!running || paused) return;
        if (!canShoot) return;
        canShoot = false;
        bullets.push({ x: player.x, y: player.y - 18, r: 6, speed: 9 });
        setTimeout(() => canShoot = true, shootCooldown);
    }
    // Collision AABB
    function rectColl(a, b) {
        return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
    }
    // Update loop
    function update(dt) {
        // player movement by keys or touch
        if (keys.left) player.x -= player.speed;
        if (keys.right) player.x += player.speed;
        if (touchSide ===
            'left') player.x -= player.speed;
        if (touchSide ===
            'right') player.x += player.speed;
        // clamp player
        const margin = 20;
        if (player.x < margin) player.x = margin;
        if (player.x > canvas.width - margin) player.x = canvas.width - margin;
        // bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.y -= b.speed;
            if (b.y < -10) bullets.splice(i, 1);
        }
        // enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.y += e.speed * dt * 0.06;
            if (e.y > canvas.height + 30) {
                enemies.splice(i, 1);
                misses += 1;
                if (misses >= 3) endGame();
            }
        }
        // bullet-enemy collisions
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            for (let j = bullets.length - 1; j >= 0; j--) {
                const b = bullets[j];
                const bRect = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
                const eRect = { x: e.x, y: e.y, w: e.w, h: e.h };
                if (rectColl(bRect, eRect)) {
                    bullets.splice(j, 1);
                    e.hp -= 1;
                    if (e.hp <= 0) {
                        enemies.splice(i, 1);
                        score += 1;
                        // level up every 8 points
                        if (score % 8 === 0) {
                            level += 1;
                            spawnInterval = Math.max(480, spawnInterval * 0.9);
                        }
                        if (score > best) {
                            best = score;
                            localStorage.setItem('plane_best'
                                , String(best));
                        }
                    }
                    break;
                }
            }
        }
        // update HUD
        scoreEl.textContent = score;
        missesEl.textContent = misses;
        levelEl.textContent = level;
        bestEl.textContent = best;
        menuBest.textContent = best;
        menuLevel.textContent = level;
    }
    // Drawing helpers
    function clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    function drawBackground() {
        // subtle stars + gradient
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0,
            '#071226');
        g.addColorStop(1,
            '#0b2540');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // moving grid for depth
        ctx.globalAlpha = 0.04;
        ctx.fillStyle =
            '#ffffff';
        const cols = 20;
        const rows = 12;
        for (let i = 0; i < cols; i++) {
            const x = i * (canvas.width / cols);
            ctx.fillRect(x, 0, 1, canvas.height);
        }
        for (let j = 0; j < rows; j++) {
            const y = j * (canvas.height / rows);
            ctx.fillRect(0, y, canvas.width, 1);
        }
        ctx.globalAlpha = 1;
    }
    function drawPlayer() {
        ctx.save();
        ctx.translate(player.x, player.y);
        // body
        ctx.fillStyle =
            '#fff';
        roundRect(ctx, -28, -10, 56, 20, 10, true);
        // cockpit
        ctx.fillStyle =
            '#60a5fa';
        roundRect(ctx, -6, -14, 14, 10, 6, true);
        // wings
        ctx.fillStyle =
            '#ff7aa2';
        ctx.beginPath();
        ctx.moveTo(-34, 8); ctx.lineTo(-12, 0); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(34, 8); ctx.lineTo(12, 0); ctx.lineTo(12, 10); ctx.closePath(); ctx.fill();
        // nose
        ctx.fillStyle =
            '#0b1220';
        ctx.beginPath(); ctx.moveTo(28, -6); ctx.lineTo(38, 0); ctx.lineTo(28, 6); ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    function drawBullet(b) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle =
            '#ffd166';
        ctx.fill();
    }
    function drawEnemy(e) {
        // color by hp
        const t = e.hp / 3;
        const r = Math.floor(255 * (1 - t));
        const g = Math.floor(60 + 140 * t);
        ctx.fillStyle = `rgb(${r},${g},80)`;
        roundRect(ctx, e.x, e.y, e.w, e.h, 8, true);
        // eyes
        ctx.fillStyle =
            '#111';
        ctx.fillRect(e.x + e.w * 0.18, e.y + e.h * 0.2, 6, 6);
        ctx.fillRect(e.x + e.w * 0.62, e.y + e.h * 0.2, 6, 6);
        // hp bar
        ctx.fillStyle =
            'rgba(255,255,255,0.14)';
        ctx.fillRect(e.x, e.y - 8, e.w, 6);
        ctx.fillStyle =
            '#22c55e';
        ctx.fillRect(e.x, e.y - 8, e.w * (e.hp / 3), 6);
    }
    function roundRect(ctx, x, y, w, h, r, fill) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        if (fill) ctx.fill();
        else ctx.stroke();
    }
    function draw() {
        clear();
        drawBackground();
        // draw enemies
        enemies.forEach(e => drawEnemy(e));
        // draw bullets
        bullets.forEach(b => drawBullet(b));
        // draw player
        drawPlayer();
        // HUD on canvas (small)
        ctx.fillStyle =
            'rgba(255,255,255,0.04)';
        ctx.fillRect(8, 8, 180, 62);
        ctx.fillStyle =
            '#fff';
        ctx.font =
            '16px system-ui';
        ctx.fillText('Score: ' + score, 16, 30);
        ctx.fillText('Misses: ' + misses, 16, 52);
    }
    // Main loop
    function loop(ts) {
        if (!running || paused) {
            lastTime = ts;
            return;
        }
        if (!lastTime) lastTime = ts;
        const dt = ts - lastTime;
        lastTime = ts;
        // spawn logic
        spawnTimer += dt;
        if (spawnTimer > spawnInterval) {
            spawnTimer = 0;
            spawnEnemy();
            if (spawnInterval > 500) spawnInterval *= 0.985;
        }
        update(dt);
        draw();
        requestAnimationFrame(loop);
    }
    // Input handlers
    window.addEventListener('keydown'
        , (e) => {
            if (e.key ===
                'ArrowLeft') keys.left = true;
            if (e.key ===
                'ArrowRight') keys.right = true;
            if (e.code ===
                'Space') { keys.space = true; shoot(); e.preventDefault(); }
            if (e.key ===
                'p') { if (running) paused ? resumeGame() : pauseGame(); }
        });
    window.addEventListener('keyup'
        , (e) => {
            if (e.key ===
                'ArrowLeft') keys.left = false;
            if (e.key ===
                'ArrowRight') keys.right = false;
            if (e.code ===
                'Space') keys.space = false;
        });
    // Mouse move -> player follow (desktop)
    canvas.addEventListener('mousemove'
        , (ev) => {
            const rect = canvas.getBoundingClientRect();
            const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
            player.x = x;
        });
    // Touch controls (mobile)
    canvas.addEventListener('touchstart'
        , (ev) => {
            ev.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = (ev.touches[0].clientX - rect.left) * (canvas.width / rect.width);
            // determine left/right half
            if (x < canvas.width / 2) {
                touchSide =
                    'left';
            } else {
                touchSide =
                    'right';
            }
            // quick tap near center => shoot
            const cx = canvas.width / 2;
            if (Math.abs(x - cx) < 60) shoot();
        }, { passive: false });
    canvas.addEventListener('touchend'
        , (ev) => {
            touchSide = null;
        });
    // Virtual buttons (redundant but direct)
    leftBtn?.addEventListener('touchstart'
        , (e) => {
            e.preventDefault(); touchSide =
                'left';
        });
    leftBtn?.addEventListener('touchend'
        , (e) => { e.preventDefault(); touchSide = null; });
    rightBtn?.addEventListener('touchstart'
        , (e) => {
            e.preventDefault(); touchSide =
                'right';
        });
    rightBtn?.addEventListener('touchend'
        , (e) => { e.preventDefault(); touchSide = null; });
    fireBtn?.addEventListener('touchstart'
        , (e) => { e.preventDefault(); shoot(); });
    // Buttons actions
    startBtn.addEventListener('click'
        , () => startGame());
    resumeBtn.addEventListener('click'
        , () => resumeGame());
    restartBtn.addEventListener('click'
        , () => { startGame(); });
    tryAgainBtn.addEventListener('click'
        , () => { startGame(); });
    goMenuBtn.addEventListener('click'
        , () => { showOverlay('menu'); });
    goMenuBtn.addEventListener('cleck', () => { alert('update seting'); });
    player.x = canvas.width / 2;
    player.y = canvas.height - 60;
    // show main menu initially
    showOverlay('menu');
})();