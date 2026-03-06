/* ============================================
   游戏状态管理、商店、经济系统
   ============================================ */

let gameState = null;

function createUnit(defId, star = 1) {
    const def = getUnitDef(defId);
    const mult = STAR_MULTIPLIERS[star];
    return {
        uid: generateUid(),
        defId: def.id,
        name: def.name,
        icon: def.icon,
        cost: def.cost,
        race: def.race,
        class: def.class,
        star: star,
        maxHp: Math.round(def.hp * mult.hp),
        hp: Math.round(def.hp * mult.hp),
        attack: Math.round(def.attack * mult.attack),
        armor: Math.round(def.armor * mult.armor),
        attackSpeed: def.attackSpeed,
        range: def.range,
        // combat-specific (set during combat)
        currentHp: 0,
        evasion: 0,
        critChance: 0,
        shieldChance: 0,
        pureDamageBonus: 0,
        spellDamageBonus: 0,
        attackSpeedBonus: 0,
    };
}

function initGameState(difficulty = 'normal') {
    const diff = DIFFICULTY_MODES[difficulty] || DIFFICULTY_MODES.normal;
    gameState = {
        phase: 'prep',
        round: 1,
        hp: diff.startHp,
        maxHp: diff.startHp,
        gold: 6,
        level: 3,
        xp: 0,
        maxBoardUnits: 3,
        difficulty: difficulty,

        winStreak: 0,
        loseStreak: 0,

        board: Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null)),
        bench: Array(BENCH_SIZE).fill(null),

        shop: [],
        shopLocked: false,

        selectedUnit: null,

        combatUnits: null,
        combatLog: [],

        enemyHp: 100,
        enemyName: '',

        sessionStats: {
            bossesKilled: 0,
            racesUsed: new Set(),
            totalInterest: 0,
            threeStarMerged: false,
        },
    };

    updateMaxBoardUnits();
    rollShop();
    return gameState;
}

function updateMaxBoardUnits() {
    gameState.maxBoardUnits = Math.max(1, gameState.level);
}

/* ===== 经济系统 ===== */

function getInterestGold() {
    return Math.min(Math.floor(gameState.gold / 10), MAX_INTEREST);
}

function getStreakBonus() {
    const streak = Math.max(gameState.winStreak, gameState.loseStreak);
    if (streak >= 5) return 3;
    if (streak >= 3) return 2;
    if (streak >= 2) return 1;
    return 0;
}

function awardRoundGold() {
    const baseGold = 5;
    const interest = getInterestGold();
    const streak = getStreakBonus();
    const roundBonus = Math.floor(gameState.round / 5);
    const total = baseGold + interest + streak + roundBonus;
    gameState.gold += total;
    if (gameState.sessionStats) {
        gameState.sessionStats.totalInterest += interest;
        if (interest >= 5) Achievement.unlock('interest_10');
    }
    return { baseGold, interest, streak, roundBonus, total };
}

function addXp(amount) {
    gameState.xp += amount;
    while (gameState.level < 9 && gameState.xp >= XP_PER_LEVEL[gameState.level + 1]) {
        gameState.xp -= XP_PER_LEVEL[gameState.level + 1];
        gameState.level++;
        updateMaxBoardUnits();
    }
    if (gameState.level >= 9) {
        gameState.xp = Math.min(gameState.xp, XP_PER_LEVEL[9] || 0);
    }
}

/* ===== 商店系统 ===== */

function rollShop() {
    if (gameState.shopLocked) return;
    const level = Math.min(gameState.level, 9);
    const odds = TIER_ROLL_ODDS[level];
    const shop = [];
    const diff = DIFFICULTY_MODES[gameState.difficulty] || DIFFICULTY_MODES.normal;
    const shopSize = diff.shopSize || SHOP_SIZE;

    for (let i = 0; i < shopSize; i++) {
        const roll = Math.random();
        let cumulative = 0;
        let tier = 1;
        for (let t = 0; t < odds.length; t++) {
            cumulative += odds[t];
            if (roll < cumulative) {
                tier = t + 1;
                break;
            }
        }
        const tierUnits = getUnitsByTier(tier);
        const chosen = tierUnits[Math.floor(Math.random() * tierUnits.length)];
        shop.push({ defId: chosen.id, sold: false });
    }

    gameState.shop = shop;
}

