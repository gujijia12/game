/* ============================================
   棋子数据、种族、职业、羁绊定义
   ============================================ */

const BOARD_COLS = 8;
const BOARD_ROWS = 4;
const BENCH_SIZE = 8;
const MAX_ROUND = 30;
const SHOP_SIZE = 5;
const BASE_HP = 100;
const REROLL_COST = 2;
const BUY_XP_COST = 4;
const BUY_XP_AMOUNT = 4;
const SELL_REFUND_RATE = 0.7;
const MAX_INTEREST = 5;

const XP_PER_LEVEL = [0, 0, 2, 6, 10, 20, 36, 56, 80, 100];

const TIER_ROLL_ODDS = {
    1: [1.00, 0.00, 0.00, 0.00, 0.00],
    2: [0.70, 0.30, 0.00, 0.00, 0.00],
    3: [0.60, 0.35, 0.05, 0.00, 0.00],
    4: [0.50, 0.35, 0.15, 0.00, 0.00],
    5: [0.35, 0.35, 0.25, 0.05, 0.00],
    6: [0.25, 0.30, 0.30, 0.15, 0.00],
    7: [0.20, 0.25, 0.30, 0.20, 0.05],
    8: [0.15, 0.20, 0.25, 0.25, 0.15],
    9: [0.10, 0.15, 0.25, 0.30, 0.20],
};

const RACES = {
    human:  { name: '人类', icon: '👤', bonuses: { 2: '+15%生命', 4: '+30%生命', 6: '+50%生命' } },
    orc:    { name: '兽人', icon: '👹', bonuses: { 2: '+20%攻击', 4: '+40%攻击' } },
    undead: { name: '亡灵', icon: '💀', bonuses: { 2: '-3敌方护甲', 4: '-6敌方护甲' } },
    elf:    { name: '精灵', icon: '🧝', bonuses: { 2: '+15%闪避', 4: '+30%闪避' } },
    demon:  { name: '恶魔', icon: '👿', bonuses: { 1: '纯伤+50%' } },
};

const CLASSES = {
    warrior:  { name: '战士', icon: '⚔️', bonuses: { 2: '+5护甲', 4: '+10护甲', 6: '+15护甲' } },
    mage:     { name: '法师', icon: '🔮', bonuses: { 2: '+30%法伤', 4: '+60%法伤' } },
    assassin: { name: '刺客', icon: '🗡️', bonuses: { 2: '+15%暴击', 3: '+30%暴击' } },
    hunter:   { name: '猎人', icon: '🏹', bonuses: { 2: '+25%攻速', 4: '+50%攻速' } },
    knight:   { name: '骑士', icon: '🛡️', bonuses: { 2: '25%触发护盾', 4: '45%触发护盾' } },
};

const SYNERGY_EFFECTS = {
    human_2:  { stat: 'hp', type: 'percent', value: 0.15 },
    human_4:  { stat: 'hp', type: 'percent', value: 0.30 },
    human_6:  { stat: 'hp', type: 'percent', value: 0.50 },
    orc_2:    { stat: 'attack', type: 'percent', value: 0.20 },
    orc_4:    { stat: 'attack', type: 'percent', value: 0.40 },
    undead_2: { stat: 'enemyArmor', type: 'flat', value: -3 },
    undead_4: { stat: 'enemyArmor', type: 'flat', value: -6 },
    elf_2:    { stat: 'evasion', type: 'flat', value: 0.15 },
    elf_4:    { stat: 'evasion', type: 'flat', value: 0.30 },
    demon_1:  { stat: 'pureDamage', type: 'percent', value: 0.50 },
    warrior_2:  { stat: 'armor', type: 'flat', value: 5 },
    warrior_4:  { stat: 'armor', type: 'flat', value: 10 },
    warrior_6:  { stat: 'armor', type: 'flat', value: 15 },
    mage_2:     { stat: 'spellDamage', type: 'percent', value: 0.30 },
    mage_4:     { stat: 'spellDamage', type: 'percent', value: 0.60 },
    assassin_2: { stat: 'critChance', type: 'flat', value: 0.15 },
    assassin_3: { stat: 'critChance', type: 'flat', value: 0.30 },
    hunter_2:   { stat: 'attackSpeed', type: 'percent', value: 0.25 },
    hunter_4:   { stat: 'attackSpeed', type: 'percent', value: 0.50 },
    knight_2:   { stat: 'shieldChance', type: 'flat', value: 0.25 },
    knight_4:   { stat: 'shieldChance', type: 'flat', value: 0.45 },
};

