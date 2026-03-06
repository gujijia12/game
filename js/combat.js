/* ============================================
   战斗模拟系统 — 含技能/法力/护盾/眩晕
   ============================================ */

class CombatSystem {
    constructor() {
        this.playerUnits = [];
        this.enemyUnits = [];
        this.tickInterval = null;
        this.tickRate = 200;
        this.speedMultiplier = 1;
        this.onTick = null;
        this.onCombatEnd = null;
        this.tickCount = 0;
        this.maxTicks = 500;
        this.combatLog = [];
        this.occupiedCache = null;
    }

    setSpeed(mult) {
        this.speedMultiplier = mult;
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = setInterval(() => this.tick(), this.tickRate / this.speedMultiplier);
        }
    }

    startCombat(playerBoard, enemyBoard, playerSynergies, enemySynergies) {
        this.stop();
        this.playerUnits = [];
        this.enemyUnits = [];
        this.combatLog = [];
        this.tickCount = 0;

        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                if (playerBoard[r][c]) {
                    const u = this.cloneUnitForCombat(playerBoard[r][c]);
                    u.combatRow = BOARD_ROWS + r;
                    u.combatCol = c;
                    u.team = 'player';
                    this.playerUnits.push(u);
                }
                if (enemyBoard[r][c]) {
                    const u = this.cloneUnitForCombat(enemyBoard[r][c]);
                    u.combatRow = r;
                    u.combatCol = c;
                    u.team = 'enemy';
                    this.enemyUnits.push(u);
                }
            }
        }

        const undeadBuff = playerSynergies.find(s => s.id === 'undead' && s.active);
        if (undeadBuff && undeadBuff.effectKey) {
            const effect = SYNERGY_EFFECTS[undeadBuff.effectKey];
            if (effect && effect.stat === 'enemyArmor') {
                for (const u of this.enemyUnits) {
                    u.armor = Math.max(0, u.armor + effect.value);
                }
            }
        }

        applySynergyBuffs(this.playerUnits, playerSynergies.filter(s => s.id !== 'undead'));

        for (const u of [...this.playerUnits, ...this.enemyUnits]) {
            u.currentHp = u.maxHp;
            u.attackCooldown = 0;
            u.target = null;
            u.alive = true;
            u.deathProcessed = false;
            u.baseAttack = u.attack;
            u.baseAttackSpeed = u.attackSpeed;
            const startPct = u.star >= 3 ? 0.4 : u.star >= 2 ? 0.2 : 0;
            u.mana = Math.floor(u.maxMana * startPct);
        }

        this.tickInterval = setInterval(() => this.tick(), this.tickRate / this.speedMultiplier);
    }

    cloneUnitForCombat(unit) {
        const skill = UNIT_SKILLS[unit.defId] || null;
        return {
            ...unit,
            maxHp: unit.maxHp,
            currentHp: unit.maxHp,
            attack: unit.attack,
            armor: unit.armor,
            attackSpeed: unit.attackSpeed,
            range: unit.range,
            evasion: unit.evasion || 0,
            critChance: unit.critChance || 0,
            shieldChance: unit.shieldChance || 0,
            pureDamageBonus: unit.pureDamageBonus || 0,
            spellDamageBonus: unit.spellDamageBonus || 0,
            attackSpeedBonus: unit.attackSpeedBonus || 0,
            attackCooldown: 0,
            target: null,
            alive: true,
            deathProcessed: false,
            combatRow: 0,
            combatCol: 0,
            team: '',
            mana: 0,
            maxMana: skill ? skill.mana : 100,
            skill: skill,
            shield: 0,
            stunnedUntilTick: 0,
            buffs: [],
            baseAttack: unit.attack,
            baseAttackSpeed: unit.attackSpeed,
            damageDealt: 0,
            healingDone: 0,
            isBoss: unit.isBoss || false,
            enrageAtHpPct: unit.enrageAtHpPct || 0,
            enraged: false,
        };
    }

    tick() {
        this.tickCount++;
        const dt = this.tickRate / 1000;

        const playerAliveAtTickStart = this.playerUnits.filter(u => u.alive);
        const enemyAliveAtTickStart = this.enemyUnits.filter(u => u.alive);
        const aliveUnits = [...playerAliveAtTickStart, ...enemyAliveAtTickStart];
        aliveUnits.sort(() => Math.random() - 0.5);
        this.occupiedCache = new Set(aliveUnits.map(u => `${u.combatRow},${u.combatCol}`));

        const events = [];

        for (const unit of aliveUnits) {
            if (unit.isBoss && unit.enrageAtHpPct && !unit.enraged && unit.currentHp <= unit.maxHp * unit.enrageAtHpPct) {
                unit.enraged = true;
                unit.attack = Math.round(unit.attack * 1.5);
                unit.attackSpeedBonus = (unit.attackSpeedBonus || 0) + 0.5;
                events.push({ type: 'skill', unit, skillName: '狂暴化', skillType: 'selfBuff', targets: [unit], totalDamage: 0, healAmount: 0 });
            }

            if (unit.buffs.length > 0) {
                unit.buffs = unit.buffs.filter(buff => {
                    if (this.tickCount >= buff.expiresAtTick) {
                        if (buff.attackIncrease) unit.attack = Math.max(1, unit.attack - buff.attackIncrease);
                        if (buff.asIncrease) unit.attackSpeedBonus = Math.max(0, (unit.attackSpeedBonus || 0) - buff.asIncrease);
                        return false;
                    }
                    return true;
                });
            }
        }

        for (const unit of aliveUnits) {
            if (!unit.alive) continue;

            if (unit.stunnedUntilTick && this.tickCount <= unit.stunnedUntilTick) {
                continue;
            }

            const enemies = unit.team === 'player'
                ? enemyAliveAtTickStart.filter(u => u.alive)
                : playerAliveAtTickStart.filter(u => u.alive);

            if (enemies.length === 0) continue;

            if (unit.mana >= unit.maxMana && unit.skill) {
                const allies = unit.team === 'player'
                    ? playerAliveAtTickStart.filter(u => u.alive)
                    : enemyAliveAtTickStart.filter(u => u.alive);
                if (this.castSkill(unit, allies, enemies, events)) {
                    continue;
                }
            }

            if (!unit.target || !unit.target.alive) {
                unit.target = this.findNearestEnemy(unit, enemies);
            }
            if (!unit.target) continue;

            const dist = this.getDistance(unit, unit.target);

            if (dist <= unit.range) {
                unit.attackCooldown -= dt;
                if (unit.attackCooldown <= 0) {
                    const effectiveAS = unit.attackSpeed * (1 + (unit.attackSpeedBonus || 0));
                    unit.attackCooldown = 1 / effectiveAS;
                    const event = this.performAttack(unit, unit.target);
                    events.push(event);
                }
            } else {
                this.moveToward(unit, unit.target);
                unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
                events.push({
                    type: 'move',
                    unit: unit,
                    row: unit.combatRow,
                    col: unit.combatCol
                });
            }
        }

        const allUnits = [...this.playerUnits, ...this.enemyUnits];
        for (const unit of allUnits) {
            if (!unit.alive && !unit.deathProcessed) {
                events.push({ type: 'death', unit: unit });
                unit.deathProcessed = true;
            }
        }

        if (this.onTick) {
            this.onTick(events, allUnits);
        }

        this.occupiedCache = null;

        const playerAlive = this.playerUnits.filter(u => u.alive);
        const enemyAlive = this.enemyUnits.filter(u => u.alive);

        if (playerAlive.length === 0 || enemyAlive.length === 0 || this.tickCount >= this.maxTicks) {
            const timedOut = this.tickCount >= this.maxTicks && playerAlive.length > 0 && enemyAlive.length > 0;
            const mutualKill = playerAlive.length === 0 && enemyAlive.length === 0;
            clearInterval(this.tickInterval);
            this.tickInterval = null;

            const playerWon = enemyAlive.length === 0 && playerAlive.length > 0;
            const surviving = playerWon ? [] : enemyAlive;

            const dpsStats = this.buildDpsStats();

            setTimeout(() => {
                if (this.onCombatEnd) {
                    this.onCombatEnd(playerWon, surviving, { timeoutDraw: timedOut || mutualKill, dpsStats });
                }
            }, 500);
        }
    }

    performAttack(attacker, target) {
        let baseDamage = attacker.attack;
        let isCrit = false;

        if (Math.random() < (attacker.critChance || 0)) {
            baseDamage = Math.round(baseDamage * 2);
            isCrit = true;
        }

        if (Math.random() < (target.evasion || 0)) {
            attacker.mana = Math.min((attacker.mana || 0) + MANA_ON_ATTACK, attacker.maxMana);
            return {
                type: 'miss',
                attacker: attacker,
                target: target,
                damage: 0
            };
        }

        let physicalDamage = baseDamage;
        if (attacker.spellDamageBonus > 0) {
            physicalDamage += Math.round(attacker.attack * attacker.spellDamageBonus * 0.5);
        }
        const armorReduction = target.armor / (target.armor + 100);
        physicalDamage = Math.round(physicalDamage * (1 - armorReduction));

        let pureDamage = 0;
        if (attacker.pureDamageBonus > 0) {
            pureDamage = Math.round(attacker.attack * attacker.pureDamageBonus);
        }

        let damage = Math.max(1, physicalDamage + pureDamage);

        const shieldChance = target.shieldChance || 0;
        if (shieldChance > 0 && Math.random() < shieldChance) {
            const shieldPct = shieldChance >= 0.4 ? 0.35 : 0.25;
            const shieldAmount = Math.round(target.maxHp * shieldPct);
            damage = Math.max(0, damage - shieldAmount);
        }

        if (target.shield > 0) {
            const absorbed = Math.min(target.shield, damage);
            target.shield -= absorbed;
            damage -= absorbed;
        }

        target.currentHp -= damage;
        attacker.damageDealt = (attacker.damageDealt || 0) + damage;

        attacker.mana = Math.min((attacker.mana || 0) + MANA_ON_ATTACK, attacker.maxMana);
        if (target.currentHp > 0 && damage > 0) {
            target.mana = Math.min((target.mana || 0) + MANA_ON_HIT, target.maxMana);
        }

        if (target.currentHp <= 0) {
            target.currentHp = 0;
            target.alive = false;
            if (this.occupiedCache) {
                this.occupiedCache.delete(`${target.combatRow},${target.combatCol}`);
            }
        }

        this.combatLog.push(
            `${attacker.name}${attacker.star > 1 ? '★'.repeat(attacker.star) : ''} ` +
            `→ ${target.name} ${isCrit ? '暴击!' : ''} ${damage}伤害` +
            `${!target.alive ? ' [击杀]' : ''}`
        );

        return {
            type: 'attack',
            attacker: attacker,
            target: target,
            damage: damage,
            isCrit: isCrit,
            targetDied: !target.alive
        };
    }

    /* ===== 技能系统 ===== */

    castSkill(unit, allies, enemies, events) {
        const skill = unit.skill;
        if (!skill) return false;

        unit.mana = 0;
        let totalDamage = 0;
        let targets = [];
        let healAmount = 0;

        switch (skill.type) {
            case 'singleDamage': {
                const t = unit.target || this.findNearestEnemy(unit, enemies);
                if (!t) { unit.mana = unit.maxMana; return false; }
                totalDamage = this.dealSkillDamage(unit, t, skill.multiplier * unit.attack, false);
                targets = [t];
                break;
            }
            case 'pureDamage': {
                const t = unit.target || this.findNearestEnemy(unit, enemies);
                if (!t) { unit.mana = unit.maxMana; return false; }
                totalDamage = this.dealSkillDamage(unit, t, skill.multiplier * unit.attack, true);
                targets = [t];
                break;
            }
            case 'aoe': {
                const center = unit.target || this.findNearestEnemy(unit, enemies);
                if (!center) { unit.mana = unit.maxMana; return false; }
                const inRange = enemies.filter(e => e.alive && this.getDistance(center, e) <= skill.radius);
                for (const t of inRange) {
                    totalDamage += this.dealSkillDamage(unit, t, skill.multiplier * unit.attack, false);
                    if (skill.stunTicks && t.alive) {
                        t.stunnedUntilTick = Math.max(t.stunnedUntilTick || 0, this.tickCount + skill.stunTicks);
                    }
                }
                targets = inRange;
                break;
            }
            case 'damageAll': {
                const alive = enemies.filter(e => e.alive);
                for (const t of alive) {
                    totalDamage += this.dealSkillDamage(unit, t, skill.multiplier * unit.attack, false);
                }
                targets = alive;
                break;
            }
            case 'multiShot': {
                const shuffled = enemies.filter(e => e.alive).sort(() => Math.random() - 0.5);
                const chosen = shuffled.slice(0, skill.targets);
                for (const t of chosen) {
                    totalDamage += this.dealSkillDamage(unit, t, skill.multiplier * unit.attack, false);
                }
                targets = chosen;
                break;
            }
            case 'multiHit': {
                const t = unit.target || this.findNearestEnemy(unit, enemies);
                if (!t) { unit.mana = unit.maxMana; return false; }
                for (let i = 0; i < skill.hits; i++) {
                    if (!t.alive) break;
                    totalDamage += this.dealSkillDamage(unit, t, skill.multiplier * unit.attack, false);
                }
                targets = [t];
                break;
            }
            case 'chainDamage': {
                let current = unit.target || this.findNearestEnemy(unit, enemies);
                if (!current) { unit.mana = unit.maxMana; return false; }
                const hitSet = new Set();
                for (let i = 0; i < skill.targets; i++) {
                    if (!current || !current.alive) break;
                    totalDamage += this.dealSkillDamage(unit, current, skill.multiplier * unit.attack, false);
                    hitSet.add(current);
                    targets.push(current);
                    const remaining = enemies.filter(e => e.alive && !hitSet.has(e));
                    current = remaining.length > 0 ? this.findNearestEnemy(current, remaining) : null;
                }
                break;
            }
            case 'selfShield': {
                const shieldAmt = Math.round(skill.value * unit.maxHp);
                unit.shield = Math.min((unit.shield || 0) + shieldAmt, unit.maxHp);
                targets = [unit];
                break;
            }
            case 'selfBuff': {
                const attackIncrease = Math.round(unit.baseAttack * skill.attackMul);
                unit.attack += attackIncrease;
                unit.attackSpeedBonus = (unit.attackSpeedBonus || 0) + skill.asMul;
                unit.buffs.push({
                    attackIncrease,
                    asIncrease: skill.asMul,
                    expiresAtTick: this.tickCount + skill.duration
                });
                targets = [unit];
                break;
            }
            case 'healAll': {
                const aliveAllies = allies.filter(a => a.alive);
                for (const ally of aliveAllies) {
                    const heal = Math.round(skill.value * ally.maxHp);
                    const actualHeal = Math.min(heal, ally.maxHp - ally.currentHp);
                    ally.currentHp += actualHeal;
                    healAmount += actualHeal;
                }
                unit.healingDone = (unit.healingDone || 0) + healAmount;
                targets = aliveAllies;
                break;
            }
            case 'stunDamage': {
                const t = unit.target || this.findNearestEnemy(unit, enemies);
                if (!t) { unit.mana = unit.maxMana; return false; }
                totalDamage = this.dealSkillDamage(unit, t, skill.multiplier * unit.attack, false);
                if (t.alive) {
                    t.stunnedUntilTick = Math.max(t.stunnedUntilTick || 0, this.tickCount + skill.stunTicks);
                }
                targets = [t];
                break;
            }
            default:
                unit.mana = unit.maxMana;
                return false;
        }

        events.push({
            type: 'skill',
            unit: unit,
            skillName: skill.name,
            skillType: skill.type,
            targets: targets,
            totalDamage: totalDamage,
            healAmount: healAmount,
        });

        return true;
    }

    dealSkillDamage(attacker, target, rawDamage, ignoreArmor) {
        let damage = Math.round(rawDamage);

        if (attacker.spellDamageBonus > 0) {
            damage = Math.round(damage * (1 + attacker.spellDamageBonus));
        }
        if (ignoreArmor && attacker.pureDamageBonus > 0) {
            damage = Math.round(damage * (1 + attacker.pureDamageBonus));
        }

        if (Math.random() < (target.evasion || 0)) return 0;

        if (!ignoreArmor) {
            const armorReduction = target.armor / (target.armor + 100);
            damage = Math.round(damage * (1 - armorReduction));
        }
        damage = Math.max(1, damage);

        if (target.shield > 0) {
            const absorbed = Math.min(target.shield, damage);
            target.shield -= absorbed;
            damage -= absorbed;
        }

        target.currentHp -= damage;
        attacker.damageDealt = (attacker.damageDealt || 0) + damage;

        if (target.currentHp > 0 && damage > 0) {
            target.mana = Math.min((target.mana || 0) + MANA_ON_HIT, target.maxMana);
        }

        if (target.currentHp <= 0) {
            target.currentHp = 0;
            target.alive = false;
            if (this.occupiedCache) {
                this.occupiedCache.delete(`${target.combatRow},${target.combatCol}`);
            }
        }

        return damage;
    }

    /* ===== DPS 统计 ===== */

    buildDpsStats() {
        const player = this.playerUnits
            .filter(u => u.damageDealt > 0 || u.healingDone > 0)
            .sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));
        const enemy = this.enemyUnits
            .filter(u => u.damageDealt > 0)
            .sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));
        return { player, enemy };
    }

    /* ===== 寻路 & 距离 ===== */

    findNearestEnemy(unit, enemies) {
        let nearest = null;
        let minDist = Infinity;

        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const dist = this.getDistance(unit, enemy);
            if (dist < minDist) {
                minDist = dist;
                nearest = enemy;
            }
        }

        return nearest;
    }

    getDistance(a, b) {
        return Math.max(Math.abs(a.combatRow - b.combatRow), Math.abs(a.combatCol - b.combatCol));
    }

    moveToward(unit, target) {
        const preferredForward = unit.team === 'player' ? -1 : 1;
        const towardRow = Math.sign(target.combatRow - unit.combatRow);
        const towardCol = Math.sign(target.combatCol - unit.combatCol);

        const candidates = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = unit.combatRow + dr;
                const nc = unit.combatCol + dc;
                if (this.isOccupied(nr, nc, unit)) continue;

                const targetDist = Math.abs(target.combatRow - nr) + Math.abs(target.combatCol - nc);
                let dirPenalty = 0.2;
                if (dr === preferredForward) dirPenalty = 0;
                else if (dr === 0) dirPenalty = 0.15;
                else if (dr === -preferredForward) dirPenalty = 0.6;

                const rowAlignPenalty = dr === towardRow ? 0 : 0.05;
                const colAlignPenalty = dc === towardCol ? 0 : 0.05;
                const score = targetDist + dirPenalty + rowAlignPenalty + colAlignPenalty;
                candidates.push({ nr, nc, score });
            }
        }

        if (candidates.length === 0) return;
        candidates.sort((a, b) => a.score - b.score);
        const best = candidates[0];

        if (this.occupiedCache) {
            this.occupiedCache.delete(`${unit.combatRow},${unit.combatCol}`);
        }
        unit.combatRow = best.nr;
        unit.combatCol = best.nc;
        if (this.occupiedCache) {
            this.occupiedCache.add(`${unit.combatRow},${unit.combatCol}`);
        }
    }

    isOccupied(row, col, excludeUnit) {
        if (row < 0 || row >= BOARD_ROWS * 2 || col < 0 || col >= BOARD_COLS) return true;
        if (excludeUnit && row === excludeUnit.combatRow && col === excludeUnit.combatCol) return false;
        if (this.occupiedCache) {
            return this.occupiedCache.has(`${row},${col}`);
        }
        const all = [...this.playerUnits, ...this.enemyUnits];
        return all.some(u => u.alive && u !== excludeUnit && u.combatRow === row && u.combatCol === col);
    }

    getAllUnits() {
        return [...this.playerUnits, ...this.enemyUnits];
    }

    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
}

const combatSystem = new CombatSystem();
