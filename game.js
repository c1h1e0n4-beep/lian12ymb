"use strict";

const PHRASES = [
  "水皆縹碧", "千丈見底", "游魚細石", "直視無礙",
  "急湍甚箭", "猛浪若奔", "夾岸高山", "皆生寒樹",
  "負勢競上", "互相軒邈", "爭高直指", "千百成峰"
];
const MAX_ROUNDS = 5;
const WRONG_REVEAL_MS = 1000;
const ROUND_PAUSE_MS = 1250;
const TIME_LIMIT_MS = 8 * 60 * 1000;

const $ = (id) => document.getElementById(id);
const startScreen = $("start-screen");
const gameScreen = $("game-screen");
const resultScreen = $("result-screen");
const cardGrid = $("card-grid");
const targetNote = $("target-note");
const roundNumber = $("round-number");
const lapTimer = $("lap-timer");
const totalTimer = $("total-timer");
const progressTrack = $("progress-track");
const progressFill = $("progress-fill");
const progressCount = $("progress-count");
const gameInstruction = $("game-instruction");
const roundToast = $("round-toast");

let phase = "intro";
let round = 1;
let nextPhraseIndex = 0;
let roundStartedAt = 0;
let roundTimes = [];
let previousArrangement = null;
let timerInterval = null;
let roundTimeout = null;
const pendingWrongCardTimers = new Map();

function formatSeconds(milliseconds) {
  return (milliseconds / 1000).toFixed(1);
}

function elapsedThisRound() {
  return phase === "playing" ? performance.now() - roundStartedAt : 0;
}

function renderTimers() {
  const current = elapsedThisRound();
  const completed = roundTimes.reduce((sum, time) => sum + time, 0);
  lapTimer.textContent = formatSeconds(current);
  totalTimer.textContent = formatSeconds(completed + current);
}

function shuffleIndices() {
  let shuffled;
  let attempts = 0;
  do {
    shuffled = [...PHRASES.keys()];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    attempts += 1;
  } while (previousArrangement && shuffled.every((value, index) => value === previousArrangement[index]) && attempts < 100);
  previousArrangement = [...shuffled];
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

function beginRound(roundNumberValue) {
  clearPendingWrongCardTimers();
  phase = "playing";
  round = roundNumberValue;
  nextPhraseIndex = 0;
  roundNumber.textContent = String(round);
  targetNote.textContent = "";
  gameInstruction.innerHTML = '<span class="instruction-dot"></span>錯牌顯示 1 秒後覆回；期間暫停其他翻牌。';
  roundToast.classList.remove("is-visible");
  buildBoard();
  updateProgress();
  roundStartedAt = performance.now();
  renderTimers();
  clearInterval(timerInterval);
  timerInterval = window.setInterval(renderTimers, 100);
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

    finishRound();
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

function finishRound() {
  phase = "round-complete";
  clearInterval(timerInterval);
  const roundTime = performance.now() - roundStartedAt;
  roundTimes.push(roundTime);
  renderTimers();
  lapTimer.textContent = formatSeconds(roundTime);

  if (round < MAX_ROUNDS) {
    targetNote.textContent = `第 ${round} 輪已成，下一卷即刻展開。`;
    roundToast.textContent = `第 ${round} 輪完成・${formatSeconds(roundTime)} 秒`;
    roundToast.classList.add("is-visible");
    roundTimeout = window.setTimeout(() => beginRound(round + 1), ROUND_PAUSE_MS);
    return;
  }

  targetNote.textContent = "五輪俱畢，且看此卷成績。";
  roundTimeout = window.setTimeout(showResults, 800);
}

function showResults() {
  phase = "results";
  clearInterval(timerInterval);
  roundToast.classList.remove("is-visible");
  startScreen.classList.add("is-hidden");
  gameScreen.classList.add("is-hidden");
  resultScreen.classList.remove("is-hidden");

  const list = $("lap-results");
  list.replaceChildren();
  roundTimes.forEach((time, index) => {
    const row = document.createElement("li");
    const label = document.createElement("span");
    const result = document.createElement("strong");
    label.textContent = `第 ${index + 1} 輪`;
    result.textContent = `${formatSeconds(time)} 秒`;
    row.append(label, result);
    list.append(row);
  });
  const total = roundTimes.reduce((sum, time) => sum + time, 0);
  $("final-total").textContent = `${formatSeconds(total)} 秒`;
  const completionStatus = $("completion-status");
  if (total <= TIME_LIMIT_MS) {
    completionStatus.textContent = "限時內完成・可列入完成組別";
    completionStatus.classList.remove("is-overtime");
  } else {
    completionStatus.textContent = "超過八分鐘・仍記錄實際用時，不列入限時完成組別";
    completionStatus.classList.add("is-overtime");
  }
}

function startNewGame() {
  clearInterval(timerInterval);
  clearTimeout(roundTimeout);
  roundTimes = [];
  round = 1;
  nextPhraseIndex = 0;
  lapTimer.textContent = "0.0";
  totalTimer.textContent = "0.0";
  resultScreen.classList.add("is-hidden");
  startScreen.classList.add("is-hidden");
  gameScreen.classList.remove("is-hidden");
  beginRound(1);
}

$("start-button").addEventListener("click", startNewGame);
$("replay-button").addEventListener("click", startNewGame);
