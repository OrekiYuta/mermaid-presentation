mermaid.initialize({
    startOnLoad: false
});


const startingDuration = 1000;
const startingLineOfAnimation = 2;
const startingFrame = 0;

const sequenceBlockStarters = new Set(["alt", "opt", "loop", "par", "critical", "rect", "box"]);
const sequenceStructuralTailKeywords = new Set(["alt", "opt", "loop", "par", "critical", "rect", "box", "else"]);


const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const errorBox = document.getElementById("error");
const playBtn = document.getElementById("playBtn");
const durationInput = document.getElementById("durationInput");
const stepInfo = document.getElementById("stepInfo");
const downloadBtn = document.getElementById("downloadBtn");
const exportStatus = document.getElementById("exportStatus");
const layout = document.querySelector(".layout");
const paneDivider = document.getElementById("paneDivider");


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
let activeLineIndex = 0;
let exportStatusTimeout = null;


function getLines() {
    return editor.value.split("\n");
}

function getLastFrame() {
    return Math.max(startingFrame, getLines().length - startingLineOfAnimation - 1);
}

function getActiveLineIndex(lines) {
    if (lines.length === 0) {
        return 0;
    }
    const candidate = startingLineOfAnimation + frame - 1;
    return Math.max(0, Math.min(candidate, lines.length - 1));
}

function getEditorLineHeightPx() {
    const raw = window.getComputedStyle(editor).lineHeight;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : 20;
}

function renderEditorHighlight() {
    const styles = window.getComputedStyle(editor);
    const lineHeight = getEditorLineHeightPx();
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const offset = paddingTop + activeLineIndex * lineHeight - editor.scrollTop;

    editor.style.setProperty("--editor-line-height", `${lineHeight}px`);
    editor.style.setProperty("--active-line-offset", `${offset}px`);
}

function initPaneResize() {
    if (!layout || !paneDivider) {
        return;
    }

    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    const onPointerMove = e => {
        if (!dragging) {
            return;
        }

        const rect = layout.getBoundingClientRect();
        const nextWidth = startWidth + (e.clientX - startX);
        const minWidth = 320;
        const maxWidth = Math.max(minWidth, rect.width - 440);
        const clampedWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth));

        layout.style.setProperty("--left-pane-width", `${clampedWidth}px`);
    };

    const stopDragging = () => {
        if (!dragging) {
            return;
        }

        dragging = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
    };

    paneDivider.addEventListener("pointerdown", e => {
        const leftPane = layout.querySelector(".left");
        if (!leftPane) {
            return;
        }

        dragging = true;
        startX = e.clientX;
        startWidth = leftPane.getBoundingClientRect().width;

        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
        paneDivider.setPointerCapture(e.pointerId);
    });

    paneDivider.addEventListener("pointermove", onPointerMove);
    paneDivider.addEventListener("pointerup", stopDragging);
    paneDivider.addEventListener("pointercancel", stopDragging);
    window.addEventListener("pointerup", stopDragging);
}

function renderStepInfo() {
    if (!stepInfo) {
        return;
    }
    stepInfo.textContent = `Step ${frame} / ${getLastFrame()}`;
}

function showMessage(message, isError) {
    errorBox.style.color = isError ? "red" : "#1a7f37";
    errorBox.textContent = message;
}

function showExportMessage(message, isError) {
    if (!exportStatus) {
        return;
    }

    if (exportStatusTimeout) {
        clearTimeout(exportStatusTimeout);
        exportStatusTimeout = null;
    }

    exportStatus.style.color = isError ? "red" : "#1a7f37";
    exportStatus.textContent = message;

    if (!isError && message) {
        exportStatusTimeout = setTimeout(() => {
            exportStatus.textContent = "";
            exportStatusTimeout = null;
        }, 2000);
    }
}

function getPreviewSvgElement() {
    return preview.querySelector("svg");
}

function getPreviewSvgMarkup(svgElement) {
    const exportSvg = svgElement.cloneNode(true);
    const rect = svgElement.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || svgElement.viewBox.baseVal.width || 1200));
    const height = Math.max(1, Math.round(rect.height || svgElement.viewBox.baseVal.height || 800));

    exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    exportSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    exportSvg.setAttribute("width", String(width));
    exportSvg.setAttribute("height", String(height));

    if (!exportSvg.getAttribute("viewBox")) {
        exportSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    const serializer = new XMLSerializer();
    return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(exportSvg)}`;
}

function getPreviewSvgBlob() {
    const svgElement = getPreviewSvgElement();
    if (!svgElement) {
        throw new Error("No diagram available to export yet.");
    }
    const svgMarkup = getPreviewSvgMarkup(svgElement);
    return new Blob([svgMarkup], {type: "image/svg+xml;charset=utf-8"});
}

async function handleDownloadImage() {
    try {
        const blob = getPreviewSvgBlob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `mermaid-step-${frame}.svg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
        showExportMessage("SVG downloaded.", false);
    } catch (e) {
        showExportMessage(e.message, true);
    }
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
    frame = Math.max(startingFrame, Math.min(frame, getLastFrame()));
    activeLineIndex = getActiveLineIndex(lines);

    renderEditorHighlight();
    renderStepInfo();

    const frameLines = lines.slice(0, startingLineOfAnimation + frame);
    const code = getRenderableLines(frameLines, lines).join("\n");

    preview.innerHTML = "";
    showMessage("", true);

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
if (downloadBtn) {
    downloadBtn.onclick = handleDownloadImage;
}

durationInput.value = frameDuration;
durationInput.onchange = e => {
    frameDuration = Number(e.target.value);
};

editor.oninput = () => {
    if (animationTimeout) {
        handlePause();
    }
    showExportMessage("", false);
    renderFrame();
};

editor.onscroll = () => {
    renderEditorHighlight();
};


renderFrame();
initPaneResize();