const UNIT_DEFS = [
    // Cost 1
    { id: 'axe_fighter', name: '斧兵', icon: '🪓', cost: 1, race: 'orc', class: 'warrior',
      hp: 600, attack: 50, armor: 5, attackSpeed: 1.0, range: 1 },
    { id: 'skeleton', name: '骷髅兵', icon: '💀', cost: 1, race: 'undead', class: 'warrior',
      hp: 500, attack: 45, armor: 5, attackSpeed: 1.1, range: 1 },
    { id: 'moon_blade', name: '月刃', icon: '🌙', cost: 1, race: 'elf', class: 'assassin',
      hp: 400, attack: 55, armor: 2, attackSpeed: 1.3, range: 1 },
    { id: 'musketeer', name: '火枪手', icon: '🔫', cost: 1, race: 'human', class: 'hunter',
      hp: 350, attack: 50, armor: 2, attackSpeed: 1.0, range: 3 },
    { id: 'militia', name: '民兵', icon: '🗡️', cost: 1, race: 'human', class: 'warrior',
      hp: 550, attack: 45, armor: 4, attackSpeed: 0.9, range: 1 },

    // Cost 2
    { id: 'blade_master', name: '剑圣', icon: '⚔️', cost: 2, race: 'orc', class: 'assassin',
      hp: 550, attack: 70, armor: 3, attackSpeed: 1.2, range: 1 },
    { id: 'witch_doctor', name: '巫医', icon: '🧙', cost: 2, race: 'undead', class: 'mage',
      hp: 500, attack: 55, armor: 3, attackSpeed: 0.9, range: 3 },
    { id: 'guardian', name: '守卫', icon: '🛡️', cost: 2, race: 'human', class: 'knight',
      hp: 700, attack: 40, armor: 8, attackSpeed: 0.8, range: 1 },
    { id: 'ranger', name: '游侠', icon: '🏹', cost: 2, race: 'elf', class: 'hunter',
      hp: 450, attack: 65, armor: 3, attackSpeed: 1.1, range: 3 },
    { id: 'imp', name: '小鬼', icon: '😈', cost: 2, race: 'demon', class: 'assassin',
      hp: 480, attack: 60, armor: 2, attackSpeed: 1.2, range: 1 },

    // Cost 3
    { id: 'berserker', name: '狂战士', icon: '🔥', cost: 3, race: 'orc', class: 'warrior',
      hp: 850, attack: 80, armor: 5, attackSpeed: 1.0, range: 1 },
    { id: 'shadow_hunter', name: '暗影猎手', icon: '🥷', cost: 3, race: 'undead', class: 'assassin',
      hp: 600, attack: 85, armor: 3, attackSpeed: 1.3, range: 1 },
    { id: 'archmage', name: '大法师', icon: '🧙‍♂️', cost: 3, race: 'human', class: 'mage',
      hp: 550, attack: 70, armor: 3, attackSpeed: 0.9, range: 3 },
    { id: 'treant', name: '树精', icon: '🌳', cost: 3, race: 'elf', class: 'knight',
      hp: 900, attack: 50, armor: 10, attackSpeed: 0.7, range: 1 },
    { id: 'orc_hunter', name: '兽人猎手', icon: '🐗', cost: 3, race: 'orc', class: 'hunter',
      hp: 650, attack: 75, armor: 4, attackSpeed: 1.0, range: 3 },

    // Cost 4
    { id: 'tauren', name: '牛头酋长', icon: '🐂', cost: 4, race: 'orc', class: 'knight',
      hp: 1100, attack: 70, armor: 12, attackSpeed: 0.7, range: 1 },
    { id: 'lich', name: '巫妖', icon: '🥶', cost: 4, race: 'undead', class: 'mage',
      hp: 650, attack: 80, armor: 3, attackSpeed: 0.9, range: 4 },
    { id: 'paladin', name: '圣骑士', icon: '✝️', cost: 4, race: 'human', class: 'knight',
      hp: 1000, attack: 65, armor: 10, attackSpeed: 0.8, range: 1 },
    { id: 'sharp_claw', name: '利爪德鲁伊', icon: '🐾', cost: 4, race: 'elf', class: 'assassin',
      hp: 700, attack: 95, armor: 5, attackSpeed: 1.4, range: 1 },

    // Cost 5
    { id: 'doom', name: '末日使者', icon: '😡', cost: 5, race: 'demon', class: 'warrior',
      hp: 1300, attack: 100, armor: 8, attackSpeed: 0.8, range: 1 },
    { id: 'death_prophet', name: '死亡先知', icon: '👻', cost: 5, race: 'undead', class: 'mage',
      hp: 800, attack: 90, armor: 5, attackSpeed: 1.0, range: 3 },
    { id: 'dragon_knight', name: '龙骑士', icon: '🐉', cost: 5, race: 'human', class: 'warrior',
      hp: 1400, attack: 95, armor: 12, attackSpeed: 0.9, range: 1 },
    { id: 'wind_runner', name: '风行者', icon: '💨', cost: 5, race: 'elf', class: 'hunter',
      hp: 750, attack: 105, armor: 5, attackSpeed: 1.3, range: 4 },
];

const UNIT_POOL_SIZES = { 1: 30, 2: 20, 3: 15, 4: 10, 5: 8 };

const STAR_MULTIPLIERS = {
    1: { hp: 1, attack: 1, armor: 1 },
    2: { hp: 1.8, attack: 1.8, armor: 1.3 },
    3: { hp: 3.2, attack: 3.2, armor: 1.6 },
};

const ROUND_CONFIGS = [];
(function buildRoundConfigs() {
    for (let r = 1; r <= MAX_ROUND; r++) {
        const difficulty = Math.floor((r - 1) / 3);
        const budget = 3 + r * 2 + difficulty * 3;
        const maxUnits = Math.min(1 + Math.floor(r / 2), 8);
        const maxTier = Math.min(1 + Math.floor(r / 4), 5);
        const starChance2 = Math.min(0.05 * r, 0.6);
        const starChance3 = Math.max(0, Math.min(0.02 * (r - 15), 0.3));
        ROUND_CONFIGS.push({ round: r, budget, maxUnits, maxTier, starChance2, starChance3 });
    }
})();

function getUnitDef(id) {
    return UNIT_DEFS.find(u => u.id === id);
}

function getUnitsByTier(tier) {
    return UNIT_DEFS.filter(u => u.cost === tier);
}
