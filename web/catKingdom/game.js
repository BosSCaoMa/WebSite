/**
 * 游戏配置与数据结构
 */
const CONFIG = {
    tickRate: 1000,
    seasons: ['春季', '夏季', '秋季', '冬季'],
    seasonModifiers: [1.0, 1.0, 1.2, 0.25]
};

const defaultState = {
    resources: {
        catnip: { name: '猫薄荷', amount: 0, max: 200, perTick: 0 },
        wood: { name: '木材', amount: 0, max: 100, perTick: 0 },
        furs: { name: '皮毛', amount: 0, max: 50, perTick: 0 } // 新增资源
    },
    buildings: {
        catnipField: { 
            name: '猫薄荷田', 
            desc: '改良土壤，自动生长猫薄荷。',
            count: 0, 
            baseCost: { catnip: 10 }, 
            priceRatio: 1.12, 
            effect: { catnip: 0.65 }
        },
        pasture: {
            name: '牧场',
            desc: '增加猫薄荷存储上限。',
            count: 0,
            baseCost: { catnip: 100, wood: 10 },
            priceRatio: 1.15,
            effect: { maxCatnip: 500 }
        }
    },
    time: { year: 1, seasonIndex: 0, ticks: 0 },
    // 玩家战斗属性
    player: { hp: 100, maxHp: 100, atk: 5 }
};

let state = JSON.parse(JSON.stringify(defaultState));

// 敌人配置
const ENEMIES = [
    { name: "老鼠", hp: 15, atk: 2, xp: 5, loot: { furs: 1 }, icon: "🐀" },
    { name: "浣熊", hp: 40, atk: 5, xp: 15, loot: { furs: 3, catnip: 20 }, icon: "🦝" },
    { name: "野狼", hp: 80, atk: 12, xp: 30, loot: { furs: 8, wood: 5 }, icon: "🐺" }
];

/**
 * 游戏主逻辑
 */
