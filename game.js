"use strict";

const PHRASES = [
  "水皆縹碧", "千丈見底", "游魚細石", "直視無礙",
  "急湍甚箭", "猛浪若奔", "夾岸高山", "皆生寒樹",
  "負勢競上", "互相軒邈", "爭高直指", "千百成峰"
];
const WRONG_REVEAL_MS = 1000;
const TIME_LIMIT_MS = 8 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const startScreen = $("start-screen");
const gameScreen = $("game-screen");
const resultScreen = $("result-screen");
const cardGrid = $("card-grid");
const targetNote = $("target-note");
const lapTimer = $("lap-timer");
const progressTrack = $("progress-track");
const progressFill = $("progress-fill");
const progressCount = $("progress-count");
const gameInstruction = $("game-instruction");

let phase = "intro";
let nextPhraseIndex = 0;
let gameStartedAt = 0;
let finalElapsed = 0;
let timerInterval = null;
const pendingWrongCardTimers = new Map();

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function elapsedGame() {
  return phase === "playing" ? performance.now() - gameStartedAt : finalElapsed;
}

function renderTimer() {
  lapTimer.textContent = formatDuration(elapsedGame());
}

function shuffleIndices() {
  const shuffled = [...PHRASES.keys()];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function clearPendingWrongCardTimers() {
  pendingWrongCardTimers.forEach((timeoutId) => window.clearTimeout(timeoutId));
  pendingWrongCardTimers.clear();
}

function setUnrevealedCardsDisabled(disabled) {
  cardGrid.querySelectorAll(".study-card:not(.is-flipped)").forEach((card) => {
    card.disabled = disabled;
  });
  if (disabled) cardGrid.setAttribute("aria-busy", "true");
  else cardGrid.removeAttribute("aria-busy");
}

function updateProgress() {
  progressCount.textContent = `${nextPhraseIndex} / ${PHRASES.length}`;
  progressTrack.setAttribute("aria-valuenow", String(nextPhraseIndex));
  progressFill.style.width = `${(nextPhraseIndex / PHRASES.length) * 100}%`;
}

function makeCard(phraseIndex) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "study-card";
  card.setAttribute("aria-label", "尚未翻開的文句卡");
  card.setAttribute("aria-pressed", "false");
  card.dataset.phraseIndex = String(phraseIndex);

  const backArt = document.createElement("img");
  backArt.className = "card-back-art";
  backArt.src = "./assets/card-seal.webp";
  backArt.alt = "";
  backArt.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "card-face-text";
  text.textContent = PHRASES[phraseIndex];

  card.append(backArt, text);
  card.addEventListener("click", () => chooseCard(card, phraseIndex));
  return card;
}

function buildBoard() {
  cardGrid.removeAttribute("aria-busy");
  cardGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  shuffleIndices().forEach((phraseIndex) => fragment.append(makeCard(phraseIndex)));
  cardGrid.append(fragment);
}

function startNewGame() {
  clearInterval(timerInterval);
  clearPendingWrongCardTimers();
  phase = "playing";
  nextPhraseIndex = 0;
  finalElapsed = 0;
  targetNote.textContent = "";
  gameInstruction.innerHTML = '<span class="instruction-dot"></span>錯牌顯示 1 秒後覆回；期間暫停其他翻牌。';
  buildBoard();
  updateProgress();
  startScreen.classList.add("is-hidden");
  resultScreen.classList.add("is-hidden");
  gameScreen.classList.remove("is-hidden");
  gameStartedAt = performance.now();
  renderTimer();
  timerInterval = window.setInterval(renderTimer, 100);
}

function chooseCard(card, phraseIndex) {
  if (phase !== "playing" || card.disabled || card.classList.contains("is-flipped")) return;

  card.classList.add("is-flipped");
  card.setAttribute("aria-pressed", "true");
  card.setAttribute("aria-label", PHRASES[phraseIndex]);

  if (phraseIndex === nextPhraseIndex) {
    card.classList.add("is-locked");
    card.disabled = true;
    nextPhraseIndex += 1;
    updateProgress();

    if (nextPhraseIndex < PHRASES.length) {
      targetNote.textContent = "次序正確。";
      return;
    }

    finishGame();
    return;
  }

  card.classList.add("is-mistake");
  card.disabled = true;
  setUnrevealedCardsDisabled(true);
  targetNote.textContent = "句序未合，1 秒後再試。";
  const revealTimeoutId = window.setTimeout(() => {
    card.classList.remove("is-flipped", "is-mistake");
    card.setAttribute("aria-pressed", "false");
    card.setAttribute("aria-label", "尚未翻開的文句卡");
    card.disabled = false;
    pendingWrongCardTimers.delete(card);
    if (phase === "playing") {
      setUnrevealedCardsDisabled(false);
      targetNote.textContent = "卡牌已覆回。";
    }
  }, WRONG_REVEAL_MS);
  pendingWrongCardTimers.set(card, revealTimeoutId);
}

function finishGame() {
  phase = "complete";
  clearInterval(timerInterval);
  finalElapsed = performance.now() - gameStartedAt;
  renderTimer();
  targetNote.textContent = "十二句依序成篇。";
  window.setTimeout(showResults, 550);
}

function showResults() {
  phase = "results";
  startScreen.classList.add("is-hidden");
  gameScreen.classList.add("is-hidden");
  resultScreen.classList.remove("is-hidden");

  const list = $("lap-results");
  list.replaceChildren();
  const row = document.createElement("li");
  const label = document.createElement("span");
  const result = document.createElement("strong");
  label.textContent = "本局完成時間";
  result.textContent = formatDuration(finalElapsed);
  row.append(label, result);
  list.append(row);
  $("final-total").textContent = formatDuration(finalElapsed);

  const completionStatus = $("completion-status");
  if (finalElapsed <= TIME_LIMIT_MS) {
    completionStatus.textContent = "八分鐘內完成・可列入完成組別";
    completionStatus.classList.remove("is-overtime");
  } else {
    completionStatus.textContent = "超過八分鐘・仍記錄本局實際用時";
    completionStatus.classList.add("is-overtime");
  }
}

$("start-button").addEventListener("click", startNewGame);
$("replay-button").addEventListener("click", startNewGame);
