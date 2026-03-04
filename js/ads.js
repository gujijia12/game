/* ============================================
   广告管理模块
   ============================================
   接入步骤：
   1. 申请 Google AdSense 账号 (https://www.google.com/adsense/)
   2. 获得审核通过后，将 data-ad-client 和 data-ad-slot 替换为你的 ID
   3. 取消 index.html <head> 中 AdSense SDK 的注释
   ============================================ */

const AdManager = {
    enabled: false,
    adClient: '',       // 替换为你的 AdSense publisher ID, 如 'ca-pub-1234567890'
    roundsSinceLastAd: 0,
    AD_INTERVAL: 3,     // 每隔几回合展示一次插屏广告

    init(adClient) {
        if (adClient) {
            this.adClient = adClient;
            this.enabled = true;
        }
    },

    createBannerAd(containerId, adSlot) {
        if (!this.enabled) return;
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.dataset.adClient = this.adClient;
        ins.dataset.adSlot = adSlot || '';
        ins.dataset.adFormat = 'auto';
        ins.dataset.fullWidthResponsive = 'true';
        container.appendChild(ins);

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            // AdSense not loaded
        }
    },

    onRoundEnd() {
        this.roundsSinceLastAd++;
        if (this.roundsSinceLastAd >= this.AD_INTERVAL) {
            this.roundsSinceLastAd = 0;
            return true;
        }
        return false;
    },

    showResultAd() {
        if (!this.enabled) return;
        if (!this.onRoundEnd()) return;
        this.createBannerAd('ad-slot-result', '');
    },

    showGameOverAd() {
        if (!this.enabled) return;
        this.createBannerAd('ad-slot-gameover', '');
    },

    showStartAd() {
        if (!this.enabled) return;
        this.createBannerAd('ad-slot-start', '');
    },
};
