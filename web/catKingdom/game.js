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
        wood: { name: '木材', amount: 0, max: 100, perTick: 0 }
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
    time: {
        year: 1,
        seasonIndex: 0,
        ticks: 0
    }
};

let state = JSON.parse(JSON.stringify(defaultState));

/**
 * 游戏核心逻辑
 */
const Game = {
    init: function() {
        this.loadGame();
        this.renderUIStructure();
        
        // 游戏循环
        setInterval(() => this.tick(), CONFIG.tickRate);
        setInterval(() => this.updateUI(), 100);

        this.log("游戏已加载。准备好建设你的猫国了吗？");
    },

    // ===== 视图切换逻辑 =====
    switchView: function(viewName) {
        // 1. 隐藏所有视图
        document.querySelectorAll('.game-view').forEach(el => {
            el.classList.remove('active-view');
            el.classList.add('hidden');
        });
        
        // 2. 取消所有导航激活状态
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

        // 3. 显示目标视图
        const targetView = document.getElementById(`view-${viewName}`);
        if(targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active-view');
        }

        // 4. 激活对应按钮
        const targetBtn = document.getElementById(`tab-${viewName}`);
        if(targetBtn) {
            targetBtn.classList.add('active');
        }
    },

    // ===== 核心循环 =====
    tick: function() {
        state.time.ticks++;
        
        // 季节更替
        if (state.time.ticks % 50 === 0) {
            state.time.seasonIndex++;
            if (state.time.seasonIndex > 3) {
                state.time.seasonIndex = 0;
                state.time.year++;
                this.log(`新的一年到了！第 ${state.time.year} 年。`);
            }
        }

        this.calculateProduction();

        // 自动保存
        if (state.time.ticks % 10 === 0) {
            this.saveGame(true);
        }
    },

    calculateProduction: function() {
        let catnipProd = state.buildings.catnipField.count * state.buildings.catnipField.effect.catnip;
        const seasonMod = CONFIG.seasonModifiers[state.time.seasonIndex];
        catnipProd *= seasonMod;

        state.resources.catnip.perTick = catnipProd;
        this.addResource('catnip', catnipProd);
    },

    // ===== 玩家操作 =====
    clickGather: function() {
        this.addResource('catnip', 1);
    },

    refineWood: function() {
        if (state.resources.catnip.amount >= 100) {
            state.resources.catnip.amount -= 100;
            this.addResource('wood', 1);
        } else {
            this.log("猫薄荷不足！需要100个。");
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
            this.log(`建造了 ${b.name} (总数: ${b.count})`);
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
        state.resources[type].amount += val;
        if (state.resources[type].amount > state.resources[type].max) {
            state.resources[type].amount = state.resources[type].max;
        }
    },

    // ===== UI 渲染 =====
    // 初始化列表DOM结构 (只执行一次)
    renderUIStructure: function() {
        const resContainer = document.getElementById('resources-list');
        resContainer.innerHTML = '';
        for (let key in state.resources) {
            resContainer.innerHTML += `
                <div class="resource-item">
                    <span class="res-name">${state.resources[key].name}</span>
                    <div>
                        <span class="res-val" id="val-${key}">0</span>
                        <span style="color:#aaa; font-size:0.9em;">/ <span id="max-${key}">0</span></span>
                        <span class="res-rate" id="rate-${key}">(+0/s)</span>
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
                        <h3>${b.name} <span style="font-size:0.8em; color:#93a1a1;" id="lvl-${key}">(lv.0)</span></h3>
                        <p>${b.desc}</p>
                        <p style="font-size:0.85em; margin-top:6px; color:#b58900;" id="cost-${key}">价格: ...</p>
                    </div>
                    <button class="buy-btn" id="btn-buy-${key}" onclick="Game.buyBuilding('${key}')">建造</button>
                </div>
            `;
        }
    },

    // 高频更新数值
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

        // 更新建筑
        for (let key in state.buildings) {
            const cost = this.getBuildingCost(key);
            let costStr = [];
            let canAfford = true;

            for (let res in cost) {
                costStr.push(`${state.resources[res].name}: ${cost[res]}`);
                if (state.resources[res].amount < cost[res]) canAfford = false;
            }

            document.getElementById(`cost-${key}`).innerText = "花费: " + costStr.join(', ');
            document.getElementById(`lvl-${key}`).innerText = `(lv.${state.buildings[key].count})`;
            
            const btn = document.getElementById(`btn-buy-${key}`);
            if(btn) btn.disabled = !canAfford;
        }

        // 更新时间
        document.getElementById('calendar').innerText = `第 ${state.time.year} 年 - ${CONFIG.seasons[state.time.seasonIndex]}`;
    },

    log: function(msg) {
        const list = document.getElementById('log-list');
        const item = document.createElement('li');
        item.className = 'new';
        item.innerText = `[${state.time.ticks}] ${msg}`;
        list.insertBefore(item, list.firstChild);
        if (list.children.length > 8) list.removeChild(list.lastChild);
    },

    // ===== 存档系统 =====
    saveGame: function(silent = false) {
        localStorage.setItem('kittens_lite_save', JSON.stringify(state));
        if (!silent) this.log("游戏已保存。");
    },

    loadGame: function() {
        const save = localStorage.getItem('kittens_lite_save');
        if (save) {
            try {
                const savedState = JSON.parse(save);
                // 深度合并逻辑简化版
                state = { ...defaultState, ...savedState, resources: {...defaultState.resources}, buildings: {...defaultState.buildings} };
                
                // 恢复具体数值
                for(let k in savedState.resources) {
                    if(state.resources[k]) {
                        state.resources[k].amount = savedState.resources[k].amount;
                        state.resources[k].max = savedState.resources[k].max;
                    }
                }
                for(let k in savedState.buildings) {
                    if(state.buildings[k]) state.buildings[k].count = savedState.buildings[k].count;
                }
                this.log("欢迎回来！");
            } catch (e) {
                console.error(e);
            }
        }
    },

    resetGame: function() {
        if(confirm("确定要重置？所有进度将丢失！")) {
            localStorage.removeItem('kittens_lite_save');
            location.reload();
        }
    },

    exportSave: function() {
        const base64 = btoa(JSON.stringify(state));
        prompt("复制存档代码：", base64);
    },

    importSave: function() {
        const base64 = prompt("粘贴存档代码：");
        if (base64) {
            try {
                const json = atob(base64);
                localStorage.setItem('kittens_lite_save', json);
                location.reload();
            } catch (e) {
                alert("存档格式错误");
            }
        }
    }
};

// 启动游戏
Game.init();
