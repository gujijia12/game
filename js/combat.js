/* ============================================
   战斗模拟系统
   ============================================ */

class CombatSystem {
    constructor() {
        this.playerUnits = [];
        this.enemyUnits = [];
        this.tickInterval = null;
        this.tickRate = 200;
        this.onTick = null;
        this.onCombatEnd = null;
        this.tickCount = 0;
        this.maxTicks = 500;
        this.combatLog = [];
    }

    startCombat(playerBoard, enemyBoard, playerSynergies, enemySynergies) {
        this.playerUnits = [];
        this.enemyUnits = [];
        this.combatLog = [];
        this.tickCount = 0;

        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                if (playerBoard[r][c]) {
                    const u = this.cloneUnitForCombat(playerBoard[r][c]);
                    u.combatRow = BOARD_ROWS + (BOARD_ROWS - 1 - r);
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

        for (const u of this.playerUnits) {
            u.currentHp = u.maxHp;
            u.attackCooldown = 0;
            u.target = null;
            u.alive = true;
            u.deathProcessed = false;
        }
        for (const u of this.enemyUnits) {
            u.currentHp = u.maxHp;
            u.attackCooldown = 0;
            u.target = null;
            u.alive = true;
            u.deathProcessed = false;
        }

        this.tickInterval = setInterval(() => this.tick(), this.tickRate);
    }

    cloneUnitForCombat(unit) {
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
            attackSpeedBonus: unit.attackSpeedBonus || 0,
            attackCooldown: 0,
            target: null,
            alive: true,
            deathProcessed: false,
            combatRow: 0,
            combatCol: 0,
            team: '',
        };
    }

    tick() {
        this.tickCount++;
        const dt = this.tickRate / 1000;

        const aliveUnits = [...this.playerUnits, ...this.enemyUnits].filter(u => u.alive);
        aliveUnits.sort(() => Math.random() - 0.5);

        const events = [];

        for (const unit of aliveUnits) {
            if (!unit.alive) continue;

            const enemies = unit.team === 'player'
                ? this.enemyUnits.filter(u => u.alive)
                : this.playerUnits.filter(u => u.alive);

            if (enemies.length === 0) continue;

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

        const playerAlive = this.playerUnits.filter(u => u.alive);
        const enemyAlive = this.enemyUnits.filter(u => u.alive);

        if (playerAlive.length === 0 || enemyAlive.length === 0 || this.tickCount >= this.maxTicks) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;

            const playerWon = enemyAlive.length === 0 && playerAlive.length > 0;
            const surviving = playerWon ? [] : enemyAlive;

            setTimeout(() => {
                if (this.onCombatEnd) {
                    this.onCombatEnd(playerWon, surviving);
                }
            }, 500);
        }
    }

    performAttack(attacker, target) {
        let damage = attacker.attack;
        let isCrit = false;

        if (Math.random() < (attacker.critChance || 0)) {
            damage = Math.round(damage * 2);
            isCrit = true;
        }

        if (attacker.pureDamageBonus > 0) {
            damage += Math.round(attacker.attack * attacker.pureDamageBonus);
        }

        if (Math.random() < (target.evasion || 0)) {
            return {
                type: 'miss',
                attacker: attacker,
                target: target,
                damage: 0
            };
        }

        const armorReduction = target.armor / (target.armor + 100);
        damage = Math.round(damage * (1 - armorReduction));
        damage = Math.max(1, damage);

        if ((target.shieldChance || 0) > 0 && Math.random() < target.shieldChance) {
            const shieldAmount = Math.round(target.maxHp * 0.3);
            damage = Math.max(0, damage - shieldAmount);
        }

        target.currentHp -= damage;

        if (target.currentHp <= 0) {
            target.currentHp = 0;
            target.alive = false;
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

    findNearestEnemy(unit, enemies) {
        let nearest = null;
        let minDist = Infinity;

        for (const enemy of enemies) {
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
        const dr = Math.sign(target.combatRow - unit.combatRow);
        const dc = Math.sign(target.combatCol - unit.combatCol);

        const newRow = unit.combatRow + dr;
        const newCol = unit.combatCol + dc;

        if (!this.isOccupied(newRow, newCol, unit)) {
            unit.combatRow = newRow;
            unit.combatCol = newCol;
        } else {
            if (dr !== 0 && !this.isOccupied(unit.combatRow + dr, unit.combatCol, unit)) {
                unit.combatRow += dr;
            } else if (dc !== 0 && !this.isOccupied(unit.combatRow, unit.combatCol + dc, unit)) {
                unit.combatCol += dc;
            }
        }
    }

    isOccupied(row, col, excludeUnit) {
        if (row < 0 || row >= BOARD_ROWS * 2 || col < 0 || col >= BOARD_COLS) return true;
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
