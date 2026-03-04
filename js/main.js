/* ============================================
   入口文件 - 初始化游戏
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    AdManager.init();
    AdManager.showStartAd();

    document.addEventListener('keydown', (e) => {
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
                case 'escape':
                    gameState.selectedUnit = null;
                    UI.renderAll();
                    break;
            }
        }
    });
});