const Game = {
    init: function() {
        this.loadGame();
        this.renderUIStructure();
        
        setInterval(() => this.tick(), CONFIG.tickRate); // 逻辑循环
        setInterval(() => this.updateUI(), 100);        // UI循环

        this.log("欢迎来到猫国！");
    },

    // 视图切换
    switchView: function(viewName) {
        // 隐藏所有视图
        document.querySelectorAll('.game-view').forEach(el => {
            el.classList.remove('active-view');
            el.classList.add('hidden');
        });
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

        // 显示目标
        const target = document.getElementById(`view-${viewName}`);
        if(target) {
            target.classList.remove('hidden');
            target.classList.add('active-view');
        }
        document.getElementById(`tab-${viewName}`).classList.add('active');

        // 如果进入副本，确保刷新一次副本UI
        if(viewName === 'dungeon') Dungeon.updateStats();
    },

    tick: function() {
        state.time.ticks++;
        
        // 季节逻辑
        if (state.time.ticks % 50 === 0) {
            state.time.seasonIndex++;
            if (state.time.seasonIndex > 3) {
                state.time.seasonIndex = 0;
                state.time.year++;
                this.log(`新的一年！第 ${state.time.year} 年。`);
            }
        }
        
        // 自动回血 (战斗外)
        if (!Dungeon.inCombat && state.player.hp < state.player.maxHp && state.time.ticks % 5 === 0) {
            state.player.hp++;
            if(state.player.hp > state.player.maxHp) state.player.hp = state.player.maxHp;
        }

        this.calculateProduction();
        if (state.time.ticks % 10 === 0) this.saveGame(true);
    },

    calculateProduction: function() {
        let catnipProd = state.buildings.catnipField.count * state.buildings.catnipField.effect.catnip;
        const seasonMod = CONFIG.seasonModifiers[state.time.seasonIndex];
        catnipProd *= seasonMod;

        state.resources.catnip.perTick = catnipProd;
        this.addResource('catnip', catnipProd);
    },

    // 基础操作
    clickGather: function() { this.addResource('catnip', 1); },
    refineWood: function() {
        if (state.resources.catnip.amount >= 100) {
            state.resources.catnip.amount -= 100;
            this.addResource('wood', 1);
        } else {
            this.log("猫薄荷不足 100！");
        }
    },

    buyBuilding: function(id) {
        const b = state.buildings[id];
        const cost = this.getBuildingCost(id);
        
        let canAfford = true;
        for (let res in cost) {
            if (state.resources[res].amount < cost[res]) canAfford = false;
        }

        if (canAfford) {
            for (let res in cost) state.resources[res].amount -= cost[res];
            b.count++;
            if (id === 'pasture') state.resources.catnip.max += b.effect.maxCatnip;
            this.log(`建造了 ${b.name}`);
        }
    },

    getBuildingCost: function(id) {
        const b = state.buildings[id];
        let currentCost = {};
        for (let res in b.baseCost) {
            currentCost[res] = Math.floor(b.baseCost[res] * Math.pow(b.priceRatio, b.count));
        }
        return currentCost;
    },

    addResource: function(type, val) {
        if (!state.resources[type]) return;
        state.resources[type].amount += val;
        if (state.resources[type].amount > state.resources[type].max) {
            state.resources[type].amount = state.resources[type].max;
        }
    },

    // 初始化 HTML
    renderUIStructure: function() {
        const resContainer = document.getElementById('resources-list');
        resContainer.innerHTML = '';
        for (let key in state.resources) {
            resContainer.innerHTML += `
                <div class="resource-item">
                    <span class="res-name">${state.resources[key].name}</span>
                    <div>
                        <span class="res-val" id="val-${key}">0</span> / <span id="max-${key}">0</span>
                        <span class="res-rate" id="rate-${key}">(+0)</span>
                    </div>
                </div>
            `;
        }

        const buildContainer = document.getElementById('buildings-list');
        buildContainer.innerHTML = '';
        for (let key in state.buildings) {
            const b = state.buildings[key];
            buildContainer.innerHTML += `
                <div class="building-item">
                    <div class="building-info">
                        <h3>${b.name} <span style="font-size:0.8em;color:#999" id="lvl-${key}">(lv.0)</span></h3>
                        <p>${b.desc}</p>
                        <p style="font-size:0.85em;color:#b58900" id="cost-${key}">价格: ...</p>
                    </div>
                    <button class="buy-btn" id="btn-buy-${key}" onclick="Game.buyBuilding('${key}')">建造</button>
                </div>
            `;
        }
    },

    updateUI: function() {
        // 更新资源
        for (let key in state.resources) {
            const r = state.resources[key];
            document.getElementById(`val-${key}`).innerText = Math.floor(r.amount);
            document.getElementById(`max-${key}`).innerText = r.max;
            let rateText = r.perTick > 0 ? `(+${r.perTick.toFixed(1)}/s)` : '';
            if (key === 'catnip' && state.time.seasonIndex === 3) rateText += ' ❄️';
            document.getElementById(`rate-${key}`).innerText = rateText;
        }

        // 更新副本里的皮毛显示
        const furs = state.resources.furs;
        if(furs) document.getElementById('val-furs-dungeon').innerText = Math.floor(furs.amount);

        // 更新建筑
        for (let key in state.buildings) {
            const cost = this.getBuildingCost(key);
            let costStr = [];
            let canAfford = true;
            for (let res in cost) {
                costStr.push(`${state.resources[res].name}: ${cost[res]}`);
                if (state.resources[res].amount < cost[res]) canAfford = false;
            }
            document.getElementById(`cost-${key}`).innerText = costStr.join(', ');
            document.getElementById(`lvl-${key}`).innerText = `(lv.${state.buildings[key].count})`;
            document.getElementById(`btn-buy-${key}`).disabled = !canAfford;
        }

        // 更新时间与副本UI
        document.getElementById('calendar').innerText = `第 ${state.time.year} 年 - ${CONFIG.seasons[state.time.seasonIndex]}`;
        
        // 刷新副本血条
        Dungeon.updateStats();
    },

    log: function(msg) {
        const list = document.getElementById('log-list');
        const item = document.createElement('li');
        item.innerText = `[${state.time.ticks}] ${msg}`;
        list.insertBefore(item, list.firstChild);
        if (list.children.length > 8) list.removeChild(list.lastChild);
    },

    // 存档系统
    saveGame: function(silent) {
        localStorage.setItem('kittens_rpg_save', JSON.stringify(state));
        if(!silent) this.log("游戏已保存");
    },
    loadGame: function() {
        const save = localStorage.getItem('kittens_rpg_save');
        if (save) {
            try {
                const saved = JSON.parse(save);
                // 简单合并 (生产环境需深度合并)
                state = { ...defaultState, ...saved };
                // 恢复深层对象
                state.resources = { ...defaultState.resources, ...saved.resources };
                state.buildings = { ...defaultState.buildings, ...saved.buildings };
                state.player = { ...defaultState.player, ...saved.player };
            } catch(e) { console.error(e); }
        }
    },
    resetGame: function() {
        if(confirm("确定重置？")) {
            localStorage.removeItem('kittens_rpg_save');
            location.reload();
        }
    }
};

/**
 * 副本逻辑模块
 */
