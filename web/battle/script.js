// 简单的游戏状态
const gameState = {
  player: {
    name: "星野·主角",
    level: 10,
    power: 5200,
    silver: 5000,
    gold: 120,
    hp: 100,
    maxHp: 100,
    energy: 60,
    maxEnergy: 100,
  },
  hero: {
    name: "星野·主角",
    level: 10,
    basePower: 3000,
    weaponId: null,
    armorId: null,
    mountId: null,
    skills: [],
  },
  allies: [
    { name: "青萝", role: "副将 · 输出", level: 9 },
    { name: "玄甲", role: "副将 · 防御", level: 9 },
    { name: "灵狸", role: "宠物 · 辅助", level: 8 },
  ],
  items: {
    // 所有物品定义
    swdIron: {
      id: "swdIron",
      name: "铁刃长剑",
      type: "weapon",
      power: 400,
      priceGold: 30,
      priceSilver: 0,
      desc: "+400 战力，适合新手剑士。",
    },
    swdMoon: {
      id: "swdMoon",
      name: "月影之刃",
      type: "weapon",
      power: 900,
      priceGold: 80,
      priceSilver: 0,
      desc: "+900 战力，攻击时闪烁月光。",
    },
    armorLeather: {
      id: "armorLeather",
      name: "轻皮护甲",
      type: "armor",
      power: 300,
      priceGold: 20,
      priceSilver: 0,
      desc: "+300 战力，轻便灵活。",
    },
    armorDragon: {
      id: "armorDragon",
      name: "龙鳞战甲",
      type: "armor",
      power: 1100,
      priceGold: 110,
      priceSilver: 0,
      desc: "+1100 战力，提供强力防护。",
    },
    mountHorse: {
      id: "mountHorse",
      name: "青风骏马",
      type: "mount",
      power: 300,
      priceGold: 25,
      priceSilver: 0,
      desc: "+300 战力，提升移动与冲锋。",
    },
    mountDragon: {
      id: "mountDragon",
      name: "苍穹龙翼",
      type: "mount",
      power: 1500,
      priceGold: 160,
      priceSilver: 0,
      desc: "+1500 战力，象征强大与荣耀。",
    },
    potionSmall: {
      id: "potionSmall",
      name: "小型治疗药水",
      type: "consumable",
      power: 0,
      priceGold: 0,
      priceSilver: 80,
      desc: "立即恢复少量生命值。",
    },
    potionEnergy: {
      id: "potionEnergy",
      name: "精力药剂",
      type: "consumable",
      power: 0,
      priceGold: 0,
      priceSilver: 100,
      desc: "恢复精力，用于继续挑战副本。",
    },
  },
  bag: [
    { itemId: "swdIron", qty: 1 },
    { itemId: "armorLeather", qty: 1 },
    { itemId: "mountHorse", qty: 1 },
    { itemId: "potionSmall", qty: 3 },
  ],
  shopStock: [
    { itemId: "swdMoon", qty: 1 },
    { itemId: "armorDragon", qty: 1 },
    { itemId: "mountDragon", qty: 1 },
    { itemId: "potionEnergy", qty: 99 },
  ],
  skillsPool: [
    { id: "skillSlash", name: "星落斩" },
    { id: "skillGuard", name: "灵盾守护" },
    { id: "skillBurst", name: "流光爆发" },
    { id: "skillHeal", name: "月华治愈" },
  ],
  dungeon: {
    worlds: [
      {
        name: "晨曦平原",
        stages: [
          { name: "1-1 林间小道", recommendedPower: 800 },
          { name: "1-2 失落营地", recommendedPower: 1500 },
          { name: "1-3 平原之王", recommendedPower: 2500 },
        ],
      },
      {
        name: "星辉高地",
        stages: [
          { name: "2-1 悬崖边缘", recommendedPower: 3500 },
          { name: "2-2 星光密林", recommendedPower: 5000 },
          { name: "2-3 高地霸主", recommendedPower: 7000 },
        ],
      },
    ],
    currentWorldIndex: 0,
    currentStageIndex: 0,
  },
  events: [
    {
      id: "login",
      title: "每日登录奖励",
      desc: "今日首次登录游戏，获得奖励。",
      reward: { silver: 500, gold: 5, energy: 10 },
      completed: true,
      claimed: false,
    },
    {
      id: "dungeonOnce",
      title: "完成一场副本战斗",
      desc: "任意难度完成 1 次副本战斗。",
      reward: { silver: 700, gold: 10, energy: 0 },
      completed: false,
      claimed: false,
    },
    {
      id: "powerTarget",
      title: "战斗力突破 6000",
      desc: "努力提升装备与阵容，战力达到 6000 以上。",
      reward: { silver: 1500, gold: 20, energy: 0 },
      completed: false,
      claimed: false,
    },
  ],
};

