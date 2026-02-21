// ============================================================
// MuriloV3D - app.js  (Vanilla JS, modular)
// ============================================================

// ─── Constants ───────────────────────────────────────────────
const STORE_KEYS = {
    costs: 'mv3d_costs',
    history: 'mv3d_history',
    sheetsUrl: 'mv3d_sheets_url',
};

// ─── Google Sheets Sync ───────────────────────────────────────
function getSheetsUrl() {
    return localStorage.getItem(STORE_KEYS.sheetsUrl) || '';
}
function setSheetsUrl(url) {
    localStorage.setItem(STORE_KEYS.sheetsUrl, url.trim());
}
async function sheetsGet(action) {
    const url = getSheetsUrl();
    if (!url) return null;
    try {
        const res = await fetch(`${url}?action=${action}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        return data;
    } catch (e) { console.error('Sheets GET:', e); return null; }
}
async function sheetsPost(payload) {
    const url = getSheetsUrl();
    if (!url) return null;
    try {
        const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        return data;
    } catch (e) { console.error('Sheets POST:', e); return null; }
}
async function syncToSheets() {
    if (!getSheetsUrl()) return;
    setSyncStatus('syncing');
    const results = await Promise.all([
        sheetsPost({ action: 'saveHistory', history: state.history }),
        sheetsPost({ action: 'saveCosts', costs: state.costs }),
    ]);
    setSyncStatus(results.every(r => r && r.ok) ? 'ok' : 'error');
}
async function syncFromSheets() {
    if (!getSheetsUrl()) { setSyncStatus('none'); return false; }
    setSyncStatus('syncing');
    try {
        const [hData, cData] = await Promise.all([
            sheetsGet('getHistory'),
            sheetsGet('getCosts'),
        ]);
        if (hData && Array.isArray(hData.history)) {
            state.history = hData.history;
            localStorage.setItem(STORE_KEYS.history, JSON.stringify(state.history));
        }
        if (cData && cData.costs) {
            state.costs = cData.costs;
            localStorage.setItem(STORE_KEYS.costs, JSON.stringify(state.costs));
        }
        setSyncStatus('ok');
        return true;
    } catch (e) { setSyncStatus('error'); return false; }
}
function setSyncStatus(status) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const map = {
        ok:      { icon: '☁️', text: 'Sincronizado', color: '#3fb950' },
        syncing: { icon: '🔄', text: 'Sincronizando…', color: '#d29922' },
        error:   { icon: '⚠️', text: 'Erro no Sheets', color: '#f85149' },
        none:    { icon: '🔌', text: 'Sheets não configurado', color: '#8b949e' },
    };
    const s = map[status] || map.none;
    el.innerHTML = `<span style="color:${s.color}">${s.icon} ${s.text}</span>`;
}

const STATUS_CONFIG = {
    pending: { label: 'Pendente', badge: 'badge-pending', dot: '#d29922' },
    approved: { label: 'Aprovado', badge: 'badge-approved', dot: '#58a6ff' },
    production: { label: 'Em Produção', badge: 'badge-production', dot: '#bc8cff' },
    done: { label: 'Concluído', badge: 'badge-done', dot: '#3fb950' },
    cancelled: { label: 'Cancelado', badge: 'badge-cancelled', dot: '#f85149' },
};

const DEFAULT_COSTS = {
    personnel: [
        { id: uid(), name: 'Murilo', ratePerHour: 66.67 }
    ],
    equipment: [
        { id: uid(), name: 'Ender 3', marketValue: 700.00, watts: 250, deprecYears: 3 },
        { id: uid(), name: 'CR10S', marketValue: 1200.00, watts: 350, deprecYears: 3 },
        { id: uid(), name: 'Bluer', marketValue: 900.00, watts: 200, deprecYears: 3 },
        { id: uid(), name: 'Resina (FDM 1)', marketValue: 1500.00, watts: 150, deprecYears: 3 },
    ],
    materials: [
        { id: uid(), type: 'Filamento', name: 'PLA', totalCost: 85.00, totalQty: 1000 },
        { id: uid(), type: 'Filamento', name: 'TPU', totalCost: 135.00, totalQty: 1000 },
        { id: uid(), type: 'Filamento', name: 'PETG', totalCost: 110.00, totalQty: 1000 },
        { id: uid(), type: 'Resina', name: 'Siraya Tech Blu', totalCost: 180.00, totalQty: 500 },
    ],
    energyCostPerKwh: 1.34,
    officeMonthly: 0,
};

// ─── Utils ────────────────────────────────────────────────────
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fmt(n) {
    return 'R$ ' + (isNaN(n) ? '0,00' : parseFloat(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

function fmtN(n) {
    return isNaN(n) ? 0 : parseFloat(n) || 0;
}

function toastMsg(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ─── State ────────────────────────────────────────────────────
let state = { costs: null, history: [] };
let editingBudgetId = null; // null = create mode, string = edit mode

function loadState() {
    try {
        const c = localStorage.getItem(STORE_KEYS.costs);
        state.costs = c ? JSON.parse(c) : JSON.parse(JSON.stringify(DEFAULT_COSTS));
    } catch { state.costs = JSON.parse(JSON.stringify(DEFAULT_COSTS)); }
    try {
        const h = localStorage.getItem(STORE_KEYS.history);
        state.history = h ? JSON.parse(h) : [];
    } catch { state.history = []; }
}

function saveCosts() {
    localStorage.setItem(STORE_KEYS.costs, JSON.stringify(state.costs));
    syncToSheets();
}

function saveHistory() {
    localStorage.setItem(STORE_KEYS.history, JSON.stringify(state.history));
    syncToSheets();
}

// ─── Tab Navigation ───────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + target).classList.add('active');
            if (target === 'budget') populateBudgetDropdowns();
            if (target === 'history') renderHistory();
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// TAB 1 — BASE DE CUSTOS
// ═══════════════════════════════════════════════════════════════
function initCostsTab() {
    renderPersonnelTable();
    renderEquipmentTable();
    renderMaterialsTable();
    renderFixedCosts();

    document.getElementById('btn-add-person').addEventListener('click', () => {
        state.costs.personnel.push({ id: uid(), name: '', ratePerHour: 0 });
        saveCosts();
        renderPersonnelTable();
    });

    document.getElementById('btn-add-equipment').addEventListener('click', () => {
        state.costs.equipment.push({ id: uid(), name: '', marketValue: 0, watts: 0, deprecYears: 3 });
        saveCosts();
        renderEquipmentTable();
    });

    document.getElementById('btn-add-material').addEventListener('click', () => {
        state.costs.materials.push({ id: uid(), type: 'Filamento', name: '', totalCost: 0, totalQty: 1000 });
        saveCosts();
        renderMaterialsTable();
    });
}

function renderPersonnelTable() {
    const tbody = document.querySelector('#personnel-table tbody');
    tbody.innerHTML = '';
    state.costs.personnel.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><input type="text" value="${esc(p.name)}" data-field="name" data-idx="${i}" data-table="personnel" placeholder="Nome"></td>
      <td><input type="number" value="${p.ratePerHour}" data-field="ratePerHour" data-idx="${i}" data-table="personnel" step="0.01" min="0" placeholder="0.00"></td>
      <td><button class="btn btn-danger btn-sm btn-icon" data-action="del-person" data-idx="${i}" title="Remover">🗑</button></td>
    `;
        tbody.appendChild(tr);
    });
    bindCostTableEvents('#personnel-table', state.costs.personnel, renderPersonnelTable);
}

