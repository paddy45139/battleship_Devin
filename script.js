// ===== Battleship – vanilla JS =====

const SIZE = 10;
const SHIPS = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
];
const COMPUTER_DELAY = 500;

// DOM references
const el = (id) => document.getElementById(id);
const playerBoardEl = el("player-board");
const enemyBoardEl = el("enemy-board");
const turnEl = el("turn");
const statusEl = el("status");
const randomizeBtn = el("randomize-btn");
const startBtn = el("start-btn");
const newGameBtn = el("new-game-btn");
const overlay = el("overlay");

// Game state
let player, enemy;
let phase;            // "setup" | "player" | "computer" | "over"
let computerTimer = null;

// A board holds the fleet plus a grid of shots.
// grid[r][c] = index of ship occupying the cell, or -1 for water.
// shots[r][c] = true once that cell has been fired at.
function createBoard() {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(-1));
  const shots = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const ships = SHIPS.map((s, i) => placeShip(grid, s, i));
  return { grid, shots, ships };
}

// Randomly place one ship: retries until it fits inside the board without overlap.
function placeShip(grid, spec, index) {
  while (true) {
    const horizontal = Math.random() < 0.5;
    const r = Math.floor(Math.random() * (horizontal ? SIZE : SIZE - spec.size + 1));
    const c = Math.floor(Math.random() * (horizontal ? SIZE - spec.size + 1 : SIZE));
    const cells = [];
    for (let k = 0; k < spec.size; k++) {
      cells.push(horizontal ? [r, c + k] : [r + k, c]);
    }
    if (cells.every(([y, x]) => grid[y][x] === -1)) {
      cells.forEach(([y, x]) => (grid[y][x] = index));
      return { name: spec.name, size: spec.size, cells, hits: 0, sunk: false };
    }
  }
}

// Fire at a board. Returns null if the cell was already shot,
// otherwise { hit, sunkShip } where sunkShip is set only on the sinking shot.
function fire(board, r, c) {
  if (board.shots[r][c]) return null;
  board.shots[r][c] = true;
  const idx = board.grid[r][c];
  if (idx === -1) return { hit: false, sunkShip: null };
  const ship = board.ships[idx];
  ship.hits++;
  if (!ship.sunk && ship.hits === ship.size) {
    ship.sunk = true; // flag ensures the sink is announced only once
    return { hit: true, sunkShip: ship };
  }
  return { hit: true, sunkShip: null };
}

const shipsLeft = (board) => board.ships.filter((s) => !s.sunk).length;

// ----- Rendering -----

function buildGrid(container, isEnemy) {
  container.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (isEnemy) cell.addEventListener("click", onEnemyClick);
      container.appendChild(cell);
    }
  }
}

function renderBoard(container, board, showShips) {
  const cells = container.children;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = cells[r * SIZE + c];
      const idx = board.grid[r][c];
      const shot = board.shots[r][c];
      let cls = "cell";
      if (idx !== -1 && showShips) cls += " ship";
      if (shot) {
        if (idx === -1) cls += " miss";
        else cls += board.ships[idx].sunk ? " sunk" : " hit";
      }
      cell.className = cls;
    }
  }
}

function renderFleet(listEl, board) {
  listEl.innerHTML = board.ships
    .map((s) => `<li class="${s.sunk ? "sunk" : ""}">${s.name} (${s.size})</li>`)
    .join("");
}

function render() {
  renderBoard(playerBoardEl, player, true);
  renderBoard(enemyBoardEl, enemy, false);
  renderFleet(el("player-fleet"), player);
  renderFleet(el("enemy-fleet"), enemy);
  el("player-ships-left").textContent = shipsLeft(player);
  el("enemy-ships-left").textContent = shipsLeft(enemy);

  const labels = { setup: "Setup", player: "Your turn", computer: "Computer's turn", over: "Game over" };
  turnEl.textContent = labels[phase];
  enemyBoardEl.classList.toggle("active", phase === "player");
  randomizeBtn.disabled = phase !== "setup";
  startBtn.disabled = phase !== "setup";
}

const setStatus = (msg) => (statusEl.textContent = msg);

// ----- Game flow -----

function newGame() {
  clearTimeout(computerTimer); // cancel any pending computer turn
  computerTimer = null;
  player = createBoard();
  enemy = createBoard();
  phase = "setup";
  overlay.classList.add("hidden");
  setStatus("Randomize your fleet, then press Start Battle.");
  render();
}

function randomizeFleet() {
  if (phase !== "setup") return;
  player = createBoard();
  setStatus("Fleet randomized. Press Start Battle when ready.");
  render();
}

function startBattle() {
  if (phase !== "setup") return;
  phase = "player";
  setStatus("Battle started! Fire at Enemy Waters.");
  render();
}

function onEnemyClick(e) {
  // Only accept shots on the player's turn – blocks clicks during the
  // computer's turn, after game over, and repeated rapid clicks.
  if (phase !== "player") return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  const result = fire(enemy, r, c);
  if (!result) {
    setStatus("You already fired there. Pick another cell.");
    return;
  }

  let msg = result.hit ? "You hit an enemy ship!" : "You missed.";
  if (result.sunkShip) msg = `You sank the enemy ${result.sunkShip.name}!`;
  setStatus(msg);

  if (shipsLeft(enemy) === 0) return endGame(true);

  // Computer always gets exactly one shot after the player's shot.
  phase = "computer";
  render();
  computerTimer = setTimeout(computerTurn, COMPUTER_DELAY);
}

function computerTurn() {
  computerTimer = null;
  if (phase !== "computer") return;

  // Pick a random cell that hasn't been attacked yet.
  const open = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!player.shots[r][c]) open.push([r, c]);
  const [r, c] = open[Math.floor(Math.random() * open.length)];
  const result = fire(player, r, c);

  let msg = result.hit ? "The computer hit your ship!" : "The computer missed.";
  if (result.sunkShip) msg = `The computer sank your ${result.sunkShip.name}!`;
  setStatus(msg + " Your turn.");

  if (shipsLeft(player) === 0) return endGame(false);

  phase = "player";
  render();
}

function endGame(playerWon) {
  phase = "over";
  render();
  // Reveal remaining enemy ships after the game ends.
  renderBoard(enemyBoardEl, enemy, true);
  setStatus(playerWon ? "Victory! You sank the entire enemy fleet." : "Defeat! Your fleet has been destroyed.");
  const modal = overlay.querySelector(".modal");
  modal.className = "panel modal " + (playerWon ? "win" : "lose");
  el("result-title").textContent = playerWon ? "Victory!" : "Defeat";
  el("result-text").textContent = playerWon
    ? "You sank the entire enemy fleet."
    : "The computer sank all of your ships.";
  overlay.classList.remove("hidden");
}

// ----- Init -----
buildGrid(playerBoardEl, false);
buildGrid(enemyBoardEl, true);
randomizeBtn.addEventListener("click", randomizeFleet);
startBtn.addEventListener("click", startBattle);
newGameBtn.addEventListener("click", newGame);
el("play-again-btn").addEventListener("click", newGame);
newGame();
