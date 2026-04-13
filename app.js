mermaid.initialize({
    startOnLoad: false
});


const startingDuration = 15000;
const startingLineOfAnimation = 2;
const startingFrame = 0;

const sequenceBlockStarters = new Set(["alt", "opt", "loop", "par", "critical", "rect", "box"]);
const sequenceStructuralTailKeywords = new Set(["alt", "opt", "loop", "par", "critical", "rect", "box", "else"]);


const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const errorBox = document.getElementById("error");
const playBtn = document.getElementById("playBtn");
const durationInput = document.getElementById("durationInput");


editor.value = `
sequenceDiagram
    participant Application
    participant App Log Cluster
    participant PII Detector
    participant PII Dashboard
    participant DevOps Team
    Application ->> App Log Cluster: Collect PVT app logs
    App Log Cluster ->> PII Detector: Sample PVT app logs
    PII Detector ->> PII Dashboard: Publish PII detection results
    alt PII detected True Positive
        DevOps Team ->> PII Dashboard: Review PII detection results
        alt Identified as PII 
            DevOps Team ->> DevOps Team: No action required
        else Identified NOT as PII (False Positive)
            DevOps Team ->> PII Detector: Enhance PII detection logic & Redeploy
        end
    else PII missed False Negative
        DevOps Team ->> DevOps Team: Discover false negative cases
        DevOps Team ->> PII Detector: Enhance PII detection logic & Redeploy
    end
`;


let frame = startingFrame;
let frameDuration = startingDuration;
let playing = false;
let animationTimeout = null;
let renderId = 0;


function getLines() {
    return editor.value.split("\n");
}

function getLastFrame() {
    return getLines().length - startingLineOfAnimation - 1;
}

function isSequenceDiagram(lines) {
    const firstContentLine = lines.find(line => line.trim().length > 0);
    return firstContentLine && firstContentLine.trim().startsWith("sequenceDiagram");
}

function completeSequenceBlocks(lines) {
    const blockStack = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("%%")) {
            continue;
        }

        const keyword = trimmed.split(/\s+/)[0];

        if (sequenceBlockStarters.has(keyword)) {
            blockStack.push(keyword);
            continue;
        }

        if (keyword === "end" && blockStack.length > 0) {
            blockStack.pop();
        }
    }

    if (blockStack.length === 0) {
        return lines;
    }

    const closingEnds = Array(blockStack.length).fill("    end");
    return [...lines, ...closingEnds];
}

function stabilizeSequenceFrameLines(frameLines, allLines) {
    let end = frameLines.length;

    while (end > 0) {
        const trimmed = frameLines[end - 1].trim();

        if (!trimmed || trimmed.startsWith("%%")) {
            end--;
            continue;
        }

        const keyword = trimmed.split(/\s+/)[0];
        if (!sequenceStructuralTailKeywords.has(keyword)) {
            break;
        }

        for (let i = end; i < allLines.length; i++) {
            const candidate = allLines[i].trim();
            if (!candidate || candidate.startsWith("%%")) {
                continue;
            }

            const nextKeyword = candidate.split(/\s+/)[0];
            if (!sequenceStructuralTailKeywords.has(nextKeyword) && nextKeyword !== "end") {
                return allLines.slice(0, i + 1);
            }
        }

        break;
    }

    return frameLines;
}

function getRenderableLines(lines, allLines) {
    if (!isSequenceDiagram(allLines)) {
        return lines;
    }
    const stableLines = stabilizeSequenceFrameLines(lines, allLines);
    return completeSequenceBlocks(stableLines);
}

async function renderFrame() {
    const lines = getLines();
    const frameLines = lines.slice(0, startingLineOfAnimation + frame);
    const code = getRenderableLines(frameLines, lines).join("\n");

    preview.innerHTML = "";
    errorBox.textContent = "";

    try {
        const {svg} = await mermaid.render(
            "graph_" + renderId++,
            code
        );
        preview.innerHTML = svg;
    } catch (e) {
        errorBox.textContent = e.message;
    }
}


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
    }, frameDuration);
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


document.getElementById("startBtn").onclick = handleStart;
document.getElementById("endBtn").onclick = handleEnd;
document.getElementById("prevBtn").onclick = handlePreviousFrame;
document.getElementById("nextBtn").onclick = handleNextFrame;
playBtn.onclick = handlePlay;

durationInput.value = frameDuration;
durationInput.onchange = e => {
    frameDuration = Number(e.target.value);
};


renderFrame();
