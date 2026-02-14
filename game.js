// game.js
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// --------------------
// Game size (logic units)
// --------------------
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// These get computed in resizeCanvas()
let SCALE = 1;
let OFFSET_X = 0;
let OFFSET_Y = 0;
let DPR = 1;

function resizeCanvas() {
  DPR = window.devicePixelRatio || 1;

  // IMPORTANT: CSS size (what you SEE)
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";

  // IMPORTANT: internal pixel buffer (what you RENDER)
  canvas.width = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);

  // Keep aspect ratio (no stretching)
  SCALE = Math.min(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);
  OFFSET_X = (canvas.width - GAME_WIDTH * SCALE) / 2;
  OFFSET_Y = (canvas.height - GAME_HEIGHT * SCALE) / 2;

  // All drawing uses GAME coords, but scaled into the canvas pixels
  ctx.setTransform(SCALE, 0, 0, SCALE, OFFSET_X, OFFSET_Y);
  ctx.imageSmoothingEnabled = false; // pixel art vibes
}


window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --------------------
// Player
// --------------------
const player = {
    x: 120,
    y: 420,
    speed: 6,
    targetX: 120,
    targetY: 420,
    targetId: null,
    targetType: null, // "pickup" | "npc" | "ui" | null

    w: 48,
    h: 64,
};

// --------------------
// Gate / Win
// --------------------
let gateUnlocked = false;  // becomes true after 5 flowers
let gateOpen = false;      // becomes true after "Please read me" flow
let gameWon = false;

const gate = { x: 740, y: 250, w: 40, h: 120 };
const finalZone = { x: 760, y: 200, w: 40, h: 200 };

// --------------------
// Score stuff
// --------------------
let flowers = 0;
const MAX_FLOWERS = 5;

let pets = 0;         // bonus points (petting dogs)
const MAX_PETS = 2;   // 2 dogs

// --------------------
// UI / Modal state
// --------------------
// "play" -> normal game
// "readme" -> shows "Please read me" + Open button
// "question" -> "Will you be my valentine?" + 3 buttons
// "nope" -> stubborn message + yes buttons
// "letter" -> love note (press Enter to close)
let uiState = "play";

const ui = {
    // Top bar reset button (in GAME coords)
    resetBtn: { x: 650, y: 10, w: 140, h: 38 },

    // Envelope trigger near gate (only when unlocked)
    envelope: { x: 705, y: 210, w: 36, h: 28 },

    // Modal buttons are computed each draw (but we store last rects for hit tests)
    buttons: [], // { id, x,y,w,h,label, onClick }
};

// Love note text (replace with YOUR exact note anytime)
const LOVE_NOTE = [
    "Hey love 💖",
    "",
    "I just want you to know I appreciate you so much.",
    "Thank you for everything you do, the way you show up,",
    "and the way you make my life better just by being you.",
    "",
    "I love you. Always.",
    "",
    "— Your Valentine :)",
].join("\n");

// --------------------
// Load images
// --------------------
const bgImg = new Image();
bgImg.src = "assets/background.png";

const playerImg = new Image();
playerImg.src = "assets/player.png";

// dogs
const npcImg = new Image();
npcImg.src = "assets/npc.png";

const sinbadImg = new Image();
sinbadImg.src = "assets/sinbad.png";

// decor
const bush1Img = new Image();
bush1Img.src = "assets/bush1.png";

const bush2Img = new Image();
bush2Img.src = "assets/bush2.png";

// pickups + particles
const flowerImg = new Image();
flowerImg.src = "assets/flower.png";

// --------------------
// Pickups (DO NOT CHANGE POSITIONS)
// --------------------
const pickups = [
    { id: "f1", x: 120, y: 140, w: 40, h: 40, img: flowerImg, collected: false, message: "You picked a flower 🌸" },
    { id: "f2", x: 320, y: 220, w: 40, h: 40, img: flowerImg, collected: false, message: "Another one 🌸" },
    { id: "f3", x: 640, y: 180, w: 40, h: 40, img: flowerImg, collected: false, message: "So pretty 🌸" },
    { id: "f4", x: 240, y: 420, w: 40, h: 40, img: flowerImg, collected: false, message: "Flower collected 🌸" },
    { id: "f5", x: 520, y: 380, w: 40, h: 40, img: flowerImg, collected: false, message: "Last one! 🌸" },
];

