mermaid.initialize({
    startOnLoad: false
});

/* ===== Configuration (SECONDS) ===== */
const startingDurationSeconds = 15;
const startingLineOfAnimation = 1;
const startingFrame = 0;

/* ===== DOM ===== */
const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const errorBox = document.getElementById("error");
const playBtn = document.getElementById("playBtn");
const durationInput = document.getElementById("durationInput");

/* ===== State ===== */
let frame = startingFrame;
let frameDurationMs = startingDurationSeconds * 1000;
let playing = false;
let animationTimeout = null;
let renderId = 0;

/* ===== Helpers ===== */
function getLines() {
    return editor.value.split("\n");
}

function getLastFrame() {
    return getLines().length - startingLineOfAnimation - 1;
}

/* ===== Render ===== */
async function renderFrame() {
    const lines = getLines();
    const code = lines
        .slice(0, startingLineOfAnimation + frame)
        .join("\n");

    preview.innerHTML = "";
    errorBox.textContent = "";

    try {
        const { svg } = await mermaid.render(
            "graph_" + renderId++,
            code
        );
        preview.innerHTML = svg;
    } catch (e) {
        errorBox.textContent = e.message;
    }
}

/* ===== Controls ===== */
function handleStart() {
    frame = startingFrame;
    renderFrame();
}

function handleEnd() {
    frame = getLastFrame();
    renderFrame();
}

function handlePreviousFrame() {
    if (frame > startingFrame) {
        frame--;
        renderFrame();
    }
}

function handleNextFrame() {
    if (frame < getLastFrame()) {
        frame++;
        renderFrame();
    }
}

function handleAnimation() {
    if (frame >= getLastFrame()) {
        handlePause();
        return;
    }
    animationTimeout = setTimeout(() => {
        handleNextFrame();
        handleAnimation();
    }, frameDurationMs);
}

function handlePlay() {
    if (animationTimeout) {
        handlePause();
        return;
    }

    playing = true;
    playBtn.textContent = "Pause";

    if (frame >= getLastFrame()) {
        frame = startingFrame;
    }

    renderFrame();
    handleAnimation();
}

function handlePause() {
    clearTimeout(animationTimeout);
    animationTimeout = null;
    playing = false;
    playBtn.textContent = "Play";
}

/* ===== Bindings ===== */
document.getElementById("startBtn").onclick = handleStart;
document.getElementById("endBtn").onclick = handleEnd;
document.getElementById("prevBtn").onclick = handlePreviousFrame;
document.getElementById("nextBtn").onclick = handleNextFrame;
playBtn.onclick = handlePlay;

/* ===== Duration Input (SECONDS) ===== */
durationInput.value = startingDurationSeconds;
durationInput.onchange = e => {
    const seconds = Math.max(0.1, Number(e.target.value) || 1);
    frameDurationMs = seconds * 1000;
    e.target.value = seconds;
};

/* ===== Initial Render ===== */
renderFrame();