let toastTimer = null;

// 工具函数
function getItem(itemId) {
  return gameState.items[itemId];
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// 导航切换
function setActivePage(pageId) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (btn.dataset.page === pageId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// 属性与侧栏刷新
function updateStatsUI() {
  const p = gameState.player;

  document.getElementById("player-name").textContent = p.name;

  // 首页属性
  document.getElementById("stat-level").textContent = p.level;
  document.getElementById("stat-power").textContent = p.power;
  document.getElementById("stat-silver").textContent = p.silver;
  document.getElementById("stat-gold").textContent = p.gold;

  document.getElementById("stat-hp-text").textContent = `${p.hp}/${p.maxHp}`;
  document.getElementById("stat-energy-text").textContent = `${p.energy}/${p.maxEnergy}`;

  const hpPercent = (p.hp / p.maxHp) * 100;
  const energyPercent = (p.energy / p.maxEnergy) * 100;
  document.getElementById("hp-bar").style.width = `${hpPercent}%`;
  document.getElementById("energy-bar").style.width = `${energyPercent}%`;

  // 侧栏
  document.getElementById("side-level").textContent = p.level;
  document.getElementById("side-power").textContent = p.power;
  document.getElementById("side-silver").textContent = p.silver;
  document.getElementById("side-gold").textContent = p.gold;

  document.getElementById("side-hp-text").textContent = `${p.hp}/${p.maxHp}`;
  document.getElementById("side-energy-text").textContent = `${p.energy}/${p.maxEnergy}`;
  document.getElementById("side-hp-bar").style.width = `${hpPercent}%`;
  document.getElementById("side-energy-bar").style.width = `${energyPercent}%`;
}

// 阵容 UI
function updateLineupUI() {
  const hero = gameState.hero;
  const p = gameState.player;

  document.getElementById("main-hero-name").textContent = hero.name;
  document.getElementById("main-hero-level").textContent = hero.level;
  document.getElementById("main-hero-base-power").textContent = hero.basePower;

  const weapon = hero.weaponId ? getItem(hero.weaponId) : null;
  const armor = hero.armorId ? getItem(hero.armorId) : null;
  const mount = hero.mountId ? getItem(hero.mountId) : null;

  document.getElementById("main-hero-weapon").textContent = weapon ? `${weapon.name} (+${weapon.power})` : "未装备";
  document.getElementById("main-hero-armor").textContent = armor ? `${armor.name} (+${armor.power})` : "未装备";
  document.getElementById("main-hero-mount").textContent = mount ? `${mount.name} (+${mount.power})` : "未装备";

  const equipPower =
    (weapon ? weapon.power : 0) +
    (armor ? armor.power : 0) +
    (mount ? mount.power : 0);

  const totalHeroPower = hero.basePower + equipPower;
  document.getElementById("main-hero-total-power").textContent = totalHeroPower;

  // 用主角战力更新整体战斗力
  p.power = totalHeroPower + 0.5 * p.level * 100;
  p.power = Math.round(p.power);
  document.getElementById("stat-power").textContent = p.power;
  document.getElementById("side-power").textContent = p.power;

  // 副将列表
  const allyList = document.getElementById("ally-list");
  allyList.innerHTML = "";
  gameState.allies.forEach((ally) => {
    const li = document.createElement("li");
    li.className = "ally-item";
    li.textContent = `${ally.name}（${ally.role}） Lv.${ally.level}`;
    allyList.appendChild(li);
  });

  // 技能标签
  const skillList = document.getElementById("skill-list");
  skillList.innerHTML = "";
  hero.skills.forEach((sk) => {
    const li = document.createElement("li");
    li.className = "tag";
    li.textContent = sk.name;
    skillList.appendChild(li);
  });

  // 检查战力活动
  const powerEvent = gameState.events.find((e) => e.id === "powerTarget");
  if (powerEvent && !powerEvent.completed && p.power >= 6000) {
    powerEvent.completed = true;
    showToast("活动达成：战斗力突破 6000！");
    renderEvents();
  }
}

// 填充装备 / 技能下拉
function initSelects() {
  const weaponSelect = document.getElementById("weapon-select");
  const armorSelect = document.getElementById("armor-select");
  const mountSelect = document.getElementById("mount-select");
  const skillSelect = document.getElementById("skill-select");

  function fillSelect(select, items, placeholder) {
    select.innerHTML = "";
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = placeholder;
    select.appendChild(optEmpty);

    items.forEach((itemId) => {
      const item = getItem(itemId);
      if (!item) return;
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = `${item.name} (+${item.power})`;
      select.appendChild(opt);
    });
  }

  const allItemIds = Object.keys(gameState.items);
  const weaponIds = allItemIds.filter((id) => gameState.items[id].type === "weapon");
  const armorIds = allItemIds.filter((id) => gameState.items[id].type === "armor");
  const mountIds = allItemIds.filter((id) => gameState.items[id].type === "mount");

  fillSelect(weaponSelect, weaponIds, "选择武器");
  fillSelect(armorSelect, armorIds, "选择护甲");
  fillSelect(mountSelect, mountIds, "选择坐骑");

  // 技能选择
  skillSelect.innerHTML = "";
  const optSkill = document.createElement("option");
  optSkill.value = "";
  optSkill.textContent = "选择要学习的技能";
  skillSelect.appendChild(optSkill);
  gameState.skillsPool.forEach((sk) => {
    const opt = document.createElement("option");
    opt.value = sk.id;
    opt.textContent = sk.name;
    skillSelect.appendChild(opt);
  });
}

// 背包与商场渲染
function renderInventory() {
  const inventoryList = document.getElementById("inventory-list");
  const shopList = document.getElementById("shop-list");

  inventoryList.innerHTML = "";
  shopList.innerHTML = "";

  gameState.bag.forEach((slot) => {
    const item = getItem(slot.itemId);
    if (!item) return;
    const li = document.createElement("li");
    li.className = "item-card";

    li.innerHTML = `
      <div class="item-header">
        <span class="item-name">${item.name}</span>
        <span class="item-tag">背包 x${slot.qty}</span>
      </div>
      <div class="item-meta">
        <span>${item.type === "weapon" || item.type === "armor" || item.type === "mount" ? `战力 +${item.power}` : "消耗品"}</span>
        <span>出售：+${Math.max(item.priceGold * 10 || item.priceSilver || 50)} 银币</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const btn = document.createElement("button");
    btn.className = "mini-btn";
    btn.textContent = "出售";
    btn.addEventListener("click", () => sellItem(item.id));
    actions.appendChild(btn);
    li.appendChild(actions);

    inventoryList.appendChild(li);
  });

  gameState.shopStock.forEach((slot) => {
    const item = getItem(slot.itemId);
    if (!item) return;
    const li = document.createElement("li");
    li.className = "item-card";

    let priceText =
      item.priceGold > 0
        ? `${item.priceGold} 金`
        : `${item.priceSilver || 100} 银`;

    li.innerHTML = `
      <div class="item-header">
        <span class="item-name">${item.name}</span>
        <span class="item-tag">库存 ${slot.qty === 99 ? "∞" : "x" + slot.qty}</span>
      </div>
      <div class="item-meta">
        <span>${item.type === "weapon" || item.type === "armor" || item.type === "mount" ? `战力 +${item.power}` : "消耗品"}</span>
        <span>价格：${priceText}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const btn = document.createElement("button");
    btn.className = "mini-btn";
    btn.textContent = "购买";

    const canBuyGold = item.priceGold > 0 && gameState.player.gold >= item.priceGold;
    const canBuySilver =
      item.priceGold === 0 &&
      gameState.player.silver >= (item.priceSilver || 100);

    if (!canBuyGold && !canBuySilver) {
      btn.classList.add("disabled");
    }

    btn.addEventListener("click", () => buyItem(item.id));
    actions.appendChild(btn);
    li.appendChild(actions);

    shopList.appendChild(li);
  });
}

function sellItem(itemId) {
  const bagSlot = gameState.bag.find((slot) => slot.itemId === itemId);
  if (!bagSlot || bagSlot.qty <= 0) {
    showToast("没有可出售的该物品。");
    return;
  }

  const item = getItem(itemId);
  const earnSilver = Math.max(item.priceGold * 10 || item.priceSilver || 50);
  gameState.player.silver += earnSilver;
  bagSlot.qty -= 1;
  if (bagSlot.qty <= 0) {
    gameState.bag = gameState.bag.filter((slot) => slot.qty > 0);
  }

  showToast(`出售 ${item.name}，获得 ${earnSilver} 银币。`);
  updateStatsUI();
  renderInventory();
}

function buyItem(itemId) {
  const slot = gameState.shopStock.find((s) => s.itemId === itemId);
  if (!slot) return;
  const item = getItem(itemId);
  const p = gameState.player;

  const useGold = item.priceGold > 0;
  if (useGold) {
    if (p.gold < item.priceGold) {
      showToast("黄金不足，无法购买。");
      return;
    }
    p.gold -= item.priceGold;
  } else {
    const costSilver = item.priceSilver || 100;
    if (p.silver < costSilver) {
      showToast("银币不足，无法购买。");
      return;
    }
    p.silver -= costSilver;
  }

  const bagSlot = gameState.bag.find((s) => s.itemId === itemId);
  if (bagSlot) {
    bagSlot.qty += 1;
  } else {
    gameState.bag.push({ itemId, qty: 1 });
  }

  if (slot.qty !== 99) {
    slot.qty -= 1;
    if (slot.qty <= 0) {
      gameState.shopStock = gameState.shopStock.filter((s) => s.qty > 0);
    }
  }

  showToast(`成功购买 ${item.name}！`);
  updateStatsUI();
  renderInventory();
}

// 副本 UI
function updateDungeonUI() {
  const d = gameState.dungeon;
  const world = d.worlds[d.currentWorldIndex];
  const stage = world.stages[d.currentStageIndex];

  document.getElementById("world-name").textContent = world.name;
  document.getElementById("stage-name").textContent = stage.name;
  document.getElementById("stage-power").textContent = stage.recommendedPower;
}

function appendLogLine(text, type = "") {
  const logBox = document.getElementById("battle-log");
  const div = document.createElement("div");
  div.className = "log-line";
  if (type) div.classList.add(type);
  div.textContent = text;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

function simulateBattle() {
  const p = gameState.player;
  const d = gameState.dungeon;
  const world = d.worlds[d.currentWorldIndex];
  const stage = world.stages[d.currentStageIndex];
  const heroPower = p.power;

  if (p.energy < 10) {
    showToast("精力不足（需要 10 点），无法进入副本。");
    return;
  }

  // 扣精力
  p.energy = clamp(p.energy - 10, 0, p.maxEnergy);
  updateStatsUI();

  const logBox = document.getElementById("battle-log");
  logBox.innerHTML = "";
  appendLogLine(`进入副本：${world.name} - ${stage.name}`, "system");

  let playerHp = p.hp;
  const baseEnemyHp = 80 + stage.recommendedPower * 0.5;
  let enemyHp = baseEnemyHp;

  appendLogLine(`敌方战力约为 ${stage.recommendedPower}，生命值约为 ${Math.round(baseEnemyHp)}。`, "system");

  const maxRounds = 12;
  for (let round = 1; round <= maxRounds; round++) {
    if (playerHp <= 0 || enemyHp <= 0) break;

    const playerDmgBase = heroPower * 0.12;
    const enemyDmgBase = stage.recommendedPower * 0.12;

    const playerDmg = Math.max(
      10,
      Math.round(playerDmgBase * (0.8 + Math.random() * 0.5))
    );
    const enemyDmg = Math.max(
      5,
      Math.round(enemyDmgBase * (0.7 + Math.random() * 0.6))
    );

    enemyHp -= playerDmg;
    appendLogLine(`第 ${round} 回合：你对敌人造成 ${playerDmg} 点伤害。`);

    if (enemyHp <= 0) {
      appendLogLine("敌人倒下了！", "system");
      break;
    }

    playerHp -= enemyDmg;
    appendLogLine(`第 ${round} 回合：敌人对你造成 ${enemyDmg} 点伤害。`);
  }

  const win = enemyHp <= 0 && playerHp > 0;
  p.hp = clamp(Math.round(playerHp), 1, p.maxHp);

  if (win) {
    const earnSilver = 200 + Math.round(stage.recommendedPower * 0.2);
    const earnExp = 20;
    p.silver += earnSilver;
    p.level += 0.1; // 只是示意，避免数字太快涨
    p.level = Math.round(p.level * 10) / 10;

    appendLogLine(`战斗胜利！获得 ${earnSilver} 银币与少量经验。`, "win");
    showToast("你赢得了这场战斗！");
    // 标记活动“打一次副本”为完成
    const event = gameState.events.find((e) => e.id === "dungeonOnce");
    if (event && !event.completed) {
      event.completed = true;
      renderEvents();
      showToast("活动达成：完成一场副本战斗！");
    }
  } else {
    appendLogLine("战斗失败，你暂时撤退了。", "lose");
    showToast("战斗失败，注意提升战斗力。");
  }

  updateStatsUI();
}

// 活动 UI
function renderEvents() {
  const list = document.getElementById("event-list");
  list.innerHTML = "";

  gameState.events.forEach((evt) => {
    const li = document.createElement("li");
    li.className = "event-card";

    const rewardTextParts = [];
    if (evt.reward.silver) rewardTextParts.push(`银币 +${evt.reward.silver}`);
    if (evt.reward.gold) rewardTextParts.push(`黄金 +${evt.reward.gold}`);
    if (evt.reward.energy) rewardTextParts.push(`精力 +${evt.reward.energy}`);

    li.innerHTML = `
      <div>
        <div class="event-title">${evt.title}</div>
        <div class="event-desc">${evt.desc}</div>
        <div class="event-reward">奖励：${rewardTextParts.join("，")}</div>
      </div>
      <div class="event-status">
      </div>
    `;

    const statusEl = li.querySelector(".event-status");
    if (evt.claimed) {
      statusEl.textContent = "已领取";
    } else if (!evt.completed) {
      statusEl.textContent = "未完成";
    } else {
      const btn = document.createElement("button");
      btn.className = "mini-btn";
      btn.textContent = "领取奖励";
      btn.addEventListener("click", () => claimEventReward(evt.id));
      statusEl.appendChild(btn);
    }

    list.appendChild(li);
  });
}

function claimEventReward(eventId) {
  const evt = gameState.events.find((e) => e.id === eventId);
  if (!evt || !evt.completed || evt.claimed) return;

  const p = gameState.player;
  if (evt.reward.silver) p.silver += evt.reward.silver;
  if (evt.reward.gold) p.gold += evt.reward.gold;
  if (evt.reward.energy) {
    p.energy = clamp(p.energy + evt.reward.energy, 0, p.maxEnergy);
  }

  evt.claimed = true;
  renderEvents();
  updateStatsUI();
  showToast(`已领取活动奖励：${evt.title}`);
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  // 导航
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActivePage(btn.dataset.page));
  });

  // 首页按钮
  document.getElementById("go-dungeon-btn").addEventListener("click", () => {
    setActivePage("dungeon");
  });
  document.getElementById("go-events-btn").addEventListener("click", () => {
    setActivePage("events");
  });

  // 装备按钮
  document.getElementById("equip-weapon-btn").addEventListener("click", () => {
    const select = document.getElementById("weapon-select");
    const itemId = select.value;
    if (!itemId) {
      showToast("请先选择武器。");
      return;
    }
    gameState.hero.weaponId = itemId;
    showToast("武器装备成功。");
    updateLineupUI();
    updateStatsUI();
  });

  document.getElementById("equip-armor-btn").addEventListener("click", () => {
    const select = document.getElementById("armor-select");
    const itemId = select.value;
    if (!itemId) {
      showToast("请先选择护甲。");
      return;
    }
    gameState.hero.armorId = itemId;
    showToast("护甲装备成功。");
    updateLineupUI();
    updateStatsUI();
  });

  document.getElementById("equip-mount-btn").addEventListener("click", () => {
    const select = document.getElementById("mount-select");
    const itemId = select.value;
    if (!itemId) {
      showToast("请先选择坐骑。");
      return;
    }
    gameState.hero.mountId = itemId;
    showToast("坐骑已骑乘。");
    updateLineupUI();
    updateStatsUI();
  });

  // 学习技能
  document.getElementById("learn-skill-btn").addEventListener("click", () => {
    const select = document.getElementById("skill-select");
    const skillId = select.value;
    if (!skillId) {
      showToast("请选择一个技能。");
      return;
    }
    const sk = gameState.skillsPool.find((s) => s.id === skillId);
    if (!sk) return;
    if (gameState.hero.skills.some((s) => s.id === skillId)) {
      showToast("已学习该技能。");
      return;
    }
    if (gameState.hero.skills.length >= 4) {
      showToast("技能栏已满（最多 4 个），请在设计中添加“重置/替换”逻辑。");
      return;
    }
    gameState.hero.skills.push(sk);
    showToast(`学习技能：${sk.name}`);
    updateLineupUI();
  });

  // 副本按钮
  document.getElementById("prev-stage-btn").addEventListener("click", () => {
    const d = gameState.dungeon;
    if (d.currentStageIndex > 0) {
      d.currentStageIndex--;
    } else if (d.currentWorldIndex > 0) {
      d.currentWorldIndex--;
      d.currentStageIndex = d.worlds[d.currentWorldIndex].stages.length - 1;
    }
    updateDungeonUI();
  });

  document.getElementById("next-stage-btn").addEventListener("click", () => {
    const d = gameState.dungeon;
    const world = d.worlds[d.currentWorldIndex];
    if (d.currentStageIndex < world.stages.length - 1) {
      d.currentStageIndex++;
    } else if (d.currentWorldIndex < d.worlds.length - 1) {
      d.currentWorldIndex++;
      d.currentStageIndex = 0;
    }
    updateDungeonUI();
  });

  document.getElementById("fight-btn").addEventListener("click", () => {
    simulateBattle();
  });

  // 初始化数据
  initSelects();
  updateLineupUI();
  updateStatsUI();
  updateDungeonUI();
  renderInventory();
  renderEvents();
});