function renderEquipmentTable() {
    const tbody = document.querySelector('#equipment-table tbody');
    tbody.innerHTML = '';
    state.costs.equipment.forEach((eq, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><input type="text" value="${esc(eq.name)}" data-field="name" data-idx="${i}" data-table="equipment" placeholder="Nome"></td>
      <td><input type="number" value="${eq.marketValue}" data-field="marketValue" data-idx="${i}" data-table="equipment" step="0.01" min="0"></td>
      <td><input type="number" value="${eq.watts}" data-field="watts" data-idx="${i}" data-table="equipment" step="1" min="0"></td>
      <td><input type="number" value="${eq.deprecYears}" data-field="deprecYears" data-idx="${i}" data-table="equipment" step="1" min="1"></td>
      <td><button class="btn btn-danger btn-sm btn-icon" data-action="del-equipment" data-idx="${i}" title="Remover">🗑</button></td>
    `;
        tbody.appendChild(tr);
    });
    bindCostTableEvents('#equipment-table', state.costs.equipment, renderEquipmentTable);
}

function renderMaterialsTable() {
    const tbody = document.querySelector('#materials-table tbody');
    tbody.innerHTML = '';
    state.costs.materials.forEach((m, i) => {
        const costPerG = m.totalQty > 0 ? (m.totalCost / m.totalQty).toFixed(4) : '0.0000';
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>
        <select data-field="type" data-idx="${i}" data-table="materials">
          <option value="Filamento" ${m.type === 'Filamento' ? 'selected' : ''}>Filamento</option>
          <option value="Resina" ${m.type === 'Resina' ? 'selected' : ''}>Resina</option>
        </select>
      </td>
      <td><input type="text" value="${esc(m.name)}" data-field="name" data-idx="${i}" data-table="materials" placeholder="Nome"></td>
      <td><input type="number" value="${m.totalCost}" data-field="totalCost" data-idx="${i}" data-table="materials" step="0.01" min="0"></td>
      <td><input type="number" value="${m.totalQty}" data-field="totalQty" data-idx="${i}" data-table="materials" step="1" min="1"></td>
      <td style="color:#8b949e; font-size:12px; white-space:nowrap">R$ ${costPerG}/g·ml</td>
      <td><button class="btn btn-danger btn-sm btn-icon" data-action="del-material" data-idx="${i}" title="Remover">🗑</button></td>
    `;
        tbody.appendChild(tr);
    });
    bindCostTableEvents('#materials-table', state.costs.materials, renderMaterialsTable);
}