function buyUnit(shopIndex) {
    if (gameState.phase !== 'prep') return false;
    const item = gameState.shop[shopIndex];
    if (!item || item.sold) return false;

    const def = getUnitDef(item.defId);
    if (gameState.gold < def.cost) return false;

    const benchSlot = gameState.bench.findIndex(b => b === null);
    if (benchSlot === -1) return false;

    gameState.gold -= def.cost;
    item.sold = true;

    const unit = createUnit(item.defId);
    gameState.bench[benchSlot] = unit;

    tryMergeUnit(unit.defId);
    return true;
}

function sellUnit(source, row, col) {
    let unit = null;
    if (source === 'bench') {
        unit = gameState.bench[col];
        if (!unit) return false;
        gameState.bench[col] = null;
    } else if (source === 'board') {
        unit = gameState.board[row][col];
        if (!unit) return false;
        gameState.board[row][col] = null;
    }

    if (!unit) return false;
    const refund = Math.max(1, Math.ceil(unit.cost * SELL_REFUND_RATE * unit.star));
    gameState.gold += refund;
    gameState.selectedUnit = null;
    return true;
}

function rerollShop() {
    if (gameState.phase !== 'prep') return false;
    if (gameState.gold < REROLL_COST) return false;
    gameState.gold -= REROLL_COST;
    gameState.shopLocked = false;
    rollShop();
    return true;
}

function buyXp() {
    if (gameState.phase !== 'prep') return false;
    if (gameState.gold < BUY_XP_COST) return false;
    if (gameState.level >= 9) return false;
    gameState.gold -= BUY_XP_COST;
    addXp(BUY_XP_AMOUNT);
    return true;
}

function toggleShopLock() {
    gameState.shopLocked = !gameState.shopLocked;
}

/* ===== 棋子放置 ===== */

function moveUnit(fromSource, fromRow, fromCol, toSource, toRow, toCol) {
    let unit = null;

    if (fromSource === 'bench') {
        unit = gameState.bench[fromCol];
        if (!unit) return false;
    } else {
        unit = gameState.board[fromRow][fromCol];
        if (!unit) return false;
    }

    if (toSource === 'bench') {
        if (gameState.bench[toCol] !== null) {
            // swap
            const targetUnit = gameState.bench[toCol];
            if (fromSource === 'bench') {
                gameState.bench[fromCol] = targetUnit;
            } else {
                gameState.board[fromRow][fromCol] = targetUnit;
            }
            gameState.bench[toCol] = unit;
        } else {
            if (fromSource === 'bench') {
                gameState.bench[fromCol] = null;
            } else {
                gameState.board[fromRow][fromCol] = null;
            }
            gameState.bench[toCol] = unit;
        }
    } else {
        if (gameState.board[toRow][toCol] !== null) {
            // swap
            const targetUnit = gameState.board[toRow][toCol];
            if (fromSource === 'bench') {
                gameState.bench[fromCol] = targetUnit;
            } else {
                gameState.board[fromRow][fromCol] = targetUnit;
            }
            gameState.board[toRow][toCol] = unit;
        } else {
            if (fromSource === 'bench') {
                gameState.bench[fromCol] = null;
            } else {
                gameState.board[fromRow][fromCol] = null;
            }
            gameState.board[toRow][toCol] = unit;
        }
    }

    gameState.selectedUnit = null;
    return true;
}

function getBoardUnitCount() {
    let count = 0;
    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            if (gameState.board[r][c]) count++;
        }
    }
    return count;
}