// --------------------
// Interactables (ONLY 2 gate dogs)
// --------------------
const interactables = [
    // Friendly dog (left side of gate)
    {
        id: "guardLeft",
        x: gate.x - 70,
        y: gate.y + 90,
        w: 56,
        h: 56,
        img: npcImg,
        get message() {
            this._talkIndex = (this._talkIndex ?? 0);

            const lines = [
                "woof woof wooooffff 🐶",
                "hi mom 🐾",
                "i love you 💖"
            ];

            const msg = lines[this._talkIndex % lines.length];
            this._talkIndex++;
            return msg;
        },
    },

    // Sinbad (right side of gate)
    {
        id: "guardRight",
        x: gate.x - 10,
        y: gate.y - 10,
        w: 30,
        h: 30,
        img: sinbadImg,
        get message() {
            this._talkIndex = (this._talkIndex ?? 0);

            const lines = [
                "bow wow bow wow 🐕",
                "hi shirley",
                "dont touch my butt..."
            ];

            const msg = lines[this._talkIndex % lines.length];
            this._talkIndex++;
            return msg;
        },

        pettable: true,
    },
];

// --------------------
// Decor (greenery)
// --------------------
const decor = [
    // ground bushes (left → right)
    { x: 60, y: 510, w: 220, h: 80, img: bush2Img },
    { x: 260, y: 510, w: 220, h: 80, img: bush2Img },
    { x: 480, y: 510, w: 220, h: 80, img: bush2Img },

    // extra greenery
    { x: -10, y: 530, w: 100, h: 60, img: bush1Img },
    { x: 700, y: 530, w: 100, h: 60, img: bush1Img },
];

// --------------------
// Falling flower particles (background vibe)
// --------------------
const petals = [];
const PETAL_COUNT = 18;

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function spawnPetal(initial = false) {
    const size = rand(14, 26);
    petals.push({
        x: rand(0, GAME_WIDTH),
        y: initial ? rand(0, GAME_HEIGHT) : -size - rand(0, 120),
        vy: rand(0.35, 1.1),
        vx: rand(-0.25, 0.25),
        size,
        drift: rand(0.002, 0.01),
        t: rand(0, Math.PI * 2),
    });
}

for (let i = 0; i < PETAL_COUNT; i++) spawnPetal(true);

function updatePetals() {
    for (const p of petals) {
        p.t += p.drift;
        p.x += p.vx + Math.sin(p.t) * 0.2;
        p.y += p.vy;

        if (p.y > GAME_HEIGHT + p.size + 40) {
            p.x = rand(0, GAME_WIDTH);
            p.y = -p.size - rand(0, 120);
        }
        if (p.x < -40) p.x = GAME_WIDTH + 40;
        if (p.x > GAME_WIDTH + 40) p.x = -40;
    }
}

// --------------------
// Helpers
// --------------------
function updateEnvelopePos() {
  // big enough hitbox + centered
  ui.envelope.w = 60;
  ui.envelope.h = 60;
  ui.envelope.x = (GAME_WIDTH / 2) - (ui.envelope.w / 2);
  ui.envelope.y = (GAME_HEIGHT / 2) - (ui.envelope.h / 2);
}

function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function pointInRectRaw(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Convert mouse/touch position into GAME coords (accounts for scale + offset + DPR)
function getWorldPosFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();

    // Convert to canvas pixel coords
    const cx = (clientX - rect.left) * DPR;
    const cy = (clientY - rect.top) * DPR;

    // Undo the transform
    const x = (cx - OFFSET_X) / SCALE;
    const y = (cy - OFFSET_Y) / SCALE;

    return { x, y };
}

