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
const MANA_ON_ATTACK = 10;
const MANA_ON_HIT = 15;
const WARMUP_ROUNDS = 3;

let _uidCounter = 0;
function generateUid() {
    return (++_uidCounter).toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

const XP_PER_LEVEL = [0, 0, 2, 4, 6, 12, 20, 36, 56, 80];

const DIFFICULTY_MODES = {
    normal:    { name: '普通', startHp: 100, enemyMul: 1.0, shopSize: 5 },
    hard:      { name: '困难', startHp: 80,  enemyMul: 1.2, shopSize: 5 },
    nightmare: { name: '噩梦', startHp: 60,  enemyMul: 1.4, shopSize: 4 },
};

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
    orc:    { name: '兽人', icon: '👹', bonuses: { 2: '+15%攻击', 4: '+35%攻击' } },
    undead: { name: '亡灵', icon: '💀', bonuses: { 2: '-3敌方护甲', 4: '-6敌方护甲' } },
    elf:    { name: '精灵', icon: '🧝', bonuses: { 2: '+20%闪避', 4: '+35%闪避' } },
    demon:  { name: '恶魔', icon: '👿', bonuses: { 2: '纯伤+30%', 4: '纯伤+50%' } },
};

const CLASSES = {
    warrior:  { name: '战士', icon: '⚔️', bonuses: { 2: '+5护甲', 4: '+10护甲', 6: '+15护甲' } },
    mage:     { name: '法师', icon: '🔮', bonuses: { 2: '+30%法伤', 4: '+50%法伤' } },
    assassin: { name: '刺客', icon: '🗡️', bonuses: { 2: '+15%暴击', 3: '+30%暴击' } },
    hunter:   { name: '猎人', icon: '🏹', bonuses: { 2: '+30%攻速', 4: '+55%攻速' } },
    knight:   { name: '骑士', icon: '🛡️', bonuses: { 2: '25%触发护盾', 4: '45%触发护盾' } },
};

const SYNERGY_EFFECTS = {
    human_2:  { stat: 'hp', type: 'percent', value: 0.15 },
    human_4:  { stat: 'hp', type: 'percent', value: 0.30 },
    human_6:  { stat: 'hp', type: 'percent', value: 0.50 },
    orc_2:    { stat: 'attack', type: 'percent', value: 0.15 },
    orc_4:    { stat: 'attack', type: 'percent', value: 0.35 },
    undead_2: { stat: 'enemyArmor', type: 'flat', value: -3 },
    undead_4: { stat: 'enemyArmor', type: 'flat', value: -6 },
    elf_2:    { stat: 'evasion', type: 'flat', value: 0.20 },
    elf_4:    { stat: 'evasion', type: 'flat', value: 0.35 },
    demon_2:  { stat: 'pureDamage', type: 'percent', value: 0.30 },
    demon_4:  { stat: 'pureDamage', type: 'percent', value: 0.50 },
    warrior_2:  { stat: 'armor', type: 'flat', value: 5 },
    warrior_4:  { stat: 'armor', type: 'flat', value: 10 },
    warrior_6:  { stat: 'armor', type: 'flat', value: 15 },
    mage_2:     { stat: 'spellDamage', type: 'percent', value: 0.30 },
    mage_4:     { stat: 'spellDamage', type: 'percent', value: 0.50 },
    assassin_2: { stat: 'critChance', type: 'flat', value: 0.15 },
    assassin_3: { stat: 'critChance', type: 'flat', value: 0.30 },
    hunter_2:   { stat: 'attackSpeed', type: 'percent', value: 0.30 },
    hunter_4:   { stat: 'attackSpeed', type: 'percent', value: 0.55 },
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
    { id: 'hell_hound', name: '地狱犬', icon: '🐕‍🦺', cost: 1, race: 'demon', class: 'warrior',
      hp: 480, attack: 48, armor: 4, attackSpeed: 1.0, range: 1 },

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
    { id: 'flame_imp', name: '烈焰术士', icon: '☄️', cost: 3, race: 'demon', class: 'mage',
      hp: 600, attack: 75, armor: 3, attackSpeed: 0.9, range: 3 },

    // Cost 4
    { id: 'tauren', name: '牛头酋长', icon: '🐂', cost: 4, race: 'orc', class: 'knight',
      hp: 1100, attack: 70, armor: 12, attackSpeed: 0.7, range: 1 },
    { id: 'lich', name: '巫妖', icon: '🥶', cost: 4, race: 'undead', class: 'mage',
      hp: 650, attack: 80, armor: 3, attackSpeed: 0.9, range: 4 },
    { id: 'paladin', name: '圣骑士', icon: '✝️', cost: 4, race: 'human', class: 'knight',
      hp: 1000, attack: 65, armor: 10, attackSpeed: 0.8, range: 1 },
    { id: 'sharp_claw', name: '利爪德鲁伊', icon: '🐾', cost: 4, race: 'elf', class: 'assassin',
      hp: 700, attack: 95, armor: 5, attackSpeed: 1.4, range: 1 },
    { id: 'pit_lord', name: '深渊领主', icon: '🦇', cost: 4, race: 'demon', class: 'knight',
      hp: 1000, attack: 80, armor: 10, attackSpeed: 0.8, range: 1 },

    // Cost 5
    { id: 'doom', name: '末日使者', icon: '😡', cost: 5, race: 'demon', class: 'warrior',
      hp: 1300, attack: 100, armor: 8, attackSpeed: 0.8, range: 1 },
    { id: 'death_prophet', name: '死亡先知', icon: '👻', cost: 5, race: 'undead', class: 'hunter',
      hp: 800, attack: 90, armor: 5, attackSpeed: 1.0, range: 3 },
    { id: 'dragon_knight', name: '龙骑士', icon: '🐉', cost: 5, race: 'human', class: 'warrior',
      hp: 1400, attack: 95, armor: 12, attackSpeed: 0.9, range: 1 },
    { id: 'wind_runner', name: '风行者', icon: '💨', cost: 5, race: 'elf', class: 'hunter',
      hp: 750, attack: 105, armor: 5, attackSpeed: 1.3, range: 4 },
];