function canPlaceOnBoard() {
    return getBoardUnitCount() < gameState.maxBoardUnits;
}

/* ===== 升星合成 ===== */

function tryMergeUnit(defId) {
    let merged = true;
    while (merged) {
        merged = false;
        for (let targetStar = 1; targetStar <= 2; targetStar++) {
            const units = findAllUnitsOfType(defId, targetStar);
            if (units.length >= 3) {
                mergeThreeUnits(units.slice(0, 3), defId, targetStar + 1);
                merged = true;
                break;
            }
        }
    }
}

function findAllUnitsOfType(defId, star) {
    const found = [];
    for (let c = 0; c < BENCH_SIZE; c++) {
        const u = gameState.bench[c];
        if (u && u.defId === defId && u.star === star) {
            found.push({ source: 'bench', row: 0, col: c });
        }
    }
    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            const u = gameState.board[r][c];
            if (u && u.defId === defId && u.star === star) {
                found.push({ source: 'board', row: r, col: c });
            }
        }
    }
    return found;
}

function mergeThreeUnits(locations, defId, newStar) {
    let keepLoc = locations.find(l => l.source === 'board') || locations[0];

    for (const loc of locations) {
        if (loc === keepLoc) continue;
        if (loc.source === 'bench') {
            gameState.bench[loc.col] = null;
        } else {
            gameState.board[loc.row][loc.col] = null;
        }
    }

    const newUnit = createUnit(defId, newStar);

    if (keepLoc.source === 'bench') {
        gameState.bench[keepLoc.col] = newUnit;
    } else {
        gameState.board[keepLoc.row][keepLoc.col] = newUnit;
    }

    if (newStar >= 3) {
        if (gameState.sessionStats) gameState.sessionStats.threeStarMerged = true;
        Achievement.unlock('three_star');
    }
}

/* ===== 羁绊计算 ===== */

function calculateSynergies() {
    const raceCounts = {};
    const classCounts = {};
    const uniqueDemons = new Set();

    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            const unit = gameState.board[r][c];
            if (!unit) continue;
            raceCounts[unit.race] = (raceCounts[unit.race] || 0) + 1;
            classCounts[unit.class] = (classCounts[unit.class] || 0) + 1;
            if (unit.race === 'demon') uniqueDemons.add(unit.defId);
            if (gameState.sessionStats) gameState.sessionStats.racesUsed.add(unit.race);
        }
    }

    const activeSynergies = [];

    for (const [raceId, race] of Object.entries(RACES)) {
        const count = raceCounts[raceId] || 0;
        if (count === 0) continue;

        if (raceId === 'demon') {
            const uniqueCount = uniqueDemons.size;
            const thresholds = [2, 4];
            let bestT = 0;
            for (const t of thresholds) { if (uniqueCount >= t) bestT = t; }
            const isActive = bestT > 0;
            let bonusText = thresholds[0] + '个不同激活';
            if (isActive) bonusText = race.bonuses[bestT];
            else if (uniqueCount < count) bonusText = `${uniqueCount}种/${thresholds[0]}种激活`;
            activeSynergies.push({
                type: 'race', id: raceId, name: race.name, icon: race.icon,
                count: count, threshold: bestT, active: isActive,
                thresholds: thresholds,
                bonusText: bonusText,
                effectKey: isActive ? `demon_${bestT}` : null
            });
            continue;
        }

        const thresholds = Object.keys(race.bonuses).map(Number).sort((a, b) => a - b);
        let bestThreshold = 0;
        for (const t of thresholds) {
            if (count >= t) bestThreshold = t;
        }

        activeSynergies.push({
            type: 'race', id: raceId, name: race.name, icon: race.icon,
            count: count, threshold: bestThreshold, active: bestThreshold > 0,
            thresholds: thresholds,
            bonusText: bestThreshold > 0 ? race.bonuses[bestThreshold] : thresholds[0] + '个激活',
            effectKey: bestThreshold > 0 ? `${raceId}_${bestThreshold}` : null
        });
    }

    for (const [classId, cls] of Object.entries(CLASSES)) {
        const count = classCounts[classId] || 0;
        if (count === 0) continue;

        const thresholds = Object.keys(cls.bonuses).map(Number).sort((a, b) => a - b);
        let bestThreshold = 0;
        for (const t of thresholds) {
            if (count >= t) bestThreshold = t;
        }

        activeSynergies.push({
            type: 'class', id: classId, name: cls.name, icon: cls.icon,
            count: count, threshold: bestThreshold, active: bestThreshold > 0,
            thresholds: thresholds,
            bonusText: bestThreshold > 0 ? cls.bonuses[bestThreshold] : thresholds[0] + '个激活',
            effectKey: bestThreshold > 0 ? `${classId}_${bestThreshold}` : null
        });
    }

    for (const syn of activeSynergies) {
        if (syn.id === 'demon' && syn.active && syn.threshold >= 4) Achievement.unlock('demon_lord');
    }

    return activeSynergies;
}