const Dungeon = {
    inCombat: false,
    currentEnemy: null,

    // 探索寻找敌人
    explore: function() {
        if (this.inCombat) return;

        // 根据随机概率挑选敌人
        const rand = Math.random();
        let enemyTemplate;
        if (rand < 0.6) enemyTemplate = ENEMIES[0]; // 60% 老鼠
        else if (rand < 0.9) enemyTemplate = ENEMIES[1]; // 30% 浣熊
        else enemyTemplate = ENEMIES[2]; // 10% 狼

        // 创建敌人实例
        this.currentEnemy = JSON.parse(JSON.stringify(enemyTemplate));
        this.currentEnemy.maxHp = this.currentEnemy.hp;
        
        this.inCombat = true;
        this.renderCombatUI();
        this.logCombat(`你发现了一只 ${this.currentEnemy.name}！`);
    },

    // 玩家攻击
    playerAttack: function() {
        if (!this.inCombat) return;

        // 玩家伤害 (基础5 + 随机波动)
        const dmg = Math.floor(state.player.atk + Math.random() * 3);
        this.currentEnemy.hp -= dmg;
        this.logCombat(`你攻击了 ${this.currentEnemy.name}，造成 ${dmg} 点伤害。`, 'dmg-out');

        if (this.currentEnemy.hp <= 0) {
            this.winCombat();
        } else {
            // 敌人反击
            setTimeout(() => this.enemyTurn(), 300); // 稍微延迟增加打击感
        }
        this.updateStats();
    },

    // 敌人攻击
    enemyTurn: function() {
        if (!this.inCombat) return;
        const dmg = Math.floor(this.currentEnemy.atk + Math.random() * 2);
        state.player.hp -= dmg;
        this.logCombat(`${this.currentEnemy.name} 咬了你，受到 ${dmg} 点伤害！`, 'dmg-in');

        if (state.player.hp <= 0) {
            state.player.hp = 0;
            this.loseCombat();
        }
        this.updateStats();
    },

    // 胜利结算
    winCombat: function() {
        this.logCombat(`你击败了 ${this.currentEnemy.name}！`);
        
        // 发放奖励
        let lootMsg = "获得战利品: ";
        for (let key in this.currentEnemy.loot) {
            const amount = this.currentEnemy.loot[key];
            Game.addResource(key, amount);
            lootMsg += `${state.resources[key].name} x${amount} `;
        }
        this.logCombat(lootMsg, 'loot');

        this.inCombat = false;
        this.currentEnemy = null;
        this.renderCombatUI();
    },

    // 失败/逃跑
    loseCombat: function() {
        this.logCombat("你被打倒了... 被迫爬回村庄养伤。");
        this.inCombat = false;
        this.currentEnemy = null;
        this.renderCombatUI();
    },

    flee: function() {
        this.logCombat("你逃跑了！");
        this.inCombat = false;
        this.currentEnemy = null;
        this.renderCombatUI();
    },

    // 更新UI显示
    updateStats: function() {
        // 玩家血条
        const hpPct = (state.player.hp / state.player.maxHp) * 100;
        document.getElementById('hero-hp-bar').style.width = `${hpPct}%`;
        document.getElementById('hero-hp-text').innerText = `${state.player.hp} / ${state.player.maxHp}`;
        document.getElementById('hero-atk').innerText = state.player.atk;

        // 敌人血条
        if (this.inCombat && this.currentEnemy) {
            const enemyPct = (this.currentEnemy.hp / this.currentEnemy.maxHp) * 100;
            document.getElementById('enemy-hp-bar').style.width = `${Math.max(0, enemyPct)}%`;
            document.getElementById('enemy-hp-text').innerText = Math.max(0, this.currentEnemy.hp);
        }
    },

    renderCombatUI: function() {
        const idleDiv = document.getElementById('state-idle');
        const combatDiv = document.getElementById('state-combat');

        if (this.inCombat) {
            idleDiv.classList.add('hidden');
            combatDiv.classList.remove('hidden');
            
            // 填充敌人信息
            document.getElementById('enemy-name').innerText = this.currentEnemy.name;
            document.getElementById('enemy-avatar').innerText = this.currentEnemy.icon;
        } else {
            idleDiv.classList.remove('hidden');
            combatDiv.classList.add('hidden');
        }
        this.updateStats();
    },

    logCombat: function(msg, type='') {
        const list = document.getElementById('combat-log');
        const li = document.createElement('li');
        li.innerText = msg;
        if(type) li.className = type;
        list.insertBefore(li, list.firstChild);
        if (list.children.length > 6) list.removeChild(list.lastChild);
    }
};

Game.init();