// --------------------
// Tap targeting
// --------------------
function getTappedObject(x, y) {
    // UI reset button always available
    if (pointInRectRaw(x, y, ui.resetBtn.x, ui.resetBtn.y, ui.resetBtn.w, ui.resetBtn.h)) {
        return { type: "ui", id: "reset" };
    }

    // If a modal is open, only buttons are clickable
    if (uiState !== "play") {
        for (let i = ui.buttons.length - 1; i >= 0; i--) {
            const b = ui.buttons[i];
            if (pointInRectRaw(x, y, b.x, b.y, b.w, b.h)) return { type: "ui", id: b.id };
        }
        return { type: "ui", id: "noop" };
    }

    // Envelope appears after unlock (lets her read even if she walks away)
  // Envelope appears after unlock (lets her read even if she walks away)
if (gateUnlocked && !gateOpen) {
  updateEnvelopePos();
  if (pointInRect(x, y, ui.envelope)) {
    return { type: "ui", id: "envelope" };
  }
}


    // flowers (pickups) first
    for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        if (!p.collected && pointInRectRaw(x, y, p.x, p.y, p.w, p.h)) return { type: "pickup", id: p.id };
    }

    // dogs (NPCs)
    for (let i = interactables.length - 1; i >= 0; i--) {
        const it = interactables[i];
        if (pointInRectRaw(x, y, it.x, it.y, it.w, it.h)) return { type: "npc", id: it.id };
    }

    // nothing
    return null;
}

function handleTap(x, y) {
    const tapped = getTappedObject(x, y);

    if (tapped?.type === "ui") {
        handleUiClick(tapped.id);
        return;
    }

    // if modal open, ignore walking
    if (uiState !== "play") return;

    // walk to object or point
    if (tapped) {
        const obj = findObjByTap(tapped);
        player.targetX = obj.cx;
        player.targetY = obj.cy;
        player.targetId = tapped.id;
        player.targetType = tapped.type;
    } else {
        player.targetX = x;
        player.targetY = y;
        player.targetId = null;
        player.targetType = null;
    }
}

function findObjByTap(tap) {
    if (tap.type === "pickup") {
        const p = pickups.find(o => o.id === tap.id);
        return { cx: p.x + p.w / 2, cy: p.y + p.h / 2 };
    }
    if (tap.type === "npc") {
        const it = interactables.find(o => o.id === tap.id);
        return { cx: it.x + it.w / 2, cy: it.y + it.h / 2 };
    }
    return { cx: player.x, cy: player.y };
}

// --------------------
// UI click handling
// --------------------
function handleUiClick(id) {
    if (id === "reset") {
        resetGame();
        return;
    }

    if (uiState === "play") {
        if (id === "envelope") {
            uiState = "question";
            return;
        }
        return;
    }

    // Modal buttons
    const btn = ui.buttons.find(b => b.id === id);
    if (btn && typeof btn.onClick === "function") btn.onClick();
}

function resetGame() {
    // player
    player.x = 120;
    player.y = 420;
    player.targetX = 120;
    player.targetY = 420;
    player.targetId = null;
    player.targetType = null;

    // flowers
    flowers = 0;
    for (const p of pickups) p.collected = false;

    // gate + win
    gateUnlocked = false;
    gateOpen = false;
    gameWon = false;

    // bonus
    pets = 0;

    // UI
    uiState = "play";
    ui.buttons = [];
}

// Enter key closes letter screen
window.addEventListener("keydown", (e) => {
    if (uiState === "letter" && e.key === "Enter") {
        uiState = "play";
    }
});

// --------------------
// Input listeners
// --------------------
canvas.addEventListener("mousedown", (e) => {
    const { x, y } = getWorldPosFromClient(e.clientX, e.clientY);
    handleTap(x, y);
});

canvas.addEventListener(
    "touchstart",
    (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const { x, y } = getWorldPosFromClient(t.clientX, t.clientY);
        handleTap(x, y);
    },
    { passive: false }
);

// --------------------
// Interaction trigger
// --------------------
const INTERACT_DISTANCE = 28;