function applySynergyBuffs(units, synergies, isEnemy = false) {
    const buffs = {
        hp: 0, attack: 0, armor: 0, evasion: 0,
        critChance: 0, shieldChance: 0, pureDamage: 0,
        spellDamage: 0, attackSpeed: 0, enemyArmor: 0,
    };

    for (const syn of synergies) {
        if (!syn.active || !syn.effectKey) continue;
        const effect = SYNERGY_EFFECTS[syn.effectKey];
        if (!effect) continue;

        if (effect.stat === 'enemyArmor') {
            buffs.enemyArmor += effect.value;
        } else if (effect.type === 'percent') {
            buffs[effect.stat] = (buffs[effect.stat] || 0) + effect.value;
        } else {
            buffs[effect.stat] = (buffs[effect.stat] || 0) + effect.value;
        }
    }

    for (const unit of units) {
        if (buffs.hp) unit.maxHp = Math.round(unit.maxHp * (1 + buffs.hp));
        if (buffs.attack) unit.attack = Math.round(unit.attack * (1 + buffs.attack));
        unit.armor += (buffs.armor || 0);
        unit.evasion = (unit.evasion || 0) + (buffs.evasion || 0);
        unit.critChance = (unit.critChance || 0) + (buffs.critChance || 0);
        unit.shieldChance = (unit.shieldChance || 0) + (buffs.shieldChance || 0);
        unit.pureDamageBonus = (unit.pureDamageBonus || 0) + (buffs.pureDamage || 0);
        unit.spellDamageBonus = (unit.spellDamageBonus || 0) + (buffs.spellDamage || 0);
        unit.attackSpeedBonus = (unit.attackSpeedBonus || 0) + (buffs.attackSpeed || 0);
        unit.currentHp = unit.maxHp;
    }

    return buffs;
}

/* ===== AI 对手生成 ===== */

function isBossRound(round) {
    return BOSS_ROUNDS.includes(round);
}

function createBossUnit(round) {
    const cfg = BOSS_CONFIGS[round];
    if (!cfg) return null;
    return {
        uid: generateUid(),
        defId: cfg.defId,
        name: cfg.name,
        icon: cfg.icon,
        cost: cfg.cost,
        race: 'boss',
        class: 'boss',
        star: 1,
        maxHp: cfg.hp,
        hp: cfg.hp,
        attack: cfg.attack,
        armor: cfg.armor,
        attackSpeed: cfg.attackSpeed,
        range: cfg.range,
        currentHp: 0,
        evasion: 0.05,
        critChance: 0.1,
        shieldChance: 0,
        pureDamageBonus: 0,
        spellDamageBonus: 0,
        attackSpeedBonus: 0,
        isBoss: true,
        enrageAtHpPct: cfg.enrageAtHpPct || 0,
    };
}

