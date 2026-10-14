"use strict";

const PHRASES = [
  "水皆縹碧", "千丈見底", "游魚細石", "直視無礙",
  "急湍甚箭", "猛浪若奔", "夾岸高山", "皆生寒樹",
  "負勢競上", "互相軒邈", "爭高直指", "千百成峰"
];
const MAX_ROUNDS = 5;
const WRONG_REVEAL_MS = 2000;
const ROUND_PAUSE_MS = 1250;

const $ = (id) => document.getElementById(id);
const startScreen = $("start-screen");
const gameScreen = $("game-screen");
const resultScreen = $("result-screen");
const cardGrid = $("card-grid");
const targetPhrase = $("target-phrase");
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
let revealTimeout = null;
let roundTimeout = null;

function formatSeconds(milliseconds) {
  return (milliseconds / 1000).toFixed(1);
}

function elapsedThisRound() {
  return phase === "playing" || phase === "mistake" ? performance.now() - roundStartedAt : 0;
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

function setUnrevealedCardsEnabled(enabled) {
  cardGrid.querySelectorAll(".study-card:not(.is-locked)").forEach((card) => {
    if (!card.classList.contains("is-mistake")) card.disabled = !enabled;
  });
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

  const backLabel = document.createElement("span");
  backLabel.className = "card-back-label";
  backLabel.setAttribute("aria-hidden", "true");
  backLabel.textContent = "文脈";

  const text = document.createElement("span");
  text.className = "card-face-text";
  text.textContent = PHRASES[phraseIndex];

  card.append(backLabel, text);
  card.addEventListener("click", () => chooseCard(card, phraseIndex));
  return card;
}

function buildBoard() {
  cardGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  shuffleIndices().forEach((phraseIndex) => fragment.append(makeCard(phraseIndex)));
  cardGrid.append(fragment);
}

function beginRound(roundNumberValue) {
  phase = "playing";
  round = roundNumberValue;
  nextPhraseIndex = 0;
  roundNumber.textContent = String(round);
  targetPhrase.textContent = PHRASES[0];
  targetNote.textContent = "翻開一張牌，接續展卷。";
  gameInstruction.innerHTML = '<span class="instruction-dot"></span>依文句先後翻牌；若翻錯，卡牌會停留兩秒再覆回。';
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
      targetPhrase.textContent = PHRASES[nextPhraseIndex];
      targetNote.textContent = "很好，沿著下一句繼續。";
      return;
    }

    finishRound();
    return;
  }

  card.classList.add("is-mistake");
  card.disabled = true;
  phase = "mistake";
  setUnrevealedCardsEnabled(false);
  targetNote.textContent = "句序未合，兩秒後覆卷再試。";
  gameInstruction.innerHTML = '<span class="instruction-dot"></span>這句不在當前位置，請記住順序，稍候再試。';
  revealTimeout = window.setTimeout(() => {
    card.classList.remove("is-flipped", "is-mistake");
    card.setAttribute("aria-pressed", "false");
    card.setAttribute("aria-label", "尚未翻開的文句卡");
    card.disabled = false;
    phase = "playing";
    setUnrevealedCardsEnabled(true);
    targetNote.textContent = "請尋找下一句，循文接續展卷。";
    gameInstruction.innerHTML = '<span class="instruction-dot"></span>依文句先後翻牌；若翻錯，卡牌會停留兩秒再覆回。';
    revealTimeout = null;
  }, WRONG_REVEAL_MS);
}

function finishRound() {
  phase = "round-complete";
  clearInterval(timerInterval);
  const roundTime = performance.now() - roundStartedAt;
  roundTimes.push(roundTime);
  renderTimers();
  lapTimer.textContent = formatSeconds(roundTime);
  targetPhrase.textContent = "全篇展卷完成";

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
}

function startNewGame() {
  clearInterval(timerInterval);
  clearTimeout(revealTimeout);
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