const UNIT_POOL_SIZES = { 1: 30, 2: 20, 3: 15, 4: 10, 5: 8 };

const UNIT_SKILLS = {
    axe_fighter:    { name: '战吼',     desc: '对周围敌人造成150%攻击伤害',           mana: 60,  type: 'aoe',          radius: 1, multiplier: 1.5 },
    skeleton:       { name: '骨盾',     desc: '获得30%最大生命的护盾',               mana: 50,  type: 'selfShield',   value: 0.3 },
    moon_blade:     { name: '月光斩',   desc: '对目标造成250%攻击伤害',              mana: 70,  type: 'singleDamage', multiplier: 2.5 },
    musketeer:      { name: '连射',     desc: '对3个随机敌人各造成100%攻击伤害',      mana: 60,  type: 'multiShot',    targets: 3, multiplier: 1.0 },
    militia:        { name: '坚守',     desc: '获得40%最大生命的护盾',               mana: 50,  type: 'selfShield',   value: 0.4 },
    hell_hound:     { name: '烈焰撕咬', desc: '对目标造成180%纯伤害（无视护甲）',     mana: 60,  type: 'pureDamage',   multiplier: 1.8 },

    blade_master:   { name: '无敌斩',   desc: '对目标造成300%攻击伤害',              mana: 80,  type: 'singleDamage', multiplier: 3.0 },
    witch_doctor:   { name: '诅咒',     desc: '对目标区域造成150%攻击伤害',           mana: 70,  type: 'aoe',          radius: 2, multiplier: 1.5 },
    guardian:       { name: '铁壁',     desc: '获得50%最大生命的护盾',               mana: 60,  type: 'selfShield',   value: 0.5 },
    ranger:         { name: '箭雨',     desc: '对目标区域造成120%攻击伤害',           mana: 70,  type: 'aoe',          radius: 2, multiplier: 1.2 },
    imp:            { name: '灵火',     desc: '对目标造成200%纯伤害（无视护甲）',      mana: 50,  type: 'pureDamage',   multiplier: 2.0 },

    berserker:      { name: '狂暴',     desc: '攻击力和攻速提升40%持续4秒',          mana: 80,  type: 'selfBuff',     attackMul: 0.4, asMul: 0.4, duration: 20 },
    shadow_hunter:  { name: '暗影突袭', desc: '对目标造成350%攻击伤害',               mana: 90,  type: 'singleDamage', multiplier: 3.5 },
    archmage:       { name: '冰爆',     desc: '对目标区域造成200%攻击伤害',           mana: 80,  type: 'aoe',          radius: 2, multiplier: 2.0 },
    treant:         { name: '生命之树', desc: '治疗全体友军15%最大生命值',             mana: 100, type: 'healAll',      value: 0.15 },
    orc_hunter:     { name: '猎人陷阱', desc: '对目标造成200%伤害并眩晕1秒',          mana: 70,  type: 'stunDamage',   multiplier: 2.0, stunTicks: 5 },

    tauren:         { name: '震荡波',   desc: '对周围敌人造成250%伤害并眩晕',         mana: 100, type: 'aoe',          radius: 1, multiplier: 2.5, stunTicks: 4 },
    lich:           { name: '连锁冰霜', desc: '冰霜在3个敌人间弹射各180%伤害',        mana: 80,  type: 'chainDamage',  targets: 3, multiplier: 1.8 },
    paladin:        { name: '神圣之光', desc: '治疗全体友军20%最大生命值',             mana: 90,  type: 'healAll',      value: 0.20 },
    sharp_claw:     { name: '利爪连击', desc: '对目标连击4次各80%攻击伤害',           mana: 70,  type: 'multiHit',     hits: 4, multiplier: 0.8 },

    flame_imp:      { name: '烈焰风暴', desc: '对目标区域造成200%攻击伤害',           mana: 80,  type: 'aoe',          radius: 2, multiplier: 2.0 },
    pit_lord:       { name: '深渊之火', desc: '对周围敌人造成180%伤害并眩晕',         mana: 90,  type: 'aoe',          radius: 1, multiplier: 1.8, stunTicks: 3 },
    doom:           { name: '末日审判', desc: '对所有敌人造成150%攻击伤害',           mana: 100, type: 'damageAll',    multiplier: 1.5 },
    death_prophet:  { name: '驱灵术',   desc: '对4个随机敌人各造成150%攻击伤害',      mana: 100, type: 'multiShot',    targets: 4, multiplier: 1.5 },
    dragon_knight:  { name: '龙息',     desc: '对目标区域造成300%攻击伤害',           mana: 100, type: 'aoe',          radius: 2, multiplier: 3.0 },
    wind_runner:    { name: '强力射击', desc: '对目标造成300%纯伤害（无视护甲）',      mana: 110, type: 'pureDamage',   multiplier: 3.0 },
};