function createBossMinion(minionDef) {
    return {
        uid: generateUid(),
        defId: 'boss_minion',
        name: minionDef.name,
        icon: minionDef.icon,
        cost: minionDef.cost,
        race: 'boss', class: 'boss',
        star: 1,
        maxHp: minionDef.hp, hp: minionDef.hp,
        attack: minionDef.attack,
        armor: minionDef.armor,
        attackSpeed: minionDef.attackSpeed,
        range: minionDef.range,
        currentHp: 0, evasion: 0, critChance: 0,
        shieldChance: 0, pureDamageBonus: 0,
        spellDamageBonus: 0, attackSpeedBonus: 0,
        isBoss: false,
    };
}

function generateEnemyArmy(round) {
    if (isBossRound(round)) {
        const boss = createBossUnit(round);
        if (!boss) return [];
        const cfg = BOSS_CONFIGS[round];
        const army = [boss];
        if (cfg.minions) {
            for (const m of cfg.minions) army.push(createBossMinion(m));
        }
        const diff = DIFFICULTY_MODES[gameState.difficulty] || DIFFICULTY_MODES.normal;
        if (diff.enemyMul !== 1.0) {
            for (const u of army) {
                u.maxHp = Math.round(u.maxHp * diff.enemyMul);
                u.hp = u.maxHp;
                u.attack = Math.round(u.attack * diff.enemyMul);
            }
        }
        return army;
    }

    const config = ROUND_CONFIGS[round - 1] || ROUND_CONFIGS[ROUND_CONFIGS.length - 1];
    if (!config) return [];
    const units = [];
    let budgetLeft = config.budget;
    let unitsPlaced = 0;

    const availableUnits = UNIT_DEFS.filter(u => u.cost <= config.maxTier);

    while (unitsPlaced < config.maxUnits && budgetLeft > 0 && availableUnits.length > 0) {
        const affordable = availableUnits.filter(u => u.cost <= budgetLeft);
        if (affordable.length === 0) break;

        const chosen = affordable[Math.floor(Math.random() * affordable.length)];

        let star = 1;
        const r = Math.random();
        if (r < config.starChance3) star = 3;
        else if (r < config.starChance3 + config.starChance2) star = 2;

        const unit = createUnit(chosen.id, star);
        units.push(unit);
        budgetLeft -= chosen.cost * star * star;
        unitsPlaced++;
    }

    const scaling = getEnemyScaling(round);
    const diff = DIFFICULTY_MODES[gameState.difficulty] || DIFFICULTY_MODES.normal;
    for (const u of units) {
        u.maxHp = Math.round(u.maxHp * scaling.hpMul * diff.enemyMul);
        u.hp = u.maxHp;
        u.attack = Math.round(u.attack * scaling.attackMul * diff.enemyMul);
        u.armor += scaling.armorAdd;
    }

    return units;
}

function placeEnemyOnBoard(units) {
    const board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));

    const hasBoss = units.some(u => u.isBoss);
    if (hasBoss) {
        const boss = units.find(u => u.isBoss);
        const minions = units.filter(u => !u.isBoss);
        board[1][3] = boss;
        const minionSlots = [[0, 2], [0, 4], [0, 1], [0, 5], [1, 1], [1, 5]];
        minions.forEach((m, i) => {
            if (minionSlots[i]) board[minionSlots[i][0]][minionSlots[i][1]] = m;
        });
        return board;
    }

    const positions = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            positions.push({ r, c });
        }
    }

    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Prefer front rows for melee, back rows for ranged
    positions.sort((a, b) => a.r - b.r);

    const meleeUnits = units.filter(u => u.range <= 1);
    const rangedUnits = units.filter(u => u.range > 1);

    const frontPositions = positions.filter(p => p.r <= 1);
    const backPositions = positions.filter(p => p.r >= 2);

    let pi = 0;
    for (const unit of meleeUnits) {
        const pos = frontPositions[pi] || positions[pi];
        if (pos) {
            board[pos.r][pos.c] = unit;
            pi++;
        }
    }

    let bi = 0;
    for (const unit of rangedUnits) {
        const pos = backPositions[bi] || positions[pi + bi];
        if (pos && !board[pos.r][pos.c]) {
            board[pos.r][pos.c] = unit;
        } else {
            // find any empty
            for (let r = BOARD_ROWS - 1; r >= 0; r--) {
                for (let c = 0; c < BOARD_COLS; c++) {
                    if (!board[r][c]) {
                        board[r][c] = unit;
                        r = -1;
                        break;
                    }
                }
            }
        }
        bi++;
    }

    return board;
}