function tryInteractIfClose() {
    if (!player.targetId || !player.targetType) return;

    // pickup (flower)
    if (player.targetType === "pickup") {
        const p = pickups.find(obj => obj.id === player.targetId);
        if (!p) { player.targetId = null; player.targetType = null; return; }

        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const dist = Math.hypot(player.x - cx, player.y - cy);

        if (dist <= INTERACT_DISTANCE) {
            if (!p.collected && flowers < MAX_FLOWERS) {
                flowers++;
                p.collected = true;

                // unlock gate after 5
                if (flowers >= MAX_FLOWERS) {
                    gateUnlocked = true;
                    // IMPORTANT: gateOpen stays false until she does the envelope flow
                }
            }
            player.targetId = null;
            player.targetType = null;
        }
        return;
    }

    // npc
    if (player.targetType === "npc") {
        const it = interactables.find(obj => obj.id === player.targetId);
        if (!it) { player.targetId = null; player.targetType = null; return; }

        const cx = it.x + it.w / 2;
        const cy = it.y + it.h / 2;
        const dist = Math.hypot(player.x - cx, player.y - cy);

        if (dist <= INTERACT_DISTANCE) {
            // pet bonus (only counts once per dog)
            if (it.pettable) {
                // count each dog only once
                if (!it._petted) {
                    it._petted = true;
                    pets = Math.min(MAX_PETS, pets + 1);
                }
            }

            // just show message in a modal-ish way? keeping it simple:
            // when playing, tapping dogs just does their vibe message in the bottom box
            // (but YOU asked popups separate from the taskbar, so we do a small toast instead)
            showToast(it.message);

            player.targetId = null;
            player.targetType = null;
        }
        return;
    }
}

// --------------------
// Small toast (separate from top bar)
// --------------------
let toast = { text: "", t: 0 };

function showToast(text) {
    toast.text = text;
    toast.t = 180; // frames
}

function updateToast() {
    if (toast.t > 0) toast.t--;
}

// --------------------
// Game loop
// --------------------
function update() {
    updatePetals();
    updateToast();

    if (uiState === "play") {
        // movement
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.hypot(dx, dy);

        if (dist > player.speed) {
            const nx = player.x + (dx / dist) * player.speed;
            const ny = player.y + (dy / dist) * player.speed;

            // gate collision:
            // - locked if NOT gateOpen (even after unlocked)
            if (!gateOpen && pointInRectRaw(nx, ny, gate.x, gate.y, gate.w, gate.h)) {
                player.targetX = player.x;
                player.targetY = player.y;
            } else {
                player.x = nx;
                player.y = ny;
            }
        }

        tryInteractIfClose();

        // win check (only after gateOpen)
        if (gateOpen && !gameWon && pointInRect(player.x, player.y, finalZone)) {
            gameWon = true;
            uiState = "letter"; // end on letter too
        }
    }

    draw();
    requestAnimationFrame(update);
}

// --------------------
// Drawing
// --------------------
function drawTopBar() {
    // keep reset anchored to the right edge of the GAME coords
    ui.resetBtn.x = GAME_WIDTH - ui.resetBtn.w - 10;

    ctx.textBaseline = "top";
    ctx.font = "22px Arial";

    // build strings
    let s = "Flowers: ";
    for (let i = 0; i < MAX_FLOWERS; i++) s += i < flowers ? "🌸" : "✿";

    let ptxt = "  Pets: ";
    for (let i = 0; i < MAX_PETS; i++) ptxt += i < pets ? "🐾" : "·";

    const full = s + ptxt;

    // measure and clamp width so it never goes off-screen
    const pad = 16;
    const textW = ctx.measureText(full).width;
    const barW = Math.min(textW + pad * 2, ui.resetBtn.x - 20);

    // background bar
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(10, 10, barW, 38);

    // text
    ctx.fillStyle = "white";
    ctx.fillText(full, 10 + pad, 16);

    // reset button
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(ui.resetBtn.x, ui.resetBtn.y, ui.resetBtn.w, ui.resetBtn.h);

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Reset", ui.resetBtn.x + 44, ui.resetBtn.y + 10);
}