const STAR_MULTIPLIERS = {
    1: { hp: 1, attack: 1, armor: 1 },
    2: { hp: 2.0, attack: 2.0, armor: 1.5 },
    3: { hp: 4.0, attack: 4.0, armor: 2.0 },
};

const ROUND_CONFIGS = [];
(function buildRoundConfigs() {
    for (let r = 1; r <= MAX_ROUND; r++) {
        const difficulty = Math.floor((r - 1) / 3);
        const budget = 3 + r * 2 + difficulty * 3;
        const maxUnits = Math.min(Math.max(3, 1 + Math.floor(r / 2)), 9);
        const maxTier = Math.min(1 + Math.floor(r / 4), 5);
        const starChance2 = Math.min(0.04 * r, 0.5);
        const starChance3 = Math.max(0, Math.min(0.015 * (r - 20), 0.15));
        ROUND_CONFIGS.push({ round: r, budget, maxUnits, maxTier, starChance2, starChance3 });
    }
})();

const BOSS_ROUNDS = [10, 20, 30];

const BOSS_CONFIGS = {
    10: {
        defId: 'boss_golem', name: '远古石像', icon: '🗿', cost: 5,
        hp: 5000, attack: 90, armor: 16, attackSpeed: 0.6, range: 1,
        reward: 10,
        minions: [
            { name: '石像守卫', icon: '🪨', hp: 1200, attack: 55, armor: 10, attackSpeed: 0.7, range: 1, cost: 2 },
            { name: '石像守卫', icon: '🪨', hp: 1200, attack: 55, armor: 10, attackSpeed: 0.7, range: 1, cost: 2 },
        ],
    },
    20: {
        defId: 'boss_dragon', name: '暗影巨龙', icon: '🐲', cost: 5,
        hp: 12000, attack: 160, armor: 14, attackSpeed: 0.7, range: 2,
        reward: 15,
        minions: [
            { name: '龙崽', icon: '🦎', hp: 2000, attack: 75, armor: 8, attackSpeed: 0.8, range: 2, cost: 3 },
            { name: '龙崽', icon: '🦎', hp: 2000, attack: 75, armor: 8, attackSpeed: 0.8, range: 2, cost: 3 },
        ],
    },
    30: {
        defId: 'boss_void', name: '虚空领主', icon: '👁️', cost: 5,
        hp: 20000, attack: 200, armor: 20, attackSpeed: 0.55, range: 1,
        reward: 20,
        enrageAtHpPct: 0.5,
        minions: [
            { name: '虚空仆从', icon: '👤', hp: 2500, attack: 90, armor: 12, attackSpeed: 0.9, range: 1, cost: 3 },
            { name: '虚空仆从', icon: '👤', hp: 2500, attack: 90, armor: 12, attackSpeed: 0.9, range: 1, cost: 3 },
            { name: '虚空仆从', icon: '👤', hp: 2500, attack: 90, armor: 12, attackSpeed: 0.9, range: 1, cost: 3 },
        ],
    },
};

