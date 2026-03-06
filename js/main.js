/* ============================================
   入口文件 - 初始化游戏
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    AdManager.init();
    AdManager.showStartAd();

    function isTypingTarget(target) {
        if (!target) return false;
        const tag = (target.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || !!target.isContentEditable;
    }

    function hasBlockingModalOpen() {
        return !!document.querySelector('#guide-modal:not(.hidden), #achievement-modal:not(.hidden), #feedback-modal:not(.hidden), #start-screen:not(.hidden), #battle-result:not(.hidden), #game-over:not(.hidden)');
    }

    document.addEventListener('keydown', (e) => {
        if (isTypingTarget(e.target) || hasBlockingModalOpen()) return;
        if (gameState && gameState.phase === 'prep') {
            switch (e.key.toLowerCase()) {
                case 'd':
                    if (rerollShop()) UI.renderAll();
                    break;
                case 'f':
                    if (buyXp()) UI.renderAll();
                    break;
                case ' ':
                case 'enter':
                    e.preventDefault();
                    UI.startBattle();
                    break;
                case 'e':
                    if (gameState.selectedUnit) {
                        const sel = gameState.selectedUnit;
                        sellUnit(sel.source, sel.row, sel.col);
                        UI.renderAll();
                    }
                    break;
                case 'w':
                    if (autoArrange()) UI.renderAll();
                    break;
                case 'escape':
                    gameState.selectedUnit = null;
                    UI.renderAll();
                    break;
            }
        }
    });
});
