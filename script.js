const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// UI Interfacing Elements
const startScreen = document.getElementById("start-screen");
const gameOverScreen = document.getElementById("game-over-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const scoreEl = document.getElementById("score");
const speedEl = document.getElementById("speed");
const finalScoreEl = document.getElementById("final-score");

// Engine Configurations
let gameRunning = false;
let score = 0;
let speed = 0;
const maxSpeed = 140;
const roadSpeedModifier = 0.09;

let player;
let traffic = [];
let roadLines = [];
let backdropGridY = 0;

const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false };

// --- WEB AUDIO API SYSTEM ---
let audioCtx = null;
let engineOsc = null;
let engineGain = null;
let musicInterval = null;
let musicStep = 0;

function initAudio() {
    if (audioCtx) return; 
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    setupEngineSound();
    startRetroMusic();
}

function setupEngineSound() {
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.setValueAtTime(40, audioCtx.currentTime); 
    engineGain.gain.setValueAtTime(0.0, audioCtx.currentTime); 
    
    let filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, audioCtx.currentTime);

    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
}

function updateEngineAudio() {
    if (!gameRunning || !engineOsc) return;
    let targetFreq = 40 + (speed * 1.2); 
    engineOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
    let targetGain = keys.ArrowUp ? 0.22 : 0.12;
    if (speed === 0) targetGain = 0.05;
    engineGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.1);
}

function playCrashSound() {
    if (!audioCtx) return;
    
    let bufferSize = audioCtx.sampleRate * 0.4; 
    let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    let data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    let noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    let noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(400, audioCtx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.4);

    let noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseNode.start();
}

function startRetroMusic() {
    const notes = [55, 55, 65.41, 65.41, 48.99, 48.99, 58.27, 65.41]; 
    
    musicInterval = setInterval(() => {
        if (!gameRunning) return;
        
        let osc = audioCtx.createOscillator();
        let synthGain = audioCtx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[musicStep % notes.length], audioCtx.currentTime);
        
        synthGain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        synthGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        
        osc.connect(synthGain);
        synthGain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
        
        musicStep++;
    }, 250); 
}

// --- CAR CLASS ---
class Car {
    constructor(x, y, color, isPlayer = false) {
        this.x = x; this.y = y;
        this.width = 42; this.height = 74;
        this.color = color; this.isPlayer = isPlayer;
        this.steerVelocity = 5;
    }

    draw() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(this.x - 4, this.y + 6, this.width + 8, this.height);

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = "#111";
        ctx.fillRect(this.x + 8, this.y + 2, 4, 12);
        ctx.fillRect(this.x + this.width - 12, this.y + 2, 4, 12);

        ctx.fillStyle = "#111b24";
        ctx.fillRect(this.x + 4, this.y + 18, this.width - 8, 15); 
        ctx.fillStyle = "#00f0ff"; 
        ctx.fillRect(this.x + 6, this.y + 19, this.width - 12, 2);

        ctx.fillStyle = "#111b24";
        ctx.fillRect(this.x + 6, this.y + 48, this.width - 12, 10);

        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(this.x - 4, this.y + 10, 4, 15);
        ctx.fillRect(this.x + this.width, this.y + 10, 4, 15);
        ctx.fillRect(this.x - 4, this.y + 50, 4, 15);
        ctx.fillRect(this.x + this.width, this.y + 50, 4, 15);

        if (this.isPlayer) {
            ctx.fillStyle = keys.ArrowUp ? "#ff0055" : "#aa0033";
            ctx.shadowColor = "#ff0055";
            ctx.shadowBlur = keys.ArrowUp ? 12 : 4;
            ctx.fillRect(this.x + 2, this.y + this.height - 4, 8, 4);
            ctx.fillRect(this.x + this.width - 10, this.y + this.height - 4, 8, 4);
        } else {
            ctx.fillStyle = "#ffffaa";
            ctx.shadowColor = "#ffffaa";
            ctx.shadowBlur = 10;
            ctx.fillRect(this.x + 3, this.y, 8, 3);
            ctx.fillRect(this.x + this.width - 11, this.y, 8, 3);
        }
        ctx.shadowBlur = 0; 
    }

    move() {
        if (!this.isPlayer) return;
        if (keys.ArrowLeft && this.x > 55) this.x -= this.steerVelocity;
        if (keys.ArrowRight && this.x < canvas.width - 55 - this.width) this.x += this.steerVelocity;

        if (keys.ArrowUp) {
            if (speed < maxSpeed) speed += 1.4;
        } else {
            if (speed > 0) speed -= 2.0;
        }
        if (speed < 0) speed = 0;
    }
}