function bindCostTableEvents(tableSelector, arr, renderFn) {
    const table = document.querySelector(tableSelector);

    table.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', () => {
            const idx = parseInt(el.dataset.idx);
            const field = el.dataset.field;
            const val = el.type === 'number' ? parseFloat(el.value) || 0 : el.value;
            arr[idx][field] = val;
            saveCosts();
            if (el.tagName === 'SELECT' || el.type === 'number') renderFn();
        });
    });

    table.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            arr.splice(idx, 1);
            saveCosts();
            renderFn();
        });
    });
}

function renderFixedCosts() {
    const eKwh = document.getElementById('energy-kwh');
    const eOff = document.getElementById('office-monthly');
    eKwh.value = state.costs.energyCostPerKwh;
    eOff.value = state.costs.officeMonthly;

    eKwh.addEventListener('input', () => {
        state.costs.energyCostPerKwh = parseFloat(eKwh.value) || 0;
        saveCosts();
    });
    eOff.addEventListener('input', () => {
        state.costs.officeMonthly = parseFloat(eOff.value) || 0;
        saveCosts();
    });
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ═══════════════════════════════════════════════════════════════
// TAB 2 — NOVO ORÇAMENTO
// ═══════════════════════════════════════════════════════════════
function populateBudgetDropdowns() {
    const selEq = document.getElementById('sel-equipment');
    const selMat = document.getElementById('sel-material');
    const selPerson = document.getElementById('sel-person');

    const eqVal = selEq.value;
    const matVal = selMat.value;
    const perVal = selPerson.value;

    selEq.innerHTML = '<option value="">— Selecionar —</option>' +
        state.costs.equipment.map(e => `<option value="${e.id}" ${e.id === eqVal ? 'selected' : ''}>${esc(e.name)}</option>`).join('');

    selMat.innerHTML = '<option value="">— Selecionar —</option>' +
        state.costs.materials.map(m => `<option value="${m.id}" ${m.id === matVal ? 'selected' : ''}>[${m.type}] ${esc(m.name)}</option>`).join('');

    selPerson.innerHTML = '<option value="">— Selecionar —</option>' +
        state.costs.personnel.map(p => `<option value="${p.id}" ${p.id === perVal ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

// ─── State for "Outros" items ─────────────────────────────────
let outrosItems = []; // [{id, tipo, tempo, quantidade, valor, obs}]

function addOutroItem(data = {}) {
    const id = uid();
    outrosItems.push({ id, tipo: data.tipo || '', tempo: data.tempo || 0, quantidade: data.quantidade || 1, valor: data.valor || 0, obs: data.obs || '' });
    renderOutrosItems();
    calcBudget();
}

function removeOutroItem(id) {
    outrosItems = outrosItems.filter(x => x.id !== id);
    renderOutrosItems();
    calcBudget();
}

function renderOutrosItems() {
    const container = document.getElementById('outros-list');
    if (!container) return;
    container.innerHTML = '';
    if (outrosItems.length === 0) {
        container.innerHTML = '<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:12px 0;">Nenhum item adicionado. Clique em "+ Adicionar Item" para incluir.</p>';
        return;
    }
    outrosItems.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'outro-item';
        div.innerHTML = `
            <div class="outro-item-header">
                <span class="outro-item-label">Item ${idx + 1}</span>
                <button type="button" class="btn btn-danger btn-sm btn-icon" data-outro-del="${item.id}" title="Remover">🗑</button>
            </div>
            <div class="outro-item-grid">
                <div class="form-group">
                    <label>Tipo</label>
                    <input type="text" value="${esc(item.tipo)}" data-outro-field="tipo" data-outro-id="${item.id}" placeholder="Ex: Pós-processamento">
                </div>
                <div class="form-group">
                    <label>Tempo (h)</label>
                    <input type="number" value="${item.tempo}" data-outro-field="tempo" data-outro-id="${item.id}" step="0.25" min="0" placeholder="0">
                </div>
                <div class="form-group">
                    <label>Quantidade</label>
                    <input type="number" value="${item.quantidade}" data-outro-field="quantidade" data-outro-id="${item.id}" step="1" min="1" placeholder="1">
                </div>
                <div class="form-group">
                    <label>Valor Unit. (R$)</label>
                    <input type="number" value="${item.valor}" data-outro-field="valor" data-outro-id="${item.id}" step="0.01" min="0" placeholder="0.00">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Observações</label>
                    <input type="text" value="${esc(item.obs)}" data-outro-field="obs" data-outro-id="${item.id}" placeholder="Observações sobre este item">
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    // Bind events
    container.querySelectorAll('[data-outro-del]').forEach(btn => {
        btn.addEventListener('click', () => removeOutroItem(btn.dataset.outroDel));
    });
    container.querySelectorAll('[data-outro-field]').forEach(input => {
        input.addEventListener('input', () => {
            const id = input.dataset.outroId;
            const field = input.dataset.outroField;
            const item = outrosItems.find(x => x.id === id);
            if (!item) return;
            item[field] = input.type === 'number' ? (parseFloat(input.value) || 0) : input.value;
            calcBudget();
        });
    });
}

function calcOutrosTotal() {
    return outrosItems.reduce((sum, x) => sum + (fmtN(x.valor) * fmtN(x.quantidade)), 0);
}

function initBudgetTab() {
    populateBudgetDropdowns();
    renderOutrosItems();

    const inputs = document.querySelectorAll('#budget-form input, #budget-form select');
    inputs.forEach(el => el.addEventListener('input', calcBudget));

    document.getElementById('btn-add-outro').addEventListener('click', () => addOutroItem());

    document.getElementById('btn-save-budget').addEventListener('click', saveBudget);

    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
        resetBudgetForm();
        toastMsg('Edição cancelada.', 'info');
    });
}

