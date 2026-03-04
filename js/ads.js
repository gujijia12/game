/* ============================================
   广告管理模块
   ============================================
   使用方式：
   1. 在 AD_CONFIG.adClient 填入你的 ca-pub-xxxx
   2. 可选填写各广告位 slot id
   3. 页面会自动加载 AdSense SDK 并启用
   ============================================ */

const AD_CONFIG = {
    enabled: false,
    adClient: '',
    slots: {
        start: '',
        result: '',
        gameover: ''
    }
};

const AdManager = {
    enabled: false,
    adClient: '',
    slots: {
        start: '',
        result: '',
        gameover: ''
    },
    roundsSinceLastAd: 0,
    mountedSlots: {},
    AD_INTERVAL: 3,     // 每隔几回合展示一次插屏广告

    init(config = AD_CONFIG) {
        this.enabled = !!config.enabled && !!config.adClient;
        this.adClient = config.adClient || '';
        this.slots = config.slots || this.slots;
        this.resetSession();
        if (!this.enabled) return;
        this.loadAdsenseScript();
    },

    loadAdsenseScript() {
        const sdkId = 'adsense-sdk';
        if (document.getElementById(sdkId)) return;
        const script = document.createElement('script');
        script.id = sdkId;
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.adClient}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
    },

    createBannerAd(containerId, adSlot) {
        if (!this.enabled) return;
        const container = document.getElementById(containerId);
        if (!container) return;
        if (this.mountedSlots[containerId]) return;
        if (typeof window.adsbygoogle === 'undefined') {
            console.warn('[AdManager] AdSense SDK not ready yet, skip ad render:', containerId);
            return;
        }

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
            this.mountedSlots[containerId] = true;
        } catch (e) {
            console.warn('[AdManager] Failed to render ad slot:', containerId, e);
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
        this.createBannerAd('ad-slot-result', this.slots.result);
    },

    showGameOverAd() {
        if (!this.enabled) return;
        this.createBannerAd('ad-slot-gameover', this.slots.gameover);
    },

    showStartAd() {
        if (!this.enabled) return;
        this.createBannerAd('ad-slot-start', this.slots.start);
    },

    resetSession() {
        this.roundsSinceLastAd = 0;
        this.mountedSlots = {};
    }
};