function drawGate() {
    if (!gateOpen) {
        ctx.fillStyle = "#b56576";
        ctx.fillRect(gate.x, gate.y, gate.w, gate.h);

        ctx.fillStyle = "white";
        ctx.font = "14px Arial";

        if (!gateUnlocked) ctx.fillText("LOCKED", gate.x - 10, gate.y - 18);
        else ctx.fillText("UNLOCKED", gate.x - 18, gate.y - 18);
    } else {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = "14px Arial";
        ctx.fillText("OPEN!", gate.x - 5, gate.y - 18);
    }

  // Envelope appears once unlocked, until the gate is opened
if (gateUnlocked && !gateOpen) {
    // set a REAL clickable hitbox
    ui.envelope.w = 60;
    ui.envelope.h = 60;

    ui.envelope.x = (GAME_WIDTH / 2) - (ui.envelope.w / 2);
    ui.envelope.y = (GAME_HEIGHT / 2) - (ui.envelope.h / 2);

    // draw the envelope centered in the hitbox
    ctx.font = "34px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(
        "💌",
        ui.envelope.x + 12,
        ui.envelope.y + 42
    );
}

}

function drawToast() {
    if (toast.t <= 0) return;

    const alpha = Math.min(1, toast.t / 30);
    ctx.fillStyle = `rgba(0,0,0,${0.55 * alpha})`;
    ctx.fillRect(20, GAME_HEIGHT - 90, GAME_WIDTH - 40, 60);

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.font = "18px Arial";
    ctx.textBaseline = "top";
    wrapText(toast.text, 35, GAME_HEIGHT - 78, GAME_WIDTH - 70, 22);
}

function buildModalButtons(buttons) {
    ui.buttons = buttons;
}

function drawModalBox(title, bodyLines) {
    const box = { x: 60, y: 300, w: 680, h: 240 };

    ctx.fillStyle = "rgba(0,0,0,0.60)";
    ctx.fillRect(box.x, box.y, box.w, box.h);

    ctx.fillStyle = "white";
    ctx.font = "26px Arial";
    ctx.fillText(title, box.x + 24, box.y + 20);

    ctx.font = "18px Arial";
    let y = box.y + 60;
    for (const line of bodyLines) {
        ctx.fillText(line, box.x + 24, y);
        y += 26;
    }

    return box;
}

function drawButton(b) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#2a2a2a";
    ctx.font = "18px Arial";
    ctx.fillText(b.label, b.x + 14, b.y + 10);
}

function drawModal() {
    ui.buttons = [];

    if (uiState === "readme") {
        const box = drawModalBox("please open the letter bae! 💌", [
            "Okay so… I unlocked the gate for you.",
            "But you gotta answer one thing first :)",
        ]);

        const btn = {
            id: "openQuestion",
            x: box.x + 24,
            y: box.y + box.h - 60,
            w: 240,
            h: 40,
            label: "Open",
            onClick: () => { uiState = "question"; },
        };

        buildModalButtons([btn]);
        drawButton(btn);
        return;
    }

    if (uiState === "question") {
        const box = drawModalBox("Will you be my Valentine?", [
            "Pick one. No pressure…",
            "(jk there is pressure 😭)",
        ]);

        const b1 = {
            id: "yesAbs",
            x: box.x + 24,
            y: box.y + box.h - 120,
            w: 320,
            h: 40,
            label: "Absolutely yes 💖",
            onClick: () => {
                gateOpen = true;
                uiState = "letter";
            },
        };

        const b2 = {
            id: "yesSquish",
            x: box.x + 24,
            y: box.y + box.h - 70,
            w: 320,
            h: 40,
            label: "Yes and we can squish 🫶",
            onClick: () => {
                gateOpen = true;
                uiState = "letter";
            },
        };

        const b3 = {
            id: "no",
            x: box.x + 370,
            y: box.y + box.h - 70,
            w: 140,
            h: 40,
            label: "No",
            onClick: () => { uiState = "nope"; },
        };

        buildModalButtons([b1, b2, b3]);
        drawButton(b1);
        drawButton(b2);
        drawButton(b3);
        return;
    }

    if (uiState === "nope") {
        const box = drawModalBox("…Bruh 😐", [
            "I know you’re stubborn.",
            "Just click yes duh!",
        ]);

        const b1 = {
            id: "yesAbs2",
            x: box.x + 24,
            y: box.y + box.h - 110,
            w: 320,
            h: 40,
            label: "Absolutely yes 💖",
            onClick: () => {
                gateOpen = true;
                uiState = "letter";
            },
        };

        const b2 = {
            id: "yesSquish2",
            x: box.x + 24,
            y: box.y + box.h - 60,
            w: 320,
            h: 40,
            label: "Yes and we can squish 🫶",
            onClick: () => {
                gateOpen = true;
                uiState = "letter";
            },
        };

        buildModalButtons([b1, b2]);
        drawButton(b1);
        drawButton(b2);
        return;
    }

    if (uiState === "letter") {
        const box = { x: 60, y: 260, w: 680, h: 300 };

        ctx.fillStyle = "rgba(0,0,0,0.60)";
        ctx.fillRect(box.x, box.y, box.w, box.h);

        ctx.fillStyle = "white";
        ctx.font = "26px Arial";
        ctx.fillText("Congrats 💖", box.x + 24, box.y + 20);

        // ENTER hint moved to the side (no overlap)
        ctx.font = "16px Arial";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Press ENTER", box.x + box.w - 140, box.y + 22);
        ctx.fillText("to close", box.x + box.w - 140, box.y + 42);

        ctx.fillStyle = "white";
        ctx.font = "18px Arial";
        ctx.fillText("Congratulations, you’re my Valentine", box.x + 24, box.y + 70);
        ctx.fillText("for the 4th year in a row :)", box.x + 24, box.y + 96);

        const note = { x: box.x + 24, y: box.y + 130, w: box.w - 48, h: 150 };

        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(note.x, note.y, note.w, note.h);

        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        wrapText(LOVE_NOTE, note.x + 12, note.y + 10, note.w - 24, 20);

        return;
    }
}