function calcBudget() {
    const get = id => parseFloat(document.getElementById(id)?.value) || 0;
    const getVal = id => document.getElementById(id)?.value || '';

    const eqId = getVal('sel-equipment');
    const eq = state.costs.equipment.find(e => e.id === eqId);

    const matId = getVal('sel-material');
    const mat = state.costs.materials.find(m => m.id === matId);

    const persoId = getVal('sel-person');
    const person = state.costs.personnel.find(p => p.id === persoId);

    const qty = Math.max(1, get('qty-pieces'));
    const printHours = get('time-print');

    // ── 1. Custo da Máquina (Equipamento + Energia + Manutenção) ──
    let equipCostPerHour = 0;
    let energyCostPerHour = 0;
    let deprecPerHour = 0;
    let maintenancePerHour = 0;

    if (eq) {
        // Vida útil estimada em horas (Ex: 8h por dia * 365 dias * anos de depreciação)
        const deprecHours = fmtN(eq.deprecYears) * 365 * 8;

        if (deprecHours > 0) {
            // Depreciação: recuperando o valor da máquina
            deprecPerHour = fmtN(eq.marketValue) / deprecHours;
            // Manutenção: estimativa de 15% do valor da máquina diluído nas horas
            maintenancePerHour = (fmtN(eq.marketValue) * 0.15) / deprecHours;
        }

        // Energia: (Watts / 1000) * Preço do kWh
        energyCostPerHour = (fmtN(eq.watts) / 1000) * fmtN(state.costs.energyCostPerKwh);

        // Custo total da hora-máquina
        equipCostPerHour = deprecPerHour + maintenancePerHour + energyCostPerHour;
    }

    const equipCost = equipCostPerHour * printHours;

    // ── 2. Custo de Material ──────────────────────────────────────
    let matCostPerG = 0;
    if (mat && fmtN(mat.totalQty) > 0) {
        matCostPerG = fmtN(mat.totalCost) / fmtN(mat.totalQty);
    }
    const pieceGrams = get('mat-piece');
    const supportGrams = get('mat-support');
    const materialCost = (pieceGrams + supportGrams) * matCostPerG;

    // ── 3. Custo de Mão de Obra (Horas Ativas) ────────────────────
    const rate = person ? fmtN(person.ratePerHour) : 0;

    // CORREÇÃO: O tempo de impressão foi removido da soma de mão de obra.
    // Consideramos apenas o tempo em que o operador está ativamente trabalhando.
    const activeLaborHours = get('time-research') + get('time-modeling') + get('time-wash');
    const labourCost = rate * activeLaborHours;

    // ── 4. Custo Fixo / Escritório ────────────────────────────────
    // O custo fixo também deve ser diluído apenas pelas horas ativas de trabalho,
    // e não pelo tempo em que a máquina opera de madrugada, por exemplo.
    const officeHourly = fmtN(state.costs.officeMonthly) / (30 * 8);
    const officeCost = officeHourly * activeLaborHours;

    // ── Totais e Fechamento ───────────────────────────────────────
    const unitSubtotal = equipCost + materialCost + labourCost + officeCost;
    const batchSubtotal = unitSubtotal * qty;

    const freight = get('freight');
    const outros = calcOutrosTotal();
    const marginPct = get('margin') / 100;
    const taxPct = get('taxes') / 100;

    const profit = batchSubtotal * marginPct;
    const base = batchSubtotal + profit + freight + outros;
    const taxes = base * taxPct;
    const finalPrice = base + taxes;

    // ── Update DOM ────────────────────────────────────────────────
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('res-equip', fmt(equipCost));
    set('res-material', fmt(materialCost));
    set('res-labour', fmt(labourCost));
    set('res-office', fmt(officeCost));
    set('res-unit', fmt(unitSubtotal));
    set('res-subtotal', fmt(batchSubtotal));
    set('res-freight', fmt(freight));
    set('res-profit', fmt(profit));
    set('res-taxes', fmt(taxes));
    set('res-final', fmt(finalPrice));
    set('res-outros', fmt(outros));

    // Update outros total display
    const otd = document.getElementById('outros-total-display');
    if (otd) otd.textContent = fmt(outros);
    document.getElementById('budget-form').dataset.calc = JSON.stringify({
        equipCost, materialCost, labourCost, officeCost,
        unitSubtotal, batchSubtotal, freight, outros, profit, taxes, finalPrice,
        qty, eqId, matId, persoId, rate, totalHours: activeLaborHours,
        pieceGrams, supportGrams, printHours,
        marginPct: get('margin'), taxPct: get('taxes'),
    });

    // Store in form data attribute for save
}