UNIT_SKILLS['boss_golem']  = { name: '地震猛击', desc: '对周围造成200%伤害并眩晕',  mana: 80,  type: 'aoe', radius: 2, multiplier: 2.0, stunTicks: 4 };
UNIT_SKILLS['boss_dragon'] = { name: '龙焰吐息', desc: '对区域造成250%伤害',         mana: 70,  type: 'aoe', radius: 2, multiplier: 2.5 };
UNIT_SKILLS['boss_void']   = { name: '虚空裂隙', desc: '对所有敌人造成150%伤害',      mana: 100, type: 'damageAll', multiplier: 1.5 };

function getEnemyScaling(round) {
    const r = Math.max(0, round - 5);
    return {
        hpMul:     1 + r * 0.04,
        attackMul: 1 + r * 0.03,
        armorAdd:  Math.floor(Math.max(0, round - 10) * 0.3),
    };
}

const ACHIEVEMENTS = [
    { id: 'first_clear',   name: '初出茅庐',  desc: '首次通关30回合',           icon: '🏆' },
    { id: 'perfect_clear', name: '完美通关',  desc: '满血通关30回合',           icon: '💯' },
    { id: 'three_star',    name: '三星闪耀',  desc: '合成一个3星棋子',          icon: '⭐' },
    { id: 'boss_slayer',   name: 'Boss猎人', desc: '单局击败全部3个Boss',      icon: '🗡️' },
    { id: 'interest_10',   name: '利息大师',  desc: '单回合获得5金利息',        icon: '💰' },
    { id: 'all_races',     name: '全明星',    desc: '单局场上出现过全部5个种族', icon: '🌟' },
    { id: 'demon_lord',    name: '恶魔领主',  desc: '激活4恶魔羁绊',           icon: '👿' },
    { id: 'ten_games',     name: '常客',      desc: '完成10局游戏',            icon: '🎮' },
    { id: 'win_streak_5',  name: '势如破竹',  desc: '达成5连胜',              icon: '🔥' },
    { id: 'budget_win',    name: '以弱胜强',  desc: '仅用1费棋子赢得一场战斗',  icon: '🎯' },
];

function getUnitDef(id) {
    return UNIT_DEFS.find(u => u.id === id);
}

function getUnitsByTier(tier) {
    return UNIT_DEFS.filter(u => u.cost === tier);
}