function draw() {
    // Background
    if (bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
        ctx.fillStyle = "#8fc77a";
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Falling flowers behind everything
    for (const p of petals) {
        if (flowerImg.complete && flowerImg.naturalWidth > 0) {
            ctx.globalAlpha = 0.55;
            ctx.drawImage(flowerImg, p.x, p.y, p.size, p.size);
            ctx.globalAlpha = 1;
        }
    }

    // Decor
    for (const d of decor) {
        if (d.img.complete && d.img.naturalWidth > 0) {
            ctx.drawImage(d.img, d.x, d.y, d.w, d.h);
        }
    }

    // Gate
    drawGate();

    // NPCs
    for (const it of interactables) {
        if (it.img.complete && it.img.naturalWidth > 0) {
            ctx.drawImage(it.img, it.x, it.y, it.w, it.h);
        } else {
            ctx.fillStyle = "#444";
            ctx.fillRect(it.x, it.y, it.w, it.h);
        }
    }

    // Pickups
    for (const p of pickups) {
        if (p.collected) continue;
        if (p.img.complete && p.img.naturalWidth > 0) {
            ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
        } else {
            ctx.fillStyle = "#ff69b4";
            ctx.fillRect(p.x, p.y, p.w, p.h);
        }
    }

    // Player
    if (playerImg.complete && playerImg.naturalWidth > 0) {
        ctx.drawImage(playerImg, player.x - player.w / 2, player.y - player.h / 2, player.w, player.h);
    } else {
        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath();
        ctx.arc(player.x, player.y, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    // Top UI
    drawTopBar();

    // Toast
    drawToast();

    // Modal (separate from top bar)
    if (uiState !== "play") {
        drawModal();
    }

    // (Optional) tiny hint when unlocked but not opened
    if (uiState === "play" && gateUnlocked && !gateOpen) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(10, 52, 360, 26);
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.fillText("Gate unlocked — tap the envelope 💌", 18, 56);
    }
}

// Text wrap helper
function wrapText(text, x, y, maxWidth, lineHeight) {
    // allow manual newlines
    const paragraphs = String(text).split("\n");
    for (const para of paragraphs) {
        const words = para.split(" ");
        let line = "";

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + " ";
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, y);
                line = words[n] + " ";
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y);
        y += lineHeight;
    }
}

// Start
update();