function saveBudget() {
    const getStr = id => document.getElementById(id)?.value?.trim() || '';
    const getNum = id => parseFloat(document.getElementById(id)?.value) || 0;

    const clientName = getStr('client-name');
    const clientContact = getStr('client-contact');
    const projectName = getStr('project-name');

    if (!clientName || !projectName) {
        toastMsg('Preencha ao menos o Nome do Cliente e o Projeto.', 'error');
        return;
    }

    const calcRaw = document.getElementById('budget-form').dataset.calc;
    let calc = {};
    try { calc = JSON.parse(calcRaw); } catch { }

    const eq = state.costs.equipment.find(e => e.id === calc.eqId) || {};
    const mat = state.costs.materials.find(m => m.id === calc.matId) || {};
    const person = state.costs.personnel.find(p => p.id === calc.persoId) || {};

    const isEditing = !!editingBudgetId;
    const existing = isEditing ? state.history.find(b => b.id === editingBudgetId) : null;

    const budget = {
        id: existing ? existing.id : uid(),
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: isEditing ? new Date().toISOString() : undefined,
        status: existing ? existing.status : 'pending',
        client: { name: clientName, contact: clientContact },
        project: projectName,
        production: {
            equipmentName: eq.name || '',
            materialName: mat.name || '',
            materialType: mat.type || '',
            pieceGrams: calc.pieceGrams || 0,
            supportGrams: calc.supportGrams || 0,
            printHours: calc.printHours || 0,
        },
        time: {
            research: getNum('time-research'),
            modeling: getNum('time-modeling'),
            print: getNum('time-print'),
            wash: getNum('time-wash'),
        },
        commercial: {
            qty: calc.qty || 1,
            freight: calc.freight || 0,
            marginPct: calc.marginPct || 0,
            taxPct: calc.taxPct || 0,
        },
        costs: {
            equipment: calc.equipCost || 0,
            material: calc.materialCost || 0,
            labour: calc.labourCost || 0,
            office: calc.officeCost || 0,
            unitSubtotal: calc.unitSubtotal || 0,
            batchSubtotal: calc.batchSubtotal || 0,
            freight: calc.freight || 0,
            outros: calc.outros || 0,
            profit: calc.profit || 0,
            taxes: calc.taxes || 0,
            finalPrice: calc.finalPrice || 0,
        },
        personnel: person.name || '',
        outros: JSON.parse(JSON.stringify(outrosItems)),
        notes: getStr('notes'),
    };

    if (isEditing) {
        const idx = state.history.findIndex(b => b.id === editingBudgetId);
        if (idx !== -1) state.history[idx] = budget;
        else state.history.unshift(budget);
        saveHistory();
        resetBudgetForm();
        toastMsg('Orçamento atualizado com sucesso!', 'success');
        // Switch to history tab so the user can see the result
        switchTab('history');
    } else {
        state.history.unshift(budget);
        saveHistory();
        resetBudgetForm();
        toastMsg('Orçamento salvo com sucesso!', 'success');
        showWhatsAppModal(budget);
    }
}

function resetBudgetForm() {
    editingBudgetId = null;
    outrosItems = [];
    document.getElementById('budget-form').reset();
    document.getElementById('budget-form').dataset.calc = '';
    document.getElementById('budget-form').removeAttribute('data-editing');
    // Restore save button label and hide cancel-edit button
    const saveBtn = document.getElementById('btn-save-budget');
    saveBtn.textContent = '💾 Salvar Orçamento e Gerar Proposta';
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
    const editBanner = document.getElementById('edit-mode-banner');
    if (editBanner) editBanner.style.display = 'none';
    renderOutrosItems();
    calcBudget();
}

// ─── Switch tab programmatically ─────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
    const panel = document.getElementById('tab-' + tabName);
    if (panel) panel.classList.add('active');
    if (tabName === 'budget') populateBudgetDropdowns();
    if (tabName === 'history') renderHistory();
}

