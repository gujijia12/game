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
    sdkReady: false,
    adClient: '',
    slots: {
        start: '',
        result: '',
        gameover: ''
    },
    roundsSinceLastAd: 0,
    mountedSlots: {},
    pendingSlots: {},
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
        if (typeof window.adsbygoogle !== 'undefined') {
            this.sdkReady = true;
            this.flushPendingAds();
            return;
        }
        const existing = document.getElementById(sdkId);
        if (existing) return;

        const script = document.createElement('script');
        script.id = sdkId;
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.adClient}`;
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            this.sdkReady = true;
            this.flushPendingAds();
        };
        script.onerror = () => {
            console.warn('[AdManager] Failed to load AdSense SDK');
        };
        document.head.appendChild(script);
    },

    createBannerAd(containerId, adSlot) {
        if (!this.enabled) return;
        const container = document.getElementById(containerId);
        if (!container) return false;
        if (this.mountedSlots[containerId]) return true;
        if (!this.sdkReady || typeof window.adsbygoogle === 'undefined') {
            this.pendingSlots[containerId] = adSlot || '';
            return false;
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
            delete this.pendingSlots[containerId];
            return true;
        } catch (e) {
            console.warn('[AdManager] Failed to render ad slot:', containerId, e);
            return false;
        }
    },

    flushPendingAds() {
        const entries = Object.entries(this.pendingSlots);
        for (const [containerId, adSlot] of entries) {
            this.createBannerAd(containerId, adSlot);
        }
    },

    onRoundEnd() {
        if (this.roundsSinceLastAd >= this.AD_INTERVAL - 1) {
            return true;
        }
        this.roundsSinceLastAd++;
        return false;
    },

    showResultAd() {
        if (!this.enabled) return;
        if (!this.onRoundEnd()) return;
        const rendered = this.createBannerAd('ad-slot-result', this.slots.result);
        if (rendered) {
            this.roundsSinceLastAd = 0;
        }
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
        this.sdkReady = typeof window.adsbygoogle !== 'undefined';
        this.roundsSinceLastAd = 0;
        this.mountedSlots = {};
        this.pendingSlots = {};
    }
};