/* ===== 自动布阵 ===== */

function autoArrange() {
    if (gameState.phase !== 'prep') return false;

    const boardCount = getBoardUnitCount();
    let canPlace = gameState.maxBoardUnits - boardCount;

    const benchUnits = [];
    for (let i = 0; i < BENCH_SIZE; i++) {
        if (gameState.bench[i]) {
            benchUnits.push({ idx: i, unit: gameState.bench[i] });
        }
    }
    if (benchUnits.length === 0 || canPlace <= 0) return false;

    benchUnits.sort((a, b) => b.unit.cost - a.unit.cost);

    const melee = benchUnits.filter(b => b.unit.range <= 1);
    const ranged = benchUnits.filter(b => b.unit.range > 1);
    const ordered = [...melee, ...ranged];

    const frontCells = [];
    const backCells = [];
    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            if (!gameState.board[r][c]) {
                if (r <= 1) frontCells.push({ r, c });
                else backCells.push({ r, c });
            }
        }
    }

    let placed = 0;
    for (const { idx, unit } of ordered) {
        if (placed >= canPlace) break;
        const isMelee = unit.range <= 1;
        const pool = isMelee ? frontCells : backCells;
        const cell = pool.shift() || (isMelee ? backCells.shift() : frontCells.shift());
        if (cell && !gameState.board[cell.r][cell.c]) {
            gameState.board[cell.r][cell.c] = unit;
            gameState.bench[idx] = null;
            placed++;
        }
    }

    gameState.selectedUnit = null;
    return placed > 0;
}

/* ===== 回合管理 ===== */

function startPrepPhase() {
    if (gameState.round > MAX_ROUND) {
        gameState.phase = 'result';
        return;
    }
    gameState.phase = 'prep';
    if (!gameState.shopLocked) {
        rollShop();
    }
    addXp(gameState.round >= 6 ? 2 : 1);
}

function startCombatPhase() {
    if (gameState.phase !== 'prep') return false;
    if (gameState.round > MAX_ROUND) return false;
    if (getBoardUnitCount() === 0) return false;

    gameState.phase = 'combat';
    gameState.selectedUnit = null;

    if (isBossRound(gameState.round) && BOSS_CONFIGS[gameState.round]) {
        const boss = BOSS_CONFIGS[gameState.round];
        gameState.enemyName = `⚠️ BOSS - ${boss.name}`;
    } else {
        const roundNames = [
            '新手试炼', '林间小径', '暗影峡谷', '雷鸣山谷', '烈焰深渊',
            '冰封冻土', '古老遗迹', '幽暗森林', '末日荒原', '龙巢之心',
        ];
        const nameIdx = Math.floor((gameState.round - 1) / 3) % roundNames.length;
        gameState.enemyName = `第${gameState.round}波 - ${roundNames[nameIdx]}`;
    }
    gameState.enemyHp = 100;

    return true;
}