// ─── Load budget into form for editing ───────────────────────
function loadBudgetForEdit(id) {
    const b = state.history.find(x => x.id === id);
    if (!b) return;

    editingBudgetId = id;

    // Switch to budget tab first (this also populates dropdowns)
    switchTab('budget');

    // Populate text / number fields
    const setVal = (elId, val) => {
        const el = document.getElementById(elId);
        if (el) el.value = val ?? '';
    };

    setVal('client-name', b.client.name);
    setVal('client-contact', b.client.contact);
    setVal('project-name', b.project);
    setVal('mat-piece', b.production.pieceGrams);
    setVal('mat-support', b.production.supportGrams);
    setVal('time-research', b.time.research);
    setVal('time-modeling', b.time.modeling);
    setVal('time-print', b.time.print);
    setVal('time-wash', b.time.wash);
    setVal('qty-pieces', b.commercial.qty);
    setVal('freight', b.commercial.freight);
    setVal('margin', b.commercial.marginPct);
    setVal('taxes', b.commercial.taxPct);
    setVal('notes', b.notes || '');

    // Restore outros items
    outrosItems = Array.isArray(b.outros) ? JSON.parse(JSON.stringify(b.outros)) : [];
    renderOutrosItems();

    // Set dropdowns by matching names (IDs may have regenerated)
    const selEq = document.getElementById('sel-equipment');
    const selMat = document.getElementById('sel-material');
    const selPer = document.getElementById('sel-person');

    // Try matching by id stored in history, fallback to name
    const eqMatch = state.costs.equipment.find(e =>
        e.name === b.production.equipmentName);
    if (eqMatch && selEq) selEq.value = eqMatch.id;

    const matMatch = state.costs.materials.find(m =>
        m.name === b.production.materialName && m.type === b.production.materialType);
    if (matMatch && selMat) selMat.value = matMatch.id;

    const perMatch = state.costs.personnel.find(p =>
        p.name === b.personnel);
    if (perMatch && selPer) selPer.value = perMatch.id;

    // Update save button label
    const saveBtn = document.getElementById('btn-save-budget');
    saveBtn.textContent = '✏️ Atualizar Orçamento';

    // Show cancel button
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';

    // Show edit mode banner
    const editBanner = document.getElementById('edit-mode-banner');
    if (editBanner) {
        editBanner.style.display = 'flex';
        editBanner.querySelector('.edit-banner-project').textContent =
            `Editando: ${b.project} (${b.client.name})`;
    }

    // Recalculate with loaded values
    calcBudget();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildWhatsAppText(b) {
    const totalHours = (b.time.research || 0) + (b.time.modeling || 0) + (b.time.print || 0) + (b.time.wash || 0);
    const matLine = b.production.materialType === 'Resina'
        ? `Resina ${b.production.materialName || ''}`
        : `Filamento ${b.production.materialName || ''}`;
    const freightLine = b.costs.freight > 0 ? `\n• Frete: ${fmt(b.costs.freight)}` : '';
    const notesLine = b.notes ? `\n\n� *Observações:*\n${b.notes}` : '';

    return `Olá, *${b.client.name}*! 👋

Segue o orçamento para o seu projeto:

🖨️ *${b.project}*
━━━━━━━━━━━━━━━━━━━━━━
📦 *Material:* ${matLine}
🔢 *Quantidade:* ${b.commercial.qty} peça(s)
⏱️ *Prazo estimado:* ${totalHours}h de trabalho${freightLine}${notesLine}

━━━━━━━━━━━━━━━━━━━━━━
💰 *VALOR TOTAL: ${fmt(b.costs.finalPrice)}*
━━━━━━━━━━━━━━━━━━━━━━

Este orçamento é válido por 7 dias. Para confirmar o pedido, é necessário 50% de entrada.

Qualquer dúvida, estou à disposição! 😊
_MuriloV3D — Impressão 3D Profissional_`;
}

function showWhatsAppModal(budget) {
    document.getElementById('wa-text').textContent = buildWhatsAppText(budget);
    document.getElementById('modal-whatsapp').classList.add('open');
}

// ═══════════════════════════════════════════════════════════════
// TAB 3 — HISTÓRICO
// ═══════════════════════════════════════════════════════════════
let historyFilter = '';
let historyStatusFilter = 'all';

function renderHistory() {
    const container = document.getElementById('history-list');
    const search = historyFilter.toLowerCase();

    let items = state.history.filter(b => {
        const matchSearch = !search ||
            b.client.name.toLowerCase().includes(search) ||
            b.project.toLowerCase().includes(search) ||
            (b.client.contact || '').toLowerCase().includes(search);
        const matchStatus = historyStatusFilter === 'all' || b.status === historyStatusFilter;
        return matchSearch && matchStatus;
    });

    if (items.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📂</div>
        <h3>Nenhum orçamento encontrado</h3>
        <p>Crie um novo orçamento na aba "Novo Orçamento"</p>
      </div>`;
        return;
    }

    container.innerHTML = `
    <div class="table-wrapper">
      <table id="history-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>Contato</th>
            <th>Projeto</th>
            <th>Valor Final</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="history-tbody"></tbody>
      </table>
    </div>`;

    const tbody = document.getElementById('history-tbody');
    items.forEach(b => {
        const d = new Date(b.createdAt);
        const dateStr = d.toLocaleDateString('pt-BR');
        const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td style="white-space:nowrap; color:var(--text-secondary); font-size:12px;">${dateStr}</td>
      <td style="font-weight:600;">${esc(b.client.name)}</td>
      <td style="color:var(--text-secondary); font-size:12px;">${esc(b.client.contact || '—')}</td>
      <td>${esc(b.project)}</td>
      <td style="font-weight:700; color:var(--accent); white-space:nowrap;">${fmt(b.costs.finalPrice)}</td>
      <td>
        <div class="status-dropdown-wrap" id="sdw-${b.id}">
          <span class="badge ${cfg.badge}" data-budget-id="${b.id}" onclick="toggleStatusMenu('${b.id}')">
            ${cfg.label} ▾
          </span>
          <div class="status-menu" id="sm-${b.id}">
            ${Object.entries(STATUS_CONFIG).map(([key, sc]) => `
              <div class="status-menu-item" data-budget-id="${b.id}" data-status="${key}" onclick="setStatus('${b.id}','${key}')">
                <span class="dot" style="background:${sc.dot}"></span>${sc.label}
              </div>`).join('')}
          </div>
        </div>
      </td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="showDetailsModal('${b.id}')" title="Ver Detalhes">🔍 Detalhes</button>
          <button class="btn btn-secondary btn-sm" onclick="loadBudgetForEdit('${b.id}')" title="Editar orçamento">✏️ Editar</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteBudget('${b.id}')" title="Excluir">🗑</button>
        </div>
      </td>`;
        tbody.appendChild(tr);
    });
}

