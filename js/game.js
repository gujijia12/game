/* ============================================
   游戏状态管理、商店、经济系统
   ============================================ */

let gameState = null;

function createUnit(defId, star = 1) {
    const def = getUnitDef(defId);
    const mult = STAR_MULTIPLIERS[star];
    return {
        uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
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

function initGameState() {
    gameState = {
        phase: 'prep',          // 'prep' | 'combat' | 'result'
        round: 1,
        hp: BASE_HP,
        maxHp: BASE_HP,
        gold: 5,
        level: 1,
        xp: 0,
        maxBoardUnits: 1,

        winStreak: 0,
        loseStreak: 0,

        board: Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null)),
        bench: Array(BENCH_SIZE).fill(null),

        shop: [],
        shopLocked: false,

        selectedUnit: null,      // { source: 'board'|'bench', row, col }

        combatUnits: null,
        combatLog: [],

        enemyHp: 100,
        enemyName: '',
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

    for (let i = 0; i < SHOP_SIZE; i++) {
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
        }
    }

    const activeSynergies = [];

    for (const [raceId, race] of Object.entries(RACES)) {
        const count = raceCounts[raceId] || 0;
        if (count === 0) continue;

        if (raceId === 'demon') {
            if (uniqueDemons.size === count && count > 0) {
                activeSynergies.push({
                    type: 'race', id: raceId, name: race.name, icon: race.icon,
                    count: count, threshold: 1, active: true,
                    effectKey: 'demon_1'
                });
            }
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

function generateEnemyArmy(round) {
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
        budgetLeft -= chosen.cost * star;
        unitsPlaced++;
    }

    return units;
}

function placeEnemyOnBoard(units) {
    const board = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));

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
    addXp(1);
}

function startCombatPhase() {
    if (gameState.phase !== 'prep') return false;
    if (gameState.round > MAX_ROUND) return false;
    if (getBoardUnitCount() === 0) return false;

    gameState.phase = 'combat';
    gameState.selectedUnit = null;

    const roundNames = [
        '新手试炼', '林间小径', '暗影峡谷', '雷鸣山谷', '烈焰深渊',
        '冰封冻土', '古老遗迹', '幽暗森林', '末日荒原', '龙巢之心',
    ];
    const nameIdx = Math.floor((gameState.round - 1) / 3) % roundNames.length;
    gameState.enemyName = `第${gameState.round}波 - ${roundNames[nameIdx]}`;
    gameState.enemyHp = 100;

    return true;
}

function endCombat(playerWon, survivingEnemies, combatMeta = {}) {
    const isTimeoutDraw = !!combatMeta.timeoutDraw;

    if (isTimeoutDraw) {
        gameState.winStreak = 0;
        gameState.loseStreak = 0;
    } else if (playerWon) {
        gameState.winStreak++;
        gameState.loseStreak = 0;
    } else {
        gameState.loseStreak++;
        gameState.winStreak = 0;
        const damage = survivingEnemies.reduce((sum, u) => sum + u.cost * u.star, 0);
        const roundDamage = Math.max(1, Math.floor(gameState.round / 3));
        const totalDamage = damage + roundDamage;
        gameState.hp = Math.max(0, gameState.hp - totalDamage);
    }

    const goldInfo = awardRoundGold();
    gameState.phase = 'result';
    gameState.shopLocked = false;
    gameState.round++;
    const campaignCleared = gameState.round > MAX_ROUND;

    return {
        playerWon,
        isTimeoutDraw,
        campaignCleared,
        goldInfo,
        damage: (playerWon || isTimeoutDraw) ? 0 : (survivingEnemies.reduce((sum, u) => sum + u.cost * u.star, 0) + Math.max(1, Math.floor((gameState.round - 1) / 3))),
        gameOver: gameState.hp <= 0
    };
}