function initEnvironment() {
    roadLines = [];
    for (let i = -100; i < canvas.height; i += 100) {
        roadLines.push({ y: i });
    }
    
    // Spawn 3 initial traffic cars ahead of time at different heights
    const horizontalLanes = [80, 180, 280];
    const designPalettes = ["#ff007f", "#b600ff", "#ffb700", "#ff3333"];
    traffic = [
        new Car(horizontalLanes[0] - 21, -100, designPalettes[0]),
        new Car(horizontalLanes[1] - 21, -300, designPalettes[1]),
        new Car(horizontalLanes[2] - 21, -500, designPalettes[2])
    ];
}

// Relocates an old car to the top instead of destroying it
function recycleCar(tCar) {
    const horizontalLanes = [80, 180, 280];
    let randomLane = horizontalLanes[Math.floor(Math.random() * horizontalLanes.length)];
    
    tCar.x = randomLane - 21;
    tCar.y = -150; // Place it back up above the screen view
    
    const designPalettes = ["#ff007f", "#b600ff", "#ffb700", "#ff3333"];
    tCar.color = designPalettes[Math.floor(Math.random() * designPalettes.length)];
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// --- MAIN ENGINE LOOP ---
function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let movementVelocity = speed * roadSpeedModifier;

    // 1. Draw Background Space Terrain
    ctx.fillStyle = "#090412"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#23133d";
    ctx.lineWidth = 2;
    for (let yOffset = backdropGridY - 40; yOffset < canvas.height; yOffset += 40) {
        ctx.beginPath();
        ctx.moveTo(0, yOffset); ctx.lineTo(50, yOffset);
        ctx.moveTo(canvas.width - 50, yOffset); ctx.lineTo(canvas.width, yOffset);
        ctx.stroke();
    }

    // 2. Highway Infrastructure Mapping
    ctx.fillStyle = "#1f1430"; 
    ctx.fillRect(45, 0, 5, canvas.height);
    ctx.fillRect(canvas.width - 50, 0, 5, canvas.height);

    ctx.fillStyle = "#110b1a"; 
    ctx.fillRect(50, 0, canvas.width - 100, canvas.height);

    // 3. Middle Passing Separation Lines
    ctx.fillStyle = "rgba(0, 240, 255, 0.6)"; 
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 6;
    roadLines.forEach(line => {
        ctx.fillRect(160, line.y, 4, 50);
        ctx.fillRect(240, line.y, 4, 50);
    });
    ctx.shadowBlur = 0;

    // 4. Render All Active Cars
    player.draw();
    traffic.forEach(tCar => tCar.draw());

    // --- GAMEPLAY VELOCITY MODIFIERS (ONLY RUN IF ALIVE) ---
    if (gameRunning) {
        backdropGridY += movementVelocity;
        if (backdropGridY > 40) backdropGridY = 0;

        roadLines.forEach(line => {
            line.y += movementVelocity;
            if (line.y > canvas.height) line.y = -100;
        });

        player.move();

        for (let i = 0; i < traffic.length; i++) {
            let tCar = traffic[i];
            tCar.y += movementVelocity - 3; 

            // Collision check
            if (checkCollision(player, tCar)) {
                endGame();
                return; 
            }

            // CRITICAL FIX: Loop/recycle car to the top instead of removing it!
            if (tCar.y > canvas.height) {
                recycleCar(tCar);
            }
        }

        updateEngineAudio();
        
        if (speed > 0) score += Math.floor(speed / 25);
        
        scoreEl.innerText = String(score).padStart(5, '0');
        speedEl.innerText = Math.floor(speed);

        requestAnimationFrame(update);
    }
}

function startGame() {
    initAudio(); 
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");

    player = new Car(179, 460, "#00f0ff", true); 
    score = 0;
    speed = 0;
    initEnvironment();

    gameRunning = true;
    requestAnimationFrame(update);
}

function endGame() {
    gameRunning = false;
    if (engineGain) engineGain.gain.setValueAtTime(0, audioCtx.currentTime); 
    playCrashSound();
    
    finalScoreEl.innerText = score;
    gameOverScreen.classList.remove("hidden");

    // Re-render one last static snapshot showing the vehicles locked on collision frame
    update();
}

// Input Controllers
window.addEventListener("keydown", e => { if (e.key in keys) keys[e.key] = true; });
window.addEventListener("keyup", e => { if (e.key in keys) keys[e.key] = false; });

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);