function endCombat(playerWon, survivingEnemies, combatMeta = {}) {
    const isTimeoutDraw = !!combatMeta.timeoutDraw;
    const currentRound = gameState.round;
    const wasBoss = isBossRound(currentRound);
    let bossReward = 0;
    let damageTaken = 0;

    if (isTimeoutDraw) {
        gameState.winStreak = 0;
        gameState.loseStreak = 0;
    } else if (playerWon) {
        gameState.winStreak++;
        gameState.loseStreak = 0;
        if (wasBoss && BOSS_CONFIGS[currentRound]) {
            bossReward = BOSS_CONFIGS[currentRound].reward;
            gameState.gold += bossReward;
        }
    } else {
        gameState.loseStreak++;
        gameState.winStreak = 0;
        if (currentRound > WARMUP_ROUNDS) {
            const unitDmg = survivingEnemies.reduce((sum, u) => sum + (u.isBoss ? 15 : u.cost * u.star), 0);
            damageTaken = unitDmg + Math.max(1, Math.floor(currentRound / 3));
            gameState.hp = Math.max(0, gameState.hp - damageTaken);
        }
    }

    if (playerWon && gameState.winStreak >= 5) Achievement.unlock('win_streak_5');
    if (playerWon && wasBoss && gameState.sessionStats) {
        gameState.sessionStats.bossesKilled++;
        if (gameState.sessionStats.bossesKilled >= 3) Achievement.unlock('boss_slayer');
    }
    if (playerWon) {
        const boardUnits = [];
        for (let r = 0; r < BOARD_ROWS; r++) for (let c = 0; c < BOARD_COLS; c++) if (gameState.board[r][c]) boardUnits.push(gameState.board[r][c]);
        if (boardUnits.length > 0 && boardUnits.every(u => u.cost === 1)) Achievement.unlock('budget_win');
    }

    const goldInfo = awardRoundGold();
    gameState.phase = 'result';
    gameState.round++;
    const campaignCleared = playerWon && currentRound >= MAX_ROUND;

    if (campaignCleared) {
        Achievement.unlock('first_clear');
        if (gameState.hp >= gameState.maxHp) Achievement.unlock('perfect_clear');
        if (gameState.sessionStats && gameState.sessionStats.racesUsed.size >= 5) Achievement.unlock('all_races');
        Achievement.incrementGames();
    } else if (gameState.hp <= 0) {
        Achievement.incrementGames();
    }

    return {
        playerWon,
        isTimeoutDraw,
        campaignCleared,
        goldInfo,
        bossReward,
        wasBoss,
        isWarmup: currentRound <= WARMUP_ROUNDS,
        damage: damageTaken,
        gameOver: gameState.hp <= 0
    };
}

/* ===== 成就系统 ===== */

const Achievement = {
    _key: 'autochess_achievements',
    _statsKey: 'autochess_stats',

    getAll() {
        try { return JSON.parse(localStorage.getItem(this._key)) || {}; } catch { return {}; }
    },

    getStats() {
        try { return JSON.parse(localStorage.getItem(this._statsKey)) || { gamesPlayed: 0, bestRound: 0, bestHp: 0 }; } catch { return { gamesPlayed: 0, bestRound: 0, bestHp: 0 }; }
    },

    unlock(id) {
        const all = this.getAll();
        if (all[id]) return false;
        all[id] = Date.now();
        try { localStorage.setItem(this._key, JSON.stringify(all)); } catch { /* storage unavailable */ }
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (def && typeof UI !== 'undefined') {
            UI.showToast(`${def.icon} 成就解锁：${def.name}`);
        }
        return true;
    },

    isUnlocked(id) {
        return !!this.getAll()[id];
    },

    incrementGames() {
        const stats = this.getStats();
        stats.gamesPlayed++;
        if (gameState) {
            stats.bestRound = Math.max(stats.bestRound, gameState.round - 1);
            if (gameState.round > MAX_ROUND) {
                stats.bestHp = Math.max(stats.bestHp, gameState.hp);
            }
        }
        try { localStorage.setItem(this._statsKey, JSON.stringify(stats)); } catch { /* storage unavailable */ }
        if (stats.gamesPlayed >= 10) this.unlock('ten_games');
    },
};
