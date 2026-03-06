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
    currentSpeedIdx: 0,
    speedOptions: [1, 2, 3],
    autoContinueTimer: null,
    autoContinueSeconds: 0,
    feedbackStorageKey: 'game_feedback_list',
    feedbackApiUrl: '/api/feedback',

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
            btnAutoArrange: document.getElementById('btn-auto-arrange'),

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
            btnSpeed: document.getElementById('btn-speed'),
            btnGuide: document.getElementById('btn-guide'),
            guideModal: document.getElementById('guide-modal'),
            btnGuideClose: document.getElementById('btn-guide-close'),
            guideBody: document.getElementById('guide-body'),

            btnToggleSynergy: document.getElementById('btn-toggle-synergy'),
            btnToggleDetail: document.getElementById('btn-toggle-detail'),
            mobileSynergyOverlay: document.getElementById('mobile-synergy-overlay'),
            mobileDetailOverlay: document.getElementById('mobile-detail-overlay'),
            mobileSynergyList: document.getElementById('mobile-synergy-list'),
            mobileUnitDetailContent: document.getElementById('mobile-unit-detail-content'),
            btnShare: document.getElementById('btn-share'),
            btnAchievements: document.getElementById('btn-achievements'),
            achievementModal: document.getElementById('achievement-modal'),
            achievementBody: document.getElementById('achievement-body'),
            btnAchievementClose: document.getElementById('btn-achievement-close'),
            difficultySelect: document.getElementById('difficulty-select'),
            btnFeedback: document.getElementById('btn-feedback'),
            feedbackModal: document.getElementById('feedback-modal'),
            btnFeedbackClose: document.getElementById('btn-feedback-close'),
            feedbackName: document.getElementById('feedback-name'),
            feedbackContact: document.getElementById('feedback-contact'),
            feedbackContent: document.getElementById('feedback-content'),
            btnFeedbackSubmit: document.getElementById('btn-feedback-submit'),
            btnFeedbackClear: document.getElementById('btn-feedback-clear'),
            feedbackList: document.getElementById('feedback-list'),
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
            const item = gameState.shop[idx];
            if (!item || item.sold) return;
            const def = getUnitDef(item.defId);
            if (gameState.gold < def.cost) {
                this.showToast('金币不足！');
                return;
            }
            const benchFull = gameState.bench.every(b => b !== null);
            if (benchFull) {
                this.showToast('备战席已满！请先出售或上阵棋子。');
                return;
            }
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

        if (this.elements.btnAutoArrange) {
            this.elements.btnAutoArrange.addEventListener('click', () => {
                if (autoArrange()) this.renderAll();
            });
        }

        this.elements.btnContinue.addEventListener('click', () => {
            this.clearAutoContinue();
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
                this.resetSpeed();
                this.resetUITransientState();
                initGameState(gameState.difficulty || 'normal');
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
            this.resetSpeed();
            this.resetUITransientState();
            initGameState(gameState?.difficulty || 'normal');
            AdManager.resetSession();
            startPrepPhase();
            this.renderAll();
        });

        this.elements.btnStart.addEventListener('click', () => {
            this.resultTransitioning = false;
            this.elements.startScreen.classList.add('hidden');
            this.battleStarting = false;
            this.resetSpeed();
            this.resetUITransientState();
            const diff = this.elements.difficultySelect ? this.elements.difficultySelect.value : 'normal';
            initGameState(diff);
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
                if (!this.elements.mobileUnitDetailContent?.innerHTML.trim()) {
                    this.showToast('请先选择一个棋子查看详情');
                    return;
                }
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

        // Speed control
        if (this.elements.btnSpeed) {
            this.elements.btnSpeed.addEventListener('click', () => {
                this.currentSpeedIdx = (this.currentSpeedIdx + 1) % this.speedOptions.length;
                const speed = this.speedOptions[this.currentSpeedIdx];
                combatSystem.setSpeed(speed);
                const labels = ['▶ 1x', '⏩ 2x', '⏩ 3x'];
                this.elements.btnSpeed.textContent = labels[this.currentSpeedIdx];
                this.elements.btnSpeed.className = 'shop-btn speed-btn' +
                    (speed === 2 ? ' fast' : speed === 3 ? ' fastest' : '');
            });
        }

        // Achievement modal
        if (this.elements.btnAchievements) {
            this.elements.btnAchievements.addEventListener('click', () => {
                this.openAchievements();
            });
        }
        if (this.elements.btnAchievementClose) {
            this.elements.btnAchievementClose.addEventListener('click', () => {
                this.elements.achievementModal.classList.add('hidden');
            });
        }
        if (this.elements.achievementModal) {
            this.elements.achievementModal.addEventListener('click', (e) => {
                if (e.target === this.elements.achievementModal) this.elements.achievementModal.classList.add('hidden');
            });
        }

        // Feedback modal
        if (this.elements.btnFeedback) {
            this.elements.btnFeedback.addEventListener('click', () => {
                this.openFeedback();
            });
        }
        if (this.elements.btnFeedbackClose) {
            this.elements.btnFeedbackClose.addEventListener('click', () => {
                this.elements.feedbackModal?.classList.add('hidden');
            });
        }
        if (this.elements.feedbackModal) {
            this.elements.feedbackModal.addEventListener('click', (e) => {
                if (e.target === this.elements.feedbackModal) {
                    this.elements.feedbackModal.classList.add('hidden');
                }
            });
        }
        if (this.elements.btnFeedbackSubmit) {
            this.elements.btnFeedbackSubmit.addEventListener('click', () => {
                this.submitFeedback();
            });
        }
        if (this.elements.btnFeedbackClear) {
            this.elements.btnFeedbackClear.addEventListener('click', () => {
                this.clearFeedbackHistory();
            });
        }

        // Auto-show guide on first visit
        try {
            if (!localStorage.getItem('guideShown')) {
                setTimeout(() => {
                    this.openGuide('basic');
                    try { localStorage.setItem('guideShown', '1'); } catch { /* ignore */ }
                }, 500);
            }
        } catch { /* localStorage unavailable */ }

        // Guide modal
        if (this.elements.btnGuide) {
            this.elements.btnGuide.addEventListener('click', () => {
                this.openGuide('basic');
            });
        }
        if (this.elements.btnGuideClose) {
            this.elements.btnGuideClose.addEventListener('click', () => {
                this.elements.guideModal.classList.add('hidden');
            });
        }
        if (this.elements.guideModal) {
            this.elements.guideModal.addEventListener('click', (e) => {
                if (e.target === this.elements.guideModal) {
                    this.elements.guideModal.classList.add('hidden');
                }
            });
        }
        document.querySelectorAll('.guide-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.openGuide(tab.dataset.tab || 'basic');
            });
        });
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

        const nextLevelXp = gameState.level < 9 ? XP_PER_LEVEL[gameState.level + 1] : 0;
        const xpPercent = nextLevelXp > 0 ? (gameState.xp / nextLevelXp) * 100 : 100;
        this.elements.levelNum.textContent = gameState.level < 9 ? `${gameState.level} (${gameState.xp}/${nextLevelXp})` : '9 MAX';
        this.elements.xpBar.style.width = xpPercent + '%';

        this.elements.goldNum.textContent = gameState.gold;

        const isBoss = isBossRound(gameState.round);
        const nextIsBoss = isBossRound(gameState.round + 1);
        let phaseLabel;
        if (gameState.phase === 'prep' && isBoss) {
            const bossName = BOSS_CONFIGS[gameState.round]?.name || 'BOSS';
            phaseLabel = `⚠️ BOSS战：${bossName}`;
        } else if (gameState.phase === 'prep' && nextIsBoss) {
            phaseLabel = `准备阶段 (下回合Boss!)`;
        } else if (gameState.phase === 'prep' && gameState.round <= WARMUP_ROUNDS) {
            phaseLabel = `🛡️ 热身回合 (${gameState.round}/${WARMUP_ROUNDS})`;
        } else {
            phaseLabel = { prep: '准备阶段', combat: '⚔️ 战斗中', result: '结算' }[gameState.phase] || '';
        }
        this.elements.phaseText.textContent = phaseLabel;
        let phaseCls = 'phase-label';
        if (gameState.phase === 'combat') phaseCls += ' combat';
        else if (gameState.phase === 'prep' && isBoss) phaseCls += ' boss-warning';
        this.elements.phaseText.className = phaseCls;
    },

    renderPlayerBoard() {
        const inCombat = gameState.phase === 'combat';
        this.playerBoardCells.forEach(cell => {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            const unit = inCombat ? null : gameState.board[r][c];

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

        if (!inCombat) {
            const indicator = document.createElement('div');
            indicator.className = 'board-count-indicator';
            const count = getBoardUnitCount();
            const max = gameState.maxBoardUnits;
            const cls = count > max ? 'over-limit' : 'current';
            indicator.innerHTML = `棋盘: <span class="${cls}">${count}</span> / ${max}`;
            this.elements.playerBoard.parentNode.insertBefore(indicator, this.elements.playerBoard.nextSibling);
        }
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

        const cellMap = new Map();
        for (const unit of allUnits) {
            if (!unit.alive) continue;
            const isPlayerSide = unit.combatRow >= BOARD_ROWS;
            const row = isPlayerSide ? unit.combatRow - BOARD_ROWS : unit.combatRow;
            const cellIdx = row * BOARD_COLS + unit.combatCol;
            const key = (isPlayerSide ? 'p' : 'e') + cellIdx;
            cellMap.set(key, unit);
        }

        const updateCellGrid = (cells, prefix) => {
            cells.forEach((cell, idx) => {
                const key = prefix + idx;
                const unit = cellMap.get(key);
                const curUid = cell.dataset.combatUid || '';

                if (!unit) {
                    if (curUid) {
                        cell.innerHTML = '';
                        this.combatUnitElements.delete(curUid);
                        cell.dataset.combatUid = '';
                    }
                    return;
                }

                if (curUid === unit.uid) {
                    const el = this.combatUnitElements.get(unit.uid);
                    if (el) this.updateCombatUnit(el, unit);
                } else {
                    if (curUid) this.combatUnitElements.delete(curUid);
                    cell.innerHTML = '';
                    const el = this.createUnitElement(unit, true, unit.team === 'enemy');
                    cell.appendChild(el);
                    cell.dataset.combatUid = unit.uid;
                    this.combatUnitElements.set(unit.uid, el);
                }
            });
        };

        updateCellGrid(playerCells, 'p');
        updateCellGrid(enemyCells, 'e');
    },

    updateCombatUnit(el, unit) {
        const hpFill = el.querySelector('.unit-hp-fill');
        if (hpFill) {
            const pct = Math.max(0, (unit.currentHp / unit.maxHp) * 100);
            hpFill.style.width = pct + '%';
            hpFill.className = 'unit-hp-fill' + (pct <= 30 ? ' low' : pct <= 60 ? ' medium' : '');
        }
        const manaFill = el.querySelector('.unit-mana-fill');
        if (manaFill) {
            manaFill.style.width = (unit.maxMana > 0 ? Math.min(100, (unit.mana / unit.maxMana) * 100) : 0) + '%';
        }
        const hasShield = (unit.shield || 0) > 0;
        const shieldEl = el.querySelector('.unit-shield-glow');
        if (hasShield && !shieldEl) {
            const sg = document.createElement('div');
            sg.className = 'unit-shield-glow';
            el.appendChild(sg);
        } else if (!hasShield && shieldEl) {
            shieldEl.remove();
        }
        const isStunned = unit.stunnedUntilTick && combatSystem.tickCount <= unit.stunnedUntilTick;
        const stunEl = el.querySelector('.unit-stun-icon');
        if (isStunned && !stunEl) {
            const si = document.createElement('span');
            si.className = 'unit-stun-icon';
            si.textContent = '\uD83D\uDCAB';
            el.appendChild(si);
        } else if (!isStunned && stunEl) {
            stunEl.remove();
        }

        if (unit.enraged && !el.classList.contains('enraged')) {
            el.classList.add('enraged');
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

            const skill = UNIT_SKILLS[def.id];
            const skillLine = skill ? `<div class="shop-card-skill">💫${skill.name}</div>` : '';

            card.innerHTML = `
                <div class="unit-icon">${def.icon}</div>
                <div class="shop-card-name">${def.name}</div>
                <div class="shop-card-tags">${race.icon}${race.name} ${cls.icon}${cls.name}</div>
                ${skillLine}
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
        if (this.elements.btnAutoArrange) {
            const hasBench = gameState.bench.some(b => b !== null);
            this.elements.btnAutoArrange.disabled = !inPrep || !hasBench || getBoardUnitCount() >= gameState.maxBoardUnits;
        }
    },

    /* ===== 棋子元素创建 ===== */

    createUnitElement(unit, isCombat = false, isEnemy = false) {
        const el = document.createElement('div');
        el.className = `unit tier-${unit.cost}${isEnemy ? ' enemy-unit' : ''}${unit.isBoss ? ' boss-unit' : ''}${unit.enraged ? ' enraged' : ''}`;

        const starsText = '⭐'.repeat(unit.star);
        const starClass = `star-${unit.star}`;

        let hpPercent = 100;
        if (isCombat && unit.maxHp > 0) {
            hpPercent = Math.max(0, (unit.currentHp / unit.maxHp) * 100);
        }

        let hpClass = '';
        if (hpPercent <= 30) hpClass = 'low';
        else if (hpPercent <= 60) hpClass = 'medium';

        const manaPercent = isCombat && unit.maxMana > 0 ? Math.min(100, (unit.mana / unit.maxMana) * 100) : 0;
        const hasShield = isCombat && (unit.shield || 0) > 0;
        const isStunned = isCombat && unit.stunnedUntilTick && combatSystem.tickCount <= unit.stunnedUntilTick;

        el.innerHTML = `
            <span class="unit-stars ${starClass}">${starsText}</span>
            <span class="unit-icon">${unit.icon}</span>
            ${isCombat ? `
                <div class="unit-hp-bar">
                    <div class="unit-hp-fill ${hpClass}" style="width: ${hpPercent}%"></div>
                </div>
                <div class="unit-mana-bar">
                    <div class="unit-mana-fill" style="width: ${manaPercent}%"></div>
                </div>
                ${hasShield ? '<div class="unit-shield-glow"></div>' : ''}
                ${isStunned ? '<span class="unit-stun-icon">💫</span>' : ''}
            ` : ''}
        `;

        el.dataset.uid = unit.uid;
        return el;
    },

    /* ===== 棋子详情 ===== */

    showUnitDetail(unit) {
        const race = RACES[unit.race] || { icon: '❓', name: unit.race || '未知' };
        const cls = CLASSES[unit.class] || { icon: '❓', name: unit.class || '未知' };
        const skill = UNIT_SKILLS[unit.defId];
        const skillHtml = skill
            ? `<div class="detail-stat" style="color:#64b5f6;margin-top:4px"><span>💫 ${skill.name}</span><span style="font-size:10px">🔮${skill.mana}</span></div><div style="font-size:11px;color:#aaa;padding:2px 0">${skill.desc}</div>`
            : '';
        const sellPrice = Math.max(1, Math.ceil(unit.cost * SELL_REFUND_RATE * unit.star));

        const html = `
            <div class="detail-name">${unit.icon} ${unit.name} ${'⭐'.repeat(unit.star)}</div>
            <div class="detail-tags">
                <span class="detail-tag">${race.icon} ${race.name}</span>
                <span class="detail-tag">${cls.icon} ${cls.name}</span>
                <span class="detail-tag">💰${unit.cost}</span>
                <span class="detail-tag sell-tag">卖出💰${sellPrice}</span>
            </div>
            <div class="detail-stat"><span>❤️ 生命</span><span>${unit.maxHp}</span></div>
            <div class="detail-stat"><span>⚔️ 攻击</span><span>${unit.attack}</span></div>
            <div class="detail-stat"><span>🛡️ 护甲</span><span>${unit.armor}</span></div>
            <div class="detail-stat"><span>⚡ 攻速</span><span>${unit.attackSpeed.toFixed(1)}</span></div>
            <div class="detail-stat"><span>📏 射程</span><span>${unit.range}</span></div>
            ${skillHtml}
        `;

        this.elements.unitDetail.classList.remove('hidden');
        this.elements.unitDetailContent.innerHTML = html;

        if (this.isMobile && this.elements.mobileUnitDetailContent) {
            this.elements.mobileUnitDetailContent.innerHTML = html;
        }
    },

    showUnitDefDetail(def) {
        const race = RACES[def.race] || { icon: '❓', name: def.race || '未知' };
        const cls = CLASSES[def.class] || { icon: '❓', name: def.class || '未知' };
        const skill = UNIT_SKILLS[def.id];
        const skillHtml = skill
            ? `<div class="detail-stat" style="color:#64b5f6;margin-top:4px"><span>💫 ${skill.name}</span><span style="font-size:10px">🔮${skill.mana}</span></div><div style="font-size:11px;color:#aaa;padding:2px 0">${skill.desc}</div>`
            : '';

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
            ${skillHtml}
        `;
    },

    /* ===== 战斗相关 ===== */

    startBattle() {
        if (this.battleStarting || combatSystem.tickInterval) return;
        if (gameState.round > MAX_ROUND) {
            this.showCampaignClear();
            return;
        }
        if (getBoardUnitCount() > gameState.maxBoardUnits) {
            const msg = `棋盘 ${getBoardUnitCount()}/${gameState.maxBoardUnits} 超员！请先移走多余棋子。`;
            this.addCombatLogEntry(msg, 'log-lose');
            this.showToast(msg);
            return;
        }
        if (!startCombatPhase()) return;
        this.battleStarting = true;

        this.elements.enemyName.textContent = gameState.enemyName;
        this.elements.enemyName.className = isBossRound(gameState.round) ? 'boss-name' : '';
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
            result.dpsStats = combatMeta.dpsStats || null;
            this.showBattleResult(playerWon, result);
        };

        const playerBoardCopy = gameState.board.map(row =>
            row.map(unit => unit ? createUnit(unit.defId, unit.star) : null)
        );

        combatSystem.startCombat(playerBoardCopy, enemyBoard, playerSynergies, []);
        this.renderCombatBoard(combatSystem.getAllUnits());
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
            } else if (event.type === 'skill') {
                const casterEl = this.combatUnitElements.get(event.unit.uid);
                if (casterEl) {
                    casterEl.classList.add('casting');
                    setTimeout(() => casterEl.classList.remove('casting'), 500);
                    this.showFloatingSkillName(casterEl, event.skillName);
                }
                this.showSkillEffect(event);
                if (event.totalDamage > 0) {
                    for (const t of event.targets) {
                        const tEl = this.combatUnitElements.get(t.uid);
                        if (tEl) {
                            tEl.classList.add('hit');
                            setTimeout(() => tEl.classList.remove('hit'), 300);
                        }
                    }
                }
                if (event.healAmount > 0 && event.targets.length > 0) {
                    const perUnit = Math.round(event.healAmount / event.targets.length);
                    for (const t of event.targets) {
                        const tEl = this.combatUnitElements.get(t.uid);
                        if (tEl) this.showFloatingHeal(tEl, perUnit);
                    }
                }
                const logType = event.healAmount > 0 ? 'log-info' : 'log-win';
                const dmgText = event.totalDamage > 0 ? ` ${event.totalDamage}伤害` : '';
                const healText = event.healAmount > 0 ? ` 治疗${event.healAmount}` : '';
                this.addCombatLogEntry(`💫 ${event.unit.name} 释放 ${event.skillName}${dmgText}${healText}`, logType);
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

    showFloatingSkillName(el, name) {
        while (this.elements.floatingNumbers.childElementCount >= this.maxFloatingNumbers) {
            this.elements.floatingNumbers.firstElementChild?.remove();
        }
        const rect = el.getBoundingClientRect();
        const numEl = document.createElement('div');
        numEl.className = 'floating-number skill';
        numEl.textContent = '💫 ' + name;
        numEl.style.left = (rect.left + rect.width / 2) + 'px';
        numEl.style.top = (rect.top - 10) + 'px';
        this.elements.floatingNumbers.appendChild(numEl);
        setTimeout(() => numEl.remove(), 1000);
    },

    showFloatingHeal(el, amount) {
        while (this.elements.floatingNumbers.childElementCount >= this.maxFloatingNumbers) {
            this.elements.floatingNumbers.firstElementChild?.remove();
        }
        const rect = el.getBoundingClientRect();
        const numEl = document.createElement('div');
        numEl.className = 'floating-number heal';
        numEl.textContent = '+' + amount;
        numEl.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 14) + 'px';
        numEl.style.top = (rect.top - 5) + 'px';
        this.elements.floatingNumbers.appendChild(numEl);
        setTimeout(() => numEl.remove(), 1000);
    },

    /* ===== 技能视觉特效 ===== */

    showSkillEffect(event) {
        const casterEl = this.combatUnitElements.get(event.unit.uid);

        switch (event.skillType) {
            case 'singleDamage': {
                const tEl = event.targets[0] && this.combatUnitElements.get(event.targets[0].uid);
                if (tEl) this.spawnEffect(tEl, 'fx-slash');
                break;
            }
            case 'pureDamage': {
                const tEl = event.targets[0] && this.combatUnitElements.get(event.targets[0].uid);
                if (tEl) this.spawnEffect(tEl, 'fx-fire');
                break;
            }
            case 'aoe': {
                const first = event.targets[0] && this.combatUnitElements.get(event.targets[0].uid);
                if (first) this.spawnEffect(first, 'fx-aoe');
                for (let i = 1; i < event.targets.length; i++) {
                    const el = event.targets[i] && this.combatUnitElements.get(event.targets[i].uid);
                    if (el) this.spawnEffect(el, 'fx-arrow', 80);
                }
                break;
            }
            case 'damageAll': {
                const flash = document.createElement('div');
                flash.className = 'skill-effect fx-screen-flash';
                this.elements.floatingNumbers.appendChild(flash);
                flash.addEventListener('animationend', () => flash.remove());
                setTimeout(() => { if (flash.parentNode) flash.remove(); }, 1500);
                break;
            }
            case 'multiShot': {
                event.targets.forEach((t, i) => {
                    const el = this.combatUnitElements.get(t.uid);
                    if (el) this.spawnEffect(el, 'fx-arrow', i * 100);
                });
                break;
            }
            case 'multiHit': {
                const tEl = event.targets[0] && this.combatUnitElements.get(event.targets[0].uid);
                if (tEl) {
                    for (let i = 0; i < 4; i++) {
                        this.spawnEffect(tEl, 'fx-multi-slash', i * 100);
                    }
                }
                break;
            }
            case 'chainDamage': {
                event.targets.forEach((t, i) => {
                    const el = this.combatUnitElements.get(t.uid);
                    if (el) this.spawnEffect(el, 'fx-chain', i * 150);
                });
                break;
            }
            case 'selfShield': {
                if (casterEl) this.spawnEffect(casterEl, 'fx-shield');
                break;
            }
            case 'selfBuff': {
                if (casterEl) this.spawnEffect(casterEl, 'fx-buff');
                break;
            }
            case 'healAll': {
                for (const t of event.targets) {
                    const el = this.combatUnitElements.get(t.uid);
                    if (el) this.spawnEffect(el, 'fx-heal', Math.random() * 200);
                }
                break;
            }
            case 'stunDamage': {
                const tEl = event.targets[0] && this.combatUnitElements.get(event.targets[0].uid);
                if (tEl) {
                    this.spawnEffect(tEl, 'fx-slash');
                    this.spawnEffect(tEl, 'fx-stun', 150);
                }
                break;
            }
        }
    },

    spawnEffect(anchorEl, effectClass, delay = 0) {
        const spawn = () => {
            if (!anchorEl || !anchorEl.parentNode) return;
            const rect = anchorEl.getBoundingClientRect();
            const el = document.createElement('div');
            el.className = `skill-effect ${effectClass}`;
            el.style.left = (rect.left + rect.width / 2) + 'px';
            el.style.top = (rect.top + rect.height / 2) + 'px';
            this.elements.floatingNumbers.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
            setTimeout(() => { if (el.parentNode) el.remove(); }, 2000);
        };
        if (delay > 0) setTimeout(spawn, delay);
        else spawn();
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
        if (result.wasBoss && playerWon) {
            detail += `<div style="color:#ffd700;font-weight:bold;font-size:14px">🏆 击败Boss！额外获得 ${result.bossReward} 金币</div>`;
        } else if (result.wasBoss && !playerWon && !result.isTimeoutDraw) {
            detail += `<div style="color:#ff6e40;font-weight:bold">Boss战失败！Boss造成巨额伤害</div>`;
        }
        if (result.isTimeoutDraw) {
            detail += `<div>双方激战至超时，判定平局，本回合不掉血。</div>`;
        } else if (!playerWon && result.isWarmup) {
            detail += `<div style="color:#ffb74d">🛡️ 热身回合，不扣血！</div>`;
        } else if (!playerWon) {
            detail += `<div>💔 受到 ${result.damage} 点伤害，剩余生命: ${gameState.hp}</div>`;
        }
        if (gameState.winStreak > 1) {
            detail += `<div>🔥 连胜 ${gameState.winStreak} 次</div>`;
        }
        if (gameState.loseStreak > 1) {
            detail += `<div>💔 连败 ${gameState.loseStreak} 次</div>`;
        }
        detail += `<div style="margin-top:8px">💰 获得金币: ${g.total}${result.bossReward ? ' + ' + result.bossReward + '(Boss)' : ''}</div>`;
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

        if (result.dpsStats && result.dpsStats.player.length > 0) {
            const top = result.dpsStats.player.slice(0, 5);
            const maxDmg = Math.max(...top.map(u => u.damageDealt || 1));
            let dpsHtml = '<div class="dps-summary"><div class="dps-summary-title">伤害统计</div>';
            for (const u of top) {
                const pct = Math.round(((u.damageDealt || 0) / maxDmg) * 100);
                const healStr = u.healingDone > 0 ? ` +${u.healingDone}治疗` : '';
                dpsHtml += `<div class="dps-bar-row">
                    <span class="dps-bar-name">${u.icon}${u.name}${'★'.repeat(Math.max(0, u.star - 1))}</span>
                    <div class="dps-bar-track"><div class="dps-bar-fill${u.healingDone > 0 ? ' heal' : ''}" style="width:${pct}%"></div></div>
                    <span class="dps-bar-value">${u.damageDealt || 0}${healStr}</span>
                </div>`;
            }
            dpsHtml += '</div>';
            detail += dpsHtml;
        }

        this.elements.resultDetail.innerHTML = detail;
        this.renderTopBar();
        this.startAutoContinue(result.gameOver || result.campaignCleared);
    },

    startAutoContinue(disabled) {
        this.clearAutoContinue();
        if (disabled) return;
        this.autoContinueSeconds = 8;
        this.elements.btnContinue.textContent = `继续 (${this.autoContinueSeconds}s)`;
        this.autoContinueTimer = setInterval(() => {
            this.autoContinueSeconds--;
            if (this.autoContinueSeconds <= 0) {
                this.clearAutoContinue();
                this.elements.btnContinue.click();
                return;
            }
            this.elements.btnContinue.textContent = `继续 (${this.autoContinueSeconds}s)`;
        }, 1000);
    },

    clearAutoContinue() {
        if (this.autoContinueTimer) {
            clearInterval(this.autoContinueTimer);
            this.autoContinueTimer = null;
        }
    },

    showGameOver() {
        this.elements.gameOver.classList.remove('hidden');
        AdManager.showGameOverAd();
        const stats = Achievement.getStats();
        const diffName = DIFFICULTY_MODES[gameState.difficulty]?.name || '普通';
        this.elements.gameOverDetail.innerHTML = `
            <p>你在第 <b>${gameState.round - 1}</b> 回合被击败</p>
            <p>最终等级: <b>${gameState.level}</b>　难度: <b>${diffName}</b></p>
            <p style="font-size:12px;color:#888;margin-top:8px">历史最高回合: ${stats.bestRound} | 总游戏次数: ${stats.gamesPlayed}</p>
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

    resetSpeed() {
        this.currentSpeedIdx = 0;
        combatSystem.speedMultiplier = 1;
        if (this.elements.btnSpeed) {
            this.elements.btnSpeed.textContent = '▶ 1x';
            this.elements.btnSpeed.className = 'shop-btn speed-btn';
        }
    },

    resetUITransientState() {
        this.clearAutoContinue();
        this.elements.mobileSynergyOverlay?.classList.add('hidden');
        this.elements.mobileDetailOverlay?.classList.add('hidden');
        this.elements.guideModal?.classList.add('hidden');
        this.elements.achievementModal?.classList.add('hidden');
        this.elements.feedbackModal?.classList.add('hidden');
        if (this.elements.mobileUnitDetailContent) this.elements.mobileUnitDetailContent.innerHTML = '';
        if (this.elements.unitDetailContent) this.elements.unitDetailContent.innerHTML = '';
        if (this.elements.floatingNumbers) this.elements.floatingNumbers.innerHTML = '';
        this.combatUnitElements.clear();
        this.playerBoardCells.forEach(c => { c.dataset.combatUid = ''; });
        this.enemyBoardCells.forEach(c => { c.dataset.combatUid = ''; });
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
        const race = RACES[unit.race] || { icon: '❓', name: unit.race || '未知' };
        const cls = CLASSES[unit.class] || { icon: '❓', name: unit.class || '未知' };

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

    showToast(msg) {
        const existing = document.querySelector('.game-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'game-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
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

    /* ===== 建议反馈 ===== */

    openFeedback() {
        if (!this.elements.feedbackModal) return;
        this.elements.feedbackModal.classList.remove('hidden');
        this.renderFeedbackList();
    },

    loadFeedbackHistory() {
        try {
            const raw = localStorage.getItem(this.feedbackStorageKey);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    },

    saveFeedbackHistory(list) {
        try {
            localStorage.setItem(this.feedbackStorageKey, JSON.stringify(list));
            return true;
        } catch {
            this.showToast('保存失败：浏览器限制了本地存储');
            return false;
        }
    },

    escapeHtml(text) {
        return String(text || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    },

    renderFeedbackList() {
        if (!this.elements.feedbackList) return;
        const list = this.loadFeedbackHistory();
        if (list.length === 0) {
            this.elements.feedbackList.innerHTML = '<div class="feedback-empty">还没有建议，快来提交第一条吧！</div>';
            return;
        }

        this.elements.feedbackList.innerHTML = list.map(item => `
            <div class="feedback-item">
                <div class="feedback-item-head">
                    <span>${this.escapeHtml(item.name || '匿名玩家')}${item.contact ? `（${this.escapeHtml(item.contact)}）` : ''}</span>
                    <span>${this.escapeHtml(item.time || '')}</span>
                </div>
                <div class="feedback-item-body">${this.escapeHtml(item.content || '')}</div>
            </div>
        `).join('');
    },

    async submitFeedback() {
        const name = (this.elements.feedbackName?.value || '').trim();
        const contact = (this.elements.feedbackContact?.value || '').trim();
        const content = (this.elements.feedbackContent?.value || '').trim();

        if (!content) {
            this.showToast('请先填写建议内容');
            return;
        }
        if (content.length < 5) {
            this.showToast('建议内容至少 5 个字');
            return;
        }

        const now = new Date();
        const item = {
            name,
            contact,
            content,
            time: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        };
        const list = this.loadFeedbackHistory();
        list.unshift(item);
        const trimmed = list.slice(0, 50);

        if (!this.saveFeedbackHistory(trimmed)) return;
        if (this.elements.btnFeedbackSubmit) this.elements.btnFeedbackSubmit.disabled = true;
        const remoteOk = await this.sendFeedbackToServer(item);
        if (this.elements.btnFeedbackSubmit) this.elements.btnFeedbackSubmit.disabled = false;
        if (this.elements.feedbackContent) this.elements.feedbackContent.value = '';
        this.renderFeedbackList();
        this.showToast(remoteOk ? '建议已提交并同步到服务器！' : '建议已本机保存，服务器暂不可用');
    },

    async sendFeedbackToServer(item) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const resp = await fetch(this.feedbackApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
                signal: controller.signal,
            });
            return resp.ok;
        } catch {
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    },

    clearFeedbackHistory() {
        if (!window.confirm('确定清空本机保存的所有建议记录吗？')) return;
        if (!this.saveFeedbackHistory([])) return;
        this.renderFeedbackList();
        this.showToast('已清空建议记录');
    },

    /* ===== 成就面板 ===== */

    openAchievements() {
        if (!this.elements.achievementModal || !this.elements.achievementBody) return;
        this.elements.achievementModal.classList.remove('hidden');
        const unlocked = Achievement.getAll();
        const stats = Achievement.getStats();
        let html = `<div style="font-size:12px;color:#888;margin-bottom:10px">游戏次数: ${stats.gamesPlayed} | 最高回合: ${stats.bestRound} | 最高通关血量: ${stats.bestHp}</div>`;
        html += '<div class="achievement-grid">';
        for (const a of ACHIEVEMENTS) {
            const done = !!unlocked[a.id];
            html += `<div class="achievement-card ${done ? 'unlocked' : 'locked'}">
                <span class="achievement-icon">${done ? a.icon : '🔒'}</span>
                <div class="achievement-info">
                    <div class="achievement-name">${a.name}</div>
                    <div class="achievement-desc">${a.desc}</div>
                </div>
            </div>`;
        }
        html += '</div>';
        this.elements.achievementBody.innerHTML = html;
    },

    /* ===== 新手指引 ===== */

    openGuide(tab) {
        if (!this.elements.guideModal || !this.elements.guideBody) return;
        this.elements.guideModal.classList.remove('hidden');

        document.querySelectorAll('.guide-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });

        if (tab === 'basic') {
            this.elements.guideBody.innerHTML = `
                <div class="guide-section-title">开局该做什么</div>
                <ul class="guide-list">
                    <li>先买能凑成 <span class="guide-tag">2羁绊</span> 的棋子，优先上阵高星。</li>
                    <li>每回合基础收入 + 利息（每10金币+1，最高+5）。</li>
                    <li>前期少刷新，尽量攒到20/30金币吃利息。</li>
                </ul>
                <div class="guide-section-title">战斗流程</div>
                <ul class="guide-list">
                    <li>准备阶段布阵，点击 <span class="guide-tag">开战</span> 后自动战斗。</li>
                    <li>近战会向前推进接敌，远程会尽量在安全距离输出。</li>
                    <li>每个棋子都有<b>主动技能</b>，蓝条（法力值）蓄满自动释放。</li>
                    <li>攻击敌人和被攻击都会积攒法力值。</li>
                    <li>高星棋子开局自带部分法力值（2星20%、3星40%）。</li>
                    <li>战斗胜负会影响连胜/连败奖励。</li>
                    <li>点击 <span class="guide-tag">▶ 1x</span> 按钮可以切换战斗速度（1x/2x/3x）。</li>
                    <li>第 <b>10/20/30</b> 回合是 <span class="guide-tag" style="background:#e65100;border-color:#ff6d00">Boss战</span>，击败Boss可获得大量金币奖励！</li>
                    <li>点击 <span class="guide-tag">📐 布阵</span> 可以自动将备战席的棋子上阵。</li>
                </ul>
            `;
        } else if (tab === 'synergy') {
            const raceHtml = Object.entries(RACES).map(([id, race]) => {
                const tiers = Object.entries(race.bonuses).map(([n, txt]) => `${n}：${txt}`).join(' / ');
                return `<li>${race.icon} <b>${race.name}</b> - ${tiers}</li>`;
            }).join('');
            const classHtml = Object.entries(CLASSES).map(([id, cls]) => {
                const tiers = Object.entries(cls.bonuses).map(([n, txt]) => `${n}：${txt}`).join(' / ');
                return `<li>${cls.icon} <b>${cls.name}</b> - ${tiers}</li>`;
            }).join('');
            this.elements.guideBody.innerHTML = `
                <div class="guide-section-title">种族羁绊</div>
                <ul class="guide-list">${raceHtml}</ul>
                <div class="guide-section-title">职业羁绊</div>
                <ul class="guide-list">${classHtml}</ul>
                <div class="guide-section-title">羁绊小技巧</div>
                <ul class="guide-list">
                    <li>同费用同星级下，优先上能激活羁绊的棋子。</li>
                    <li>前期建议先凑 2 羁绊，中后期再冲高层羁绊。</li>
                </ul>
            `;
        } else if (tab === 'stats') {
            this.elements.guideBody.innerHTML = `
                <div class="guide-section-title">属性解释</div>
                <ul class="guide-list">
                    <li><b>生命</b>：血量归零就阵亡。</li>
                    <li><b>攻击</b>：每次普攻基础伤害，也是技能伤害的基数。</li>
                    <li><b>护甲</b>：降低受到的物理伤害（护甲/(护甲+100)）。</li>
                    <li><b>攻速</b>：每秒攻击次数，越高出手越快。</li>
                    <li><b>射程</b>：可攻击距离，近战通常为1。</li>
                    <li><b>法力值</b>：蓝条蓄满后自动释放技能。攻击+10 / 被攻击+15。</li>
                    <li><b>星级</b>：3个同名同星可合成更高星，属性大幅提升。</li>
                    <li><b>护盾</b>：部分技能给予护盾，优先吸收伤害。</li>
                    <li><b>眩晕</b>：被眩晕的单位短时间无法行动。</li>
                </ul>
                <div class="guide-section-title">经济解释</div>
                <ul class="guide-list">
                    <li><b>刷新</b>：花2金刷新商店。</li>
                    <li><b>买经验</b>：花4金获得经验，提升等级和可上阵数。</li>
                    <li><b>利息</b>：每10金币 +1，最高 +5。</li>
                </ul>
            `;
        } else if (tab === 'units') {
            const unitCards = UNIT_DEFS.map(def => {
                const race = RACES[def.race];
                const cls = CLASSES[def.class];
                const skill = UNIT_SKILLS[def.id];
                const skillLine = skill
                    ? `<div style="color:#64b5f6;font-size:11px;margin-top:2px">💫 ${skill.name}（🔮${skill.mana}）：${skill.desc}</div>`
                    : '';
                return `
                    <div class="unit-codex-card">
                        <div class="unit-codex-name">${def.icon} ${def.name}（${def.cost}费）</div>
                        <div><span class="guide-tag">${race.icon} ${race.name}</span><span class="guide-tag">${cls.icon} ${cls.name}</span></div>
                        <div>❤️${def.hp} ⚔️${def.attack} 🛡️${def.armor} ⚡${def.attackSpeed} 📏${def.range}</div>
                        ${skillLine}
                    </div>
                `;
            }).join('');
            this.elements.guideBody.innerHTML = `
                <div class="guide-section-title">棋子基础属性图鉴</div>
                <div class="unit-codex-grid">${unitCards}</div>
            `;
        }
    },
};