function toggleStatusMenu(id) {
    const menu = document.getElementById('sm-' + id);
    const isOpen = menu.classList.contains('open');
    // Close all open menus
    document.querySelectorAll('.status-menu.open').forEach(m => m.classList.remove('open'));
    if (!isOpen) menu.classList.add('open');
}

function setStatus(budgetId, newStatus) {
    const b = state.history.find(x => x.id === budgetId);
    if (b) {
        b.status = newStatus;
        saveHistory();
    }
    document.querySelectorAll('.status-menu.open').forEach(m => m.classList.remove('open'));
    renderHistory();
}

function deleteBudget(id) {
    if (!confirm('Excluir este orçamento?')) return;
    state.history = state.history.filter(b => b.id !== id);
    saveHistory();
    renderHistory();
    toastMsg('Orçamento excluído.', 'info');
}

function showDetailsModal(id) {
    const b = state.history.find(x => x.id === id);
    if (!b) return;
    const d = new Date(b.createdAt);
    const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
    const modal = document.getElementById('modal-details');
    document.getElementById('modal-details-content').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:16px;">
      <div>
        <h3 style="font-size:16px;font-weight:700;">${esc(b.project)}</h3>
        <p style="color:var(--text-secondary);font-size:13px;">${esc(b.client.name)} · ${esc(b.client.contact || '')}</p>
        <p style="color:var(--text-muted);font-size:12px;">${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <span class="badge ${cfg.badge}">${cfg.label}</span>
    </div>
    <hr class="divider-line">
    <table class="detail-table">
      <tr><td>Equipamento</td><td>${esc(b.production.equipmentName || '—')}</td></tr>
      <tr><td>Material</td><td>${b.production.materialType ? `[${b.production.materialType}] ` : ''}${esc(b.production.materialName || '—')}</td></tr>
      <tr><td>Peça (g)</td><td>${b.production.pieceGrams}g</td></tr>
      <tr><td>Suportes (g)</td><td>${b.production.supportGrams}g</td></tr>
      <tr><td>Tempo Impressão</td><td>${b.production.printHours}h</td></tr>
      <tr><td>Responsável</td><td>${esc(b.personnel || '—')}</td></tr>
      <tr><td>Quantidade</td><td>${b.commercial.qty} peça(s)</td></tr>
    </table>
    <hr class="divider-line">
    <table class="detail-table">
      <tr><th style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;" colspan="2">Quebra de Custos</th></tr>
      <tr><td>Custo de Equipamento</td><td>${fmt(b.costs.equipment)}</td></tr>
      <tr><td>Custo de Material</td><td>${fmt(b.costs.material)}</td></tr>
      <tr><td>Mão de Obra</td><td>${fmt(b.costs.labour)}</td></tr>
      <tr><td>Escritório</td><td>${fmt(b.costs.office)}</td></tr>
      <tr><td>Subtotal por peça</td><td>${fmt(b.costs.unitSubtotal)}</td></tr>
      <tr><td>Subtotal (lote ${b.commercial.qty}x)</td><td>${fmt(b.costs.batchSubtotal)}</td></tr>
      <tr><td>Frete</td><td>${fmt(b.costs.freight)}</td></tr>
      <tr><td>Outros Custos</td><td>${fmt(b.costs.outros || 0)}</td></tr>
      <tr><td>Lucro (${b.commercial.marginPct}%)</td><td>${fmt(b.costs.profit)}</td></tr>
      <tr><td>Impostos (${b.commercial.taxPct}%)</td><td>${fmt(b.costs.taxes)}</td></tr>
      <tr class="highlight"><td><strong>VALOR FINAL</strong></td><td>${fmt(b.costs.finalPrice)}</td></tr>
    </table>
    ${b.notes ? `<hr class="divider-line"><p style="font-size:13px;color:var(--text-secondary)"><strong>Observações:</strong> ${esc(b.notes)}</p>` : ''}
  `;
    modal.classList.add('open');
}

function initHistoryTab() {
    document.getElementById('history-search').addEventListener('input', e => {
        historyFilter = e.target.value;
        renderHistory();
    });

    document.getElementById('history-status-filter').addEventListener('change', e => {
        historyStatusFilter = e.target.value;
        renderHistory();
    });

    // Close menus on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('.status-dropdown-wrap')) {
            document.querySelectorAll('.status-menu.open').forEach(m => m.classList.remove('open'));
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════
function initModals() {
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.remove('open');
        });
    });

    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('open');
        });
    });

    // WhatsApp copy button
    document.getElementById('btn-copy-wa').addEventListener('click', () => {
        const text = document.getElementById('wa-text').textContent;
        navigator.clipboard.writeText(text).then(() => toastMsg('Texto copiado!', 'success'));
    });

    // WhatsApp open button
    document.getElementById('btn-open-wa').addEventListener('click', () => {
        const b = state.history[0];
        if (!b) return;
        const contact = b.client.contact.replace(/\D/g, '');
        const text = encodeURIComponent(document.getElementById('wa-text').textContent);
        const url = contact ? `https://wa.me/55${contact}?text=${text}` : `https://wa.me/?text=${text}`;
        window.open(url, '_blank');
    });
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
// ─── Sheets Config UI ─────────────────────────────────────────
function initSheetsConfig() {
    const btn = document.getElementById('btn-sheets-config');
    const modal = document.getElementById('modal-sheets');
    const inputUrl = document.getElementById('sheets-url-input');
    const btnSave = document.getElementById('btn-sheets-save');
    const btnTest = document.getElementById('btn-sheets-test');
    const btnSync = document.getElementById('btn-sheets-sync');

    if (!btn) return;

    // Load saved URL
    inputUrl.value = getSheetsUrl();

    btn.addEventListener('click', () => modal.classList.add('open'));

    document.querySelectorAll('#modal-sheets .modal-close').forEach(b => {
        b.addEventListener('click', () => modal.classList.remove('open'));
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

    btnSave.addEventListener('click', () => {
        setSheetsUrl(inputUrl.value);
        toastMsg('URL salva!', 'success');
        setSyncStatus(getSheetsUrl() ? 'none' : 'none');
        modal.classList.remove('open');
    });

    btnTest.addEventListener('click', async () => {
        setSheetsUrl(inputUrl.value);
        btnTest.textContent = '⏳ Testando…';
        btnTest.disabled = true;
        const data = await sheetsGet('ping');
        btnTest.textContent = '🔍 Testar Conexão';
        btnTest.disabled = false;
        if (data && data.ok) {
            toastMsg('Conexão OK! ' + data.message, 'success');
        } else {
            toastMsg('Falha na conexão. Verifique a URL.', 'error');
        }
    });

    btnSync.addEventListener('click', async () => {
        btnSync.textContent = '⏳ Sincronizando…';
        btnSync.disabled = true;
        const ok = await syncFromSheets();
        btnSync.textContent = '🔄 Sincronizar Agora';
        btnSync.disabled = false;
        if (ok) {
            renderHistory();
            renderPersonnelTable();
            renderEquipmentTable();
            renderMaterialsTable();
            renderFixedCosts();
            populateBudgetDropdowns();
            toastMsg('Dados carregados do Sheets!', 'success');
        } else {
            toastMsg('Erro ao sincronizar. Verifique a URL.', 'error');
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    loadState();
    initTabs();
    initCostsTab();
    initBudgetTab();
    initHistoryTab();
    initModals();
    initSheetsConfig();
    renderOutrosItems();
    calcBudget();

    // Try to sync from Sheets on load
    if (getSheetsUrl()) {
        setSyncStatus('syncing');
        const ok = await syncFromSheets();
        if (ok) {
            renderHistory();
            renderPersonnelTable();
            renderEquipmentTable();
            renderMaterialsTable();
            renderFixedCosts();
            populateBudgetDropdowns();
        }
    } else {
        setSyncStatus('none');
    }
});
