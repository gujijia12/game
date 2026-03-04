/* ============================================
   UI 渲染、交互事件
   ============================================ */

const UI = {
    elements: {},
    playerBoardCells: [],
    enemyBoardCells: [],
    benchCells: [],
    combatUnitElements: new Map(),

    isMobile: false,
    battleStarting: false,
    resultTransitioning: false,
    maxFloatingNumbers: 50,

    init() {
        this.isMobile = window.innerWidth <= 768;
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
        });

        this.elements = {
            roundNum: document.getElementById('round-num'),
            hpBar: document.getElementById('hp-bar'),
            hpText: document.getElementById('hp-text'),
            levelNum: document.getElementById('level-num'),
            xpBar: document.getElementById('xp-bar'),
            goldNum: document.getElementById('gold-num'),
            phaseText: document.getElementById('phase-text'),

            enemyInfo: document.getElementById('enemy-info'),
            enemyName: document.getElementById('enemy-name'),
            enemyHpText: document.getElementById('enemy-hp-text'),

            playerBoard: document.getElementById('player-board'),
            enemyBoard: document.getElementById('enemy-board'),
            benchGrid: document.getElementById('bench-grid'),

            shopUnits: document.getElementById('shop-units'),
            btnReroll: document.getElementById('btn-reroll'),
            btnBuyXp: document.getElementById('btn-buy-xp'),
            btnLock: document.getElementById('btn-lock'),
            btnReady: document.getElementById('btn-ready'),
            btnSell: document.getElementById('btn-sell'),

            synergyList: document.getElementById('synergy-list'),

            combatLog: document.getElementById('combat-log'),
            unitDetail: document.getElementById('unit-detail'),
            unitDetailContent: document.getElementById('unit-detail-content'),

            battleResult: document.getElementById('battle-result'),
            resultTitle: document.getElementById('result-title'),
            resultDetail: document.getElementById('result-detail'),
            btnContinue: document.getElementById('btn-continue'),

            gameOver: document.getElementById('game-over'),
            gameOverDetail: document.getElementById('game-over-detail'),
            btnRestart: document.getElementById('btn-restart'),

            startScreen: document.getElementById('start-screen'),
            btnStart: document.getElementById('btn-start'),

            floatingNumbers: document.getElementById('floating-numbers'),

            btnToggleSynergy: document.getElementById('btn-toggle-synergy'),
            btnToggleDetail: document.getElementById('btn-toggle-detail'),
            mobileSynergyOverlay: document.getElementById('mobile-synergy-overlay'),
            mobileDetailOverlay: document.getElementById('mobile-detail-overlay'),
            mobileSynergyList: document.getElementById('mobile-synergy-list'),
            mobileUnitDetailContent: document.getElementById('mobile-unit-detail-content'),
            btnShare: document.getElementById('btn-share'),
        };

        this.buildBoards();
        this.bindEvents();
    },

    buildBoards() {
        this.elements.playerBoard.innerHTML = '';
        this.elements.enemyBoard.innerHTML = '';
        this.elements.benchGrid.innerHTML = '';
        this.playerBoardCells = [];
        this.enemyBoardCells = [];
        this.benchCells = [];

        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                const cell = document.createElement('div');
                cell.className = 'board-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.dataset.source = 'board';
                this.elements.playerBoard.appendChild(cell);
                this.playerBoardCells.push(cell);
            }
        }

        for (let r = 0; r < BOARD_ROWS; r++) {
            for (let c = 0; c < BOARD_COLS; c++) {
                const cell = document.createElement('div');
                cell.className = 'board-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.dataset.source = 'enemy';
                this.elements.enemyBoard.appendChild(cell);
                this.enemyBoardCells.push(cell);
            }
        }

        for (let c = 0; c < BENCH_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'bench-cell';
            cell.dataset.col = c;
            cell.dataset.source = 'bench';
            this.elements.benchGrid.appendChild(cell);
            this.benchCells.push(cell);
        }
    },

    bindEvents() {
        this.elements.playerBoard.addEventListener('click', (e) => {
            const cell = e.target.closest('.board-cell');
            if (!cell || gameState.phase !== 'prep') return;
            this.handleBoardClick('board', parseInt(cell.dataset.row), parseInt(cell.dataset.col));
        });

        this.elements.benchGrid.addEventListener('click', (e) => {
            const cell = e.target.closest('.bench-cell');
            if (!cell || gameState.phase !== 'prep') return;
            this.handleBoardClick('bench', 0, parseInt(cell.dataset.col));
        });

        this.elements.shopUnits.addEventListener('click', (e) => {
            const card = e.target.closest('.shop-card');
            if (!card) return;
            const idx = parseInt(card.dataset.index);
            if (buyUnit(idx)) {
                this.renderAll();
            }
        });

        this.elements.btnReroll.addEventListener('click', () => {
            if (rerollShop()) this.renderAll();
        });

        this.elements.btnBuyXp.addEventListener('click', () => {
            if (buyXp()) this.renderAll();
        });

        this.elements.btnLock.addEventListener('click', () => {
            toggleShopLock();
            this.renderAll();
        });

        this.elements.btnReady.addEventListener('click', () => {
            this.startBattle();
        });

        this.elements.btnSell.addEventListener('click', () => {
            if (gameState.selectedUnit) {
                const sel = gameState.selectedUnit;
                sellUnit(sel.source, sel.row, sel.col);
                this.renderAll();
            }
        });

        this.elements.btnContinue.addEventListener('click', () => {
            if (this.resultTransitioning) return;
            if (gameState.phase !== 'result') return;
            if (this.elements.battleResult.classList.contains('hidden')) return;
            this.resultTransitioning = true;
            this.elements.btnContinue.disabled = true;
            this.elements.battleResult.classList.add('hidden');
            this.battleStarting = false;
            if (gameState.hp <= 0) {
                this.showGameOver();
                this.finishResultTransition();
                return;
            }
            if (gameState.round > MAX_ROUND) {
                this.resetUITransientState();
                initGameState();
                AdManager.resetSession();
                startPrepPhase();
                this.renderAll();
                this.finishResultTransition();
                return;
            }
            this.resetUITransientState();
            startPrepPhase();
            this.renderAll();
            this.finishResultTransition();
        });

        this.elements.btnRestart.addEventListener('click', () => {
            this.resultTransitioning = false;
            this.elements.gameOver.classList.add('hidden');
            this.battleStarting = false;
            this.resetUITransientState();
            initGameState();
            AdManager.resetSession();
            startPrepPhase();
            this.renderAll();
        });

        this.elements.btnStart.addEventListener('click', () => {
            this.resultTransitioning = false;
            this.elements.startScreen.classList.add('hidden');
            this.battleStarting = false;
            this.resetUITransientState();
            initGameState();
            AdManager.resetSession();
            startPrepPhase();
            this.renderAll();
        });

        // Right-click to sell (desktop)
        document.addEventListener('contextmenu', (e) => {
            const cell = e.target.closest('.board-cell, .bench-cell');
            if (!cell || gameState.phase !== 'prep') return;

            e.preventDefault();
            const source = cell.dataset.source;
            const row = parseInt(cell.dataset.row || 0);
            const col = parseInt(cell.dataset.col);

            if (source === 'bench' && gameState.bench[col]) {
                sellUnit('bench', 0, col);
                this.renderAll();
            } else if (source === 'board' && gameState.board[row] && gameState.board[row][col]) {
                sellUnit('board', row, col);
                this.renderAll();
            }
        });

        // Mobile panel toggles
        if (this.elements.btnToggleSynergy) {
            this.elements.btnToggleSynergy.addEventListener('click', () => {
                this.renderMobileSynergies();
                this.elements.mobileSynergyOverlay.classList.remove('hidden');
            });
        }

        if (this.elements.btnToggleDetail) {
            this.elements.btnToggleDetail.addEventListener('click', () => {
                if (!this.elements.mobileUnitDetailContent?.innerHTML.trim()) return;
                this.elements.mobileDetailOverlay.classList.remove('hidden');
            });
        }

        document.querySelectorAll('.mobile-overlay-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.close;
                document.getElementById(targetId)?.classList.add('hidden');
            });
        });

        document.querySelectorAll('.mobile-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });

        // Share buttons
        if (this.elements.btnShare) {
            this.elements.btnShare.addEventListener('click', () => {
                this.handleShare();
            });
        }

        const btnShareGameover = document.getElementById('btn-share-gameover');
        if (btnShareGameover) {
            btnShareGameover.addEventListener('click', () => {
                this.handleShare();
            });
        }
    },

    handleBoardClick(source, row, col) {
        const selected = gameState.selectedUnit;

        if (selected) {
            if (selected.source === source && selected.row === row && selected.col === col) {
                gameState.selectedUnit = null;
                this.renderAll();
                return;
            }

            const fromUnit = selected.source === 'bench'
                ? gameState.bench[selected.col]
                : gameState.board[selected.row][selected.col];

            if (source === 'board') {
                const targetUnit = gameState.board[row][col];
                if (!targetUnit && selected.source === 'bench' && !canPlaceOnBoard()) {
                    gameState.selectedUnit = null;
                    this.renderAll();
                    return;
                }
            }

            moveUnit(selected.source, selected.row, selected.col, source, row, col);
            this.renderAll();
        } else {
            let unit = null;
            if (source === 'bench') {
                unit = gameState.bench[col];
            } else if (source === 'board') {
                unit = gameState.board[row][col];
            }

            if (unit) {
                gameState.selectedUnit = { source, row, col };
                this.showUnitDetail(unit);
                this.renderAll();
            }
        }
    },

    /* ===== 渲染方法 ===== */

    renderAll() {
        this.renderTopBar();
        this.renderPlayerBoard();
        this.renderEnemyBoard(null);
        this.renderBench();
        this.renderShop();
        this.renderSynergies();
        this.renderControls();
    },

    renderTopBar() {
        this.elements.roundNum.textContent = gameState.round;
        this.elements.hpText.textContent = gameState.hp;
        const hpPercent = (gameState.hp / gameState.maxHp) * 100;
        this.elements.hpBar.style.width = hpPercent + '%';
        this.elements.hpBar.className = hpPercent <= 30 ? 'low' : '';

        this.elements.levelNum.textContent = gameState.level;
        const nextLevelXp = gameState.level < 9 ? XP_PER_LEVEL[gameState.level + 1] : 0;
        const xpPercent = nextLevelXp > 0 ? (gameState.xp / nextLevelXp) * 100 : 100;
        this.elements.xpBar.style.width = xpPercent + '%';

        this.elements.goldNum.textContent = gameState.gold;

        const phaseLabels = { prep: '准备阶段', combat: '⚔️ 战斗中', result: '结算' };
        this.elements.phaseText.textContent = phaseLabels[gameState.phase] || '';
        this.elements.phaseText.className = 'phase-label' + (gameState.phase === 'combat' ? ' combat' : '');
    },

    renderPlayerBoard() {
        this.playerBoardCells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            const unit = gameState.board[r][c];

            cell.innerHTML = '';
            cell.classList.remove('selected', 'valid-target');

            if (unit) {
                cell.appendChild(this.createUnitElement(unit, false));
            }

            if (gameState.selectedUnit) {
                const sel = gameState.selectedUnit;
                if (sel.source === 'board' && sel.row === r && sel.col === c) {
                    cell.classList.add('selected');
                }
                if (!unit || (sel.source !== 'board' || sel.row !== r || sel.col !== c)) {
                    if (gameState.selectedUnit.source === 'bench' && unit === null && canPlaceOnBoard()) {
                        cell.classList.add('valid-target');
                    } else if (unit) {
                        cell.classList.add('valid-target');
                    }
                }
            }
        });

        const existingIndicator = document.querySelector('.board-count-indicator');
        if (existingIndicator) existingIndicator.remove();

        const indicator = document.createElement('div');
        indicator.className = 'board-count-indicator';
        const count = getBoardUnitCount();
        const max = gameState.maxBoardUnits;
        const cls = count > max ? 'over-limit' : 'current';
        indicator.innerHTML = `棋盘: <span class="${cls}">${count}</span> / ${max}`;
        this.elements.playerBoard.parentNode.insertBefore(indicator, this.elements.playerBoard.nextSibling);
    },

    renderEnemyBoard(combatUnits) {
        this.enemyBoardCells.forEach(cell => {
            cell.innerHTML = '';
        });

        if (!combatUnits) return;

        const enemyUnits = combatUnits.filter(u => u.team === 'enemy' && u.alive);
        for (const unit of enemyUnits) {
            const r = unit.combatRow;
            const c = unit.combatCol;
            if (r >= 0 && r < BOARD_ROWS) {
                const cellIdx = r * BOARD_COLS + c;
                const cell = this.enemyBoardCells[cellIdx];
                if (cell) {
                    cell.appendChild(this.createUnitElement(unit, true, true));
                }
            }
        }
    },

    renderCombatBoard(allUnits) {
        const playerCells = this.playerBoardCells;
        const enemyCells = this.enemyBoardCells;
        this.combatUnitElements.clear();

        playerCells.forEach(cell => { cell.innerHTML = ''; });
        enemyCells.forEach(cell => { cell.innerHTML = ''; });

        for (const unit of allUnits) {
            if (!unit.alive) continue;

            if (unit.combatRow >= BOARD_ROWS) {
                const displayRow = unit.combatRow - BOARD_ROWS;
                const cellIdx = displayRow * BOARD_COLS + unit.combatCol;
                const cell = playerCells[cellIdx];
                if (cell) {
                    const unitEl = this.createUnitElement(unit, true, unit.team === 'enemy');
                    cell.appendChild(unitEl);
                    this.combatUnitElements.set(unit.uid, unitEl);
                }
            } else {
                const displayRow = unit.combatRow;
                const cellIdx = displayRow * BOARD_COLS + unit.combatCol;
                const cell = enemyCells[cellIdx];
                if (cell) {
                    const unitEl = this.createUnitElement(unit, true, unit.team === 'enemy');
                    cell.appendChild(unitEl);
                    this.combatUnitElements.set(unit.uid, unitEl);
                }
            }
        }
    },

    renderBench() {
        this.benchCells.forEach((cell, i) => {
            cell.innerHTML = '';
            cell.classList.remove('selected');
            const unit = gameState.bench[i];
            if (unit) {
                cell.appendChild(this.createUnitElement(unit, false));
            }

            if (gameState.selectedUnit && gameState.selectedUnit.source === 'bench' && gameState.selectedUnit.col === i) {
                cell.classList.add('selected');
            }
        });
    },

    renderShop() {
        this.elements.shopUnits.innerHTML = '';
        for (let i = 0; i < gameState.shop.length; i++) {
            const item = gameState.shop[i];
            const def = getUnitDef(item.defId);
            const race = RACES[def.race];
            const cls = CLASSES[def.class];

            const card = document.createElement('div');
            card.className = `shop-card tier-${def.cost}${item.sold ? ' sold' : ''}`;
            card.dataset.index = i;

            card.innerHTML = `
                <div class="unit-icon">${def.icon}</div>
                <div class="shop-card-name">${def.name}</div>
                <div class="shop-card-tags">${race.icon}${race.name} ${cls.icon}${cls.name}</div>
                <div class="shop-card-cost">💰 ${def.cost}</div>
            `;

            card.addEventListener('mouseenter', () => {
                this.showUnitDefDetail(def);
            });
            card.addEventListener('touchstart', () => {
                this.showUnitDefDetail(def);
            }, { passive: true });

            this.elements.shopUnits.appendChild(card);
        }
    },

    renderSynergies() {
        const synergies = calculateSynergies();
        this.elements.synergyList.innerHTML = '';

        synergies.sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            return b.count - a.count;
        });

        for (const syn of synergies) {
            const item = document.createElement('div');
            item.className = `synergy-item ${syn.active ? 'active' : 'inactive'}`;

            let thresholdStr = '';
            if (syn.thresholds) {
                thresholdStr = syn.thresholds.map(t =>
                    syn.count >= t ? `<b>${t}</b>` : t
                ).join('/');
            } else {
                thresholdStr = syn.count >= syn.threshold ? `<b>${syn.threshold}</b>` : `${syn.threshold}`;
            }

            item.innerHTML = `
                <span class="synergy-icon">${syn.icon}</span>
                <span class="synergy-count ${syn.active ? 'active' : ''}">${syn.count}/${thresholdStr}</span>
                <span class="synergy-name">${syn.name}</span>
                ${syn.active ? `<span class="synergy-bonus">${syn.bonusText || ''}</span>` : ''}
            `;

            this.elements.synergyList.appendChild(item);
        }
    },

    renderControls() {
        const inPrep = gameState.phase === 'prep';
        this.elements.btnReroll.disabled = !inPrep || gameState.gold < REROLL_COST;
        this.elements.btnBuyXp.disabled = !inPrep || gameState.gold < BUY_XP_COST || gameState.level >= 9;
        this.elements.btnReady.disabled = !inPrep || getBoardUnitCount() === 0;
        this.elements.btnSell.disabled = !inPrep || !gameState.selectedUnit;
        this.elements.btnLock.textContent = gameState.shopLocked ? '🔓 解锁' : '🔒 锁定';
        this.elements.btnLock.disabled = !inPrep;
    },

    /* ===== 棋子元素创建 ===== */

    createUnitElement(unit, isCombat = false, isEnemy = false) {
        const el = document.createElement('div');
        el.className = `unit tier-${unit.cost}${isEnemy ? ' enemy-unit' : ''}`;

        const starsText = '⭐'.repeat(unit.star);
        const starClass = `star-${unit.star}`;

        let hpPercent = 100;
        if (isCombat && unit.maxHp > 0) {
            hpPercent = Math.max(0, (unit.currentHp / unit.maxHp) * 100);
        }

        let hpClass = '';
        if (hpPercent <= 30) hpClass = 'low';
        else if (hpPercent <= 60) hpClass = 'medium';

        el.innerHTML = `
            <span class="unit-stars ${starClass}">${starsText}</span>
            <span class="unit-icon">${unit.icon}</span>
            ${isCombat ? `
                <div class="unit-hp-bar">
                    <div class="unit-hp-fill ${hpClass}" style="width: ${hpPercent}%"></div>
                </div>
            ` : ''}
        `;

        el.dataset.uid = unit.uid;
        return el;
    },

    /* ===== 棋子详情 ===== */

    showUnitDetail(unit) {
        const race = RACES[unit.race];
        const cls = CLASSES[unit.class];

        const html = `
            <div class="detail-name">${unit.icon} ${unit.name} ${'⭐'.repeat(unit.star)}</div>
            <div class="detail-tags">
                <span class="detail-tag">${race.icon} ${race.name}</span>
                <span class="detail-tag">${cls.icon} ${cls.name}</span>
                <span class="detail-tag">💰${unit.cost}</span>
            </div>
            <div class="detail-stat"><span>❤️ 生命</span><span>${unit.maxHp}</span></div>
            <div class="detail-stat"><span>⚔️ 攻击</span><span>${unit.attack}</span></div>
            <div class="detail-stat"><span>🛡️ 护甲</span><span>${unit.armor}</span></div>
            <div class="detail-stat"><span>⚡ 攻速</span><span>${unit.attackSpeed.toFixed(1)}</span></div>
            <div class="detail-stat"><span>📏 射程</span><span>${unit.range}</span></div>
        `;

        this.elements.unitDetail.classList.remove('hidden');
        this.elements.unitDetailContent.innerHTML = html;

        if (this.isMobile && this.elements.mobileUnitDetailContent) {
            this.elements.mobileUnitDetailContent.innerHTML = html;
        }
    },

    showUnitDefDetail(def) {
        const race = RACES[def.race];
        const cls = CLASSES[def.class];

        this.elements.unitDetail.classList.remove('hidden');
        this.elements.unitDetailContent.innerHTML = `
            <div class="detail-name">${def.icon} ${def.name}</div>
            <div class="detail-tags">
                <span class="detail-tag">${race.icon} ${race.name}</span>
                <span class="detail-tag">${cls.icon} ${cls.name}</span>
                <span class="detail-tag">💰${def.cost}</span>
            </div>
            <div class="detail-stat"><span>❤️ 生命</span><span>${def.hp}</span></div>
            <div class="detail-stat"><span>⚔️ 攻击</span><span>${def.attack}</span></div>
            <div class="detail-stat"><span>🛡️ 护甲</span><span>${def.armor}</span></div>
            <div class="detail-stat"><span>⚡ 攻速</span><span>${def.attackSpeed.toFixed(1)}</span></div>
            <div class="detail-stat"><span>📏 射程</span><span>${def.range}</span></div>
        `;
    },

    /* ===== 战斗相关 ===== */

    startBattle() {
        if (this.battleStarting || combatSystem.tickInterval) return;
        if (gameState.round > MAX_ROUND) {
            this.showCampaignClear();
            return;
        }
        if (!startCombatPhase()) return;
        this.battleStarting = true;

        this.elements.enemyName.textContent = gameState.enemyName;
        this.clearCombatLog();
        this.renderAll();

        const enemyArmy = generateEnemyArmy(gameState.round);
        const enemyBoard = placeEnemyOnBoard(enemyArmy);

        const playerSynergies = calculateSynergies();

        combatSystem.onTick = (events, allUnits) => {
            this.renderCombatBoard(allUnits);
            this.handleCombatEvents(events);
        };

        combatSystem.onCombatEnd = (playerWon, survivingEnemies, combatMeta) => {
            this.battleStarting = false;
            const result = endCombat(playerWon, survivingEnemies, combatMeta);
            this.showBattleResult(playerWon, result);
        };

        const playerBoardCopy = gameState.board.map(row =>
            row.map(unit => unit ? createUnit(unit.defId, unit.star) : null)
        );

        combatSystem.startCombat(playerBoardCopy, enemyBoard, playerSynergies, []);
    },

    handleCombatEvents(events) {
        for (const event of events) {
            if (event.type === 'attack') {
                const targetEl = this.combatUnitElements.get(event.target.uid);
                if (targetEl) {
                    targetEl.classList.add('hit');
                    setTimeout(() => targetEl.classList.remove('hit'), 300);

                    if (event.damage > 0) {
                        this.showFloatingNumber(targetEl, event.damage, event.isCrit);
                    }
                }

                const attackerEl = this.combatUnitElements.get(event.attacker.uid);
                if (attackerEl) {
                    attackerEl.classList.add('attacking');
                    setTimeout(() => attackerEl.classList.remove('attacking'), 300);
                }
                if (event.targetDied) {
                    this.addCombatLogEntry(`${event.attacker.name} 击杀了 ${event.target.name}`, 'log-win');
                }
            } else if (event.type === 'miss') {
                this.addCombatLogEntry(`${event.target.name} 闪避了 ${event.attacker.name} 的攻击`, 'log-info');
            } else if (event.type === 'death') {
                const el = this.combatUnitElements.get(event.unit.uid);
                if (el) {
                    el.classList.add('dying');
                }
            }
        }
    },

    showFloatingNumber(targetEl, damage, isCrit) {
        while (this.elements.floatingNumbers.childElementCount >= this.maxFloatingNumbers) {
            this.elements.floatingNumbers.firstElementChild?.remove();
        }
        const rect = targetEl.getBoundingClientRect();
        const numEl = document.createElement('div');
        numEl.className = `floating-number ${isCrit ? 'crit' : 'damage'}`;
        numEl.textContent = (isCrit ? '💥' : '-') + damage;
        numEl.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 20) + 'px';
        numEl.style.top = (rect.top - 5) + 'px';
        this.elements.floatingNumbers.appendChild(numEl);

        setTimeout(() => numEl.remove(), 1000);
    },

    showBattleResult(playerWon, result) {
        this.elements.battleResult.classList.remove('hidden');
        AdManager.showResultAd();

        if (result.isTimeoutDraw) {
            this.elements.resultTitle.textContent = '⏳ 平局';
            this.elements.resultTitle.style.color = '#ffb74d';
        } else if (playerWon) {
            this.elements.resultTitle.textContent = '✅ 胜利！';
            this.elements.resultTitle.style.color = '#4caf50';
        } else {
            this.elements.resultTitle.textContent = '❌ 失败';
            this.elements.resultTitle.style.color = '#f44336';
        }

        const g = result.goldInfo;
        let detail = '';
        if (result.isTimeoutDraw) {
            detail += `<div>双方激战至超时，判定平局，本回合不掉血。</div>`;
        } else if (!playerWon) {
            detail += `<div>💔 受到 ${result.damage} 点伤害，剩余生命: ${gameState.hp}</div>`;
        }
        if (gameState.winStreak > 1) {
            detail += `<div>🔥 连胜 ${gameState.winStreak} 次</div>`;
        }
        if (gameState.loseStreak > 1) {
            detail += `<div>💔 连败 ${gameState.loseStreak} 次</div>`;
        }
        detail += `<div style="margin-top:8px">💰 获得金币: ${g.total}</div>`;
        detail += `<div style="font-size:11px;color:#888">基础:${g.baseGold} 利息:${g.interest} 连胜/败:${g.streak} 回合:${g.roundBonus}</div>`;

        if (result.gameOver) {
            detail += `<div style="margin-top:8px;color:#f44336;font-weight:bold">☠️ 你被击败了!</div>`;
        }
        if (result.campaignCleared) {
            detail += `<div style="margin-top:8px;color:#66bb6a;font-weight:bold">🏆 恭喜通关 30 回合挑战！</div>`;
            this.elements.btnContinue.textContent = '重新开始';
        } else {
            this.elements.btnContinue.textContent = '继续';
        }

        this.elements.resultDetail.innerHTML = detail;
        this.renderTopBar();
    },

    showGameOver() {
        this.elements.gameOver.classList.remove('hidden');
        AdManager.showGameOverAd();
        this.elements.gameOverDetail.innerHTML = `
            <p>你在第 <b>${gameState.round - 1}</b> 回合被击败</p>
            <p>最终等级: <b>${gameState.level}</b></p>
        `;
    },

    showCampaignClear() {
        this.elements.battleResult.classList.remove('hidden');
        this.elements.resultTitle.textContent = '🏆 挑战已通关';
        this.elements.resultTitle.style.color = '#66bb6a';
        this.elements.resultDetail.innerHTML = `
            <div>你已完成 30 回合挑战。</div>
            <div style="margin-top:8px">点击下方重新开始一局。</div>
        `;
        this.elements.btnContinue.textContent = '重新开始';
    },

    finishResultTransition() {
        this.resultTransitioning = false;
        this.elements.btnContinue.disabled = false;
    },

    resetUITransientState() {
        this.elements.mobileSynergyOverlay?.classList.add('hidden');
        this.elements.mobileDetailOverlay?.classList.add('hidden');
        if (this.elements.mobileUnitDetailContent) this.elements.mobileUnitDetailContent.innerHTML = '';
        if (this.elements.unitDetailContent) this.elements.unitDetailContent.innerHTML = '';
        if (this.elements.floatingNumbers) this.elements.floatingNumbers.innerHTML = '';
    },

    addCombatLogEntry(text, type = '') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = text;
        this.elements.combatLog.appendChild(entry);
        while (this.elements.combatLog.childElementCount > 80) {
            this.elements.combatLog.firstElementChild?.remove();
        }
        this.elements.combatLog.scrollTop = this.elements.combatLog.scrollHeight;
    },

    clearCombatLog() {
        this.elements.combatLog.innerHTML = '';
    },

    /* ===== 移动端面板 ===== */

    renderMobileSynergies() {
        if (!this.elements.mobileSynergyList) return;
        const synergies = calculateSynergies();
        this.elements.mobileSynergyList.innerHTML = '';

        synergies.sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            return b.count - a.count;
        });

        for (const syn of synergies) {
            const item = document.createElement('div');
            item.className = `synergy-item ${syn.active ? 'active' : 'inactive'}`;

            let thresholdStr = '';
            if (syn.thresholds) {
                thresholdStr = syn.thresholds.map(t =>
                    syn.count >= t ? `<b>${t}</b>` : t
                ).join('/');
            } else {
                thresholdStr = syn.count >= syn.threshold ? `<b>${syn.threshold}</b>` : `${syn.threshold}`;
            }

            item.innerHTML = `
                <span class="synergy-icon">${syn.icon}</span>
                <span class="synergy-count ${syn.active ? 'active' : ''}">${syn.count}/${thresholdStr}</span>
                <span class="synergy-name">${syn.name}</span>
                ${syn.active ? `<span class="synergy-bonus">${syn.bonusText || ''}</span>` : ''}
            `;
            this.elements.mobileSynergyList.appendChild(item);
        }
    },

    showMobileUnitDetail(unit) {
        if (!this.elements.mobileUnitDetailContent) return;
        const race = RACES[unit.race];
        const cls = CLASSES[unit.class];

        this.elements.mobileUnitDetailContent.innerHTML = `
            <div class="detail-name">${unit.icon} ${unit.name} ${'⭐'.repeat(unit.star)}</div>
            <div class="detail-tags">
                <span class="detail-tag">${race.icon} ${race.name}</span>
                <span class="detail-tag">${cls.icon} ${cls.name}</span>
                <span class="detail-tag">💰${unit.cost}</span>
            </div>
            <div class="detail-stat"><span>❤️ 生命</span><span>${unit.maxHp}</span></div>
            <div class="detail-stat"><span>⚔️ 攻击</span><span>${unit.attack}</span></div>
            <div class="detail-stat"><span>🛡️ 护甲</span><span>${unit.armor}</span></div>
            <div class="detail-stat"><span>⚡ 攻速</span><span>${unit.attackSpeed.toFixed(1)}</span></div>
            <div class="detail-stat"><span>📏 射程</span><span>${unit.range}</span></div>
        `;
        this.elements.mobileDetailOverlay.classList.remove('hidden');
    },

    /* ===== 分享功能 ===== */

    handleShare() {
        const shareData = {
            title: '电子斗蛐蛐 - 自走棋',
            text: '来玩电子斗蛐蛐！购买棋子、布阵迎战、合成升星，挑战30回合！',
            url: window.location.href,
        };

        if (navigator.share) {
            navigator.share(shareData).catch(() => {});
        } else {
            this.copyToClipboard(window.location.href);
        }
    },

    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert('链接已复制到剪贴板，快分享给朋友吧！');
            }).catch(() => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    },

    fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('链接已复制到剪贴板，快分享给朋友吧！');
    },
};
