// ============================================================
// MuriloV3D — Google Apps Script API
// ============================================================
// INSTRUÇÕES DE CONFIGURAÇÃO:
// 1. Abra sua planilha no Google Sheets
// 2. Menu: Extensões > Apps Script
// 3. Cole todo este código substituindo o conteúdo existente
// 4. Clique em "Salvar" (Ctrl+S)
// 5. Clique em "Implantar" > "Nova implantação"
// 6. Tipo: "App da Web"
//    - Executar como: "Eu" (sua conta Google)
//    - Quem tem acesso: "Qualquer pessoa" (necessário para o app funcionar)
// 7. Clique "Implantar" e copie a URL gerada
// 8. Cole a URL no campo de configuração do app MuriloV3D
// ============================================================

const SHEET_HISTORY = 'Histórico';
const SHEET_COSTS   = 'BaseCustos';

// ─── Inicializa as abas se não existirem ─────────────────────
function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Aba Histórico
  let sh = ss.getSheetByName(SHEET_HISTORY);
  if (!sh) {
    sh = ss.insertSheet(SHEET_HISTORY);
    sh.appendRow([
      'ID', 'Data', 'Atualizado em', 'Status',
      'Cliente', 'Contato', 'Projeto',
      'Equipamento', 'Material', 'Tipo Material',
      'Peça (g)', 'Suporte (g)', 'Horas Impressão',
      'H. Pesquisa', 'H. Modelagem', 'H. Lavagem',
      'Responsável', 'Qtd. Peças', 'Frete (R$)',
      'Margem (%)', 'Impostos (%)',
      'Custo Equipamento', 'Custo Material', 'Mão de Obra', 'Escritório',
      'Subtotal Peça', 'Subtotal Lote', 'Outros (R$)', 'Lucro (R$)',
      'Impostos (R$)', 'Valor Final',
      'Outros Items (JSON)',
      'Observações'
    ]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  }

  // Aba Base de Custos (armazena como JSON em uma única célula por tipo)
  let sc = ss.getSheetByName(SHEET_COSTS);
  if (!sc) {
    sc = ss.insertSheet(SHEET_COSTS);
    sc.appendRow(['Chave', 'Valor JSON', 'Atualizado em']);
    sc.setFrozenRows(1);
    sc.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
  }

  return { ss, sh, sc };
}

// ─── GET — lê dados ──────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || 'ping';
    const { sh, sc } = ensureSheets();

    if (action === 'ping') {
      return jsonResponse({ ok: true, message: 'MuriloV3D API online' });
    }

    if (action === 'getHistory') {
      const data = sh.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse({ ok: true, history: [] });
      const headers = data[0];
      const rows = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return rowToHistory(obj);
      });
      return jsonResponse({ ok: true, history: rows.filter(r => r.id) });
    }

    if (action === 'getCosts') {
      const data = sc.getDataRange().getValues();
      if (data.length <= 1) return jsonResponse({ ok: true, costs: null });
      const rows = data.slice(1);
      const costsRow = rows.find(r => r[0] === 'costs');
      if (!costsRow) return jsonResponse({ ok: true, costs: null });
      return jsonResponse({ ok: true, costs: JSON.parse(costsRow[1]) });
    }

    return jsonResponse({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ─── POST — salva dados ──────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const { sh, sc } = ensureSheets();

    // ── Salvar / atualizar orçamento ──────────────────────────
    if (action === 'saveHistory') {
      const history = payload.history; // array completo
      // Limpa dados existentes (exceto header) e reescreve tudo
      const lastRow = sh.getLastRow();
      if (lastRow > 1) sh.deleteRows(2, lastRow - 1);

      if (history.length > 0) {
        const rows = history.map(b => historyToRow(b));
        sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        // Formatação zebra leve
        for (let i = 0; i < rows.length; i++) {
          const bg = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
          sh.getRange(i + 2, 1, 1, rows[0].length).setBackground(bg);
        }
      }
      return jsonResponse({ ok: true, saved: history.length });
    }

    // ── Salvar base de custos ────────────────────────────────
    if (action === 'saveCosts') {
      const costs = payload.costs;
      const data = sc.getDataRange().getValues();
      const rows = data.slice(1);
      const existingIdx = rows.findIndex(r => r[0] === 'costs');
      const now = new Date().toLocaleString('pt-BR');
      if (existingIdx === -1) {
        sc.appendRow(['costs', JSON.stringify(costs), now]);
      } else {
        sc.getRange(existingIdx + 2, 2, 1, 2).setValues([[JSON.stringify(costs), now]]);
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Ação desconhecida: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ─── Helpers de conversão ────────────────────────────────────
function historyToRow(b) {
  return [
    b.id || '',
    b.createdAt ? new Date(b.createdAt).toLocaleString('pt-BR') : '',
    b.updatedAt ? new Date(b.updatedAt).toLocaleString('pt-BR') : '',
    b.status || 'pending',
    (b.client || {}).name || '',
    (b.client || {}).contact || '',
    b.project || '',
    (b.production || {}).equipmentName || '',
    (b.production || {}).materialName || '',
    (b.production || {}).materialType || '',
    (b.production || {}).pieceGrams || 0,
    (b.production || {}).supportGrams || 0,
    (b.production || {}).printHours || 0,
    (b.time || {}).research || 0,
    (b.time || {}).modeling || 0,
    (b.time || {}).wash || 0,
    b.personnel || '',
    (b.commercial || {}).qty || 1,
    (b.commercial || {}).freight || 0,
    (b.commercial || {}).marginPct || 0,
    (b.commercial || {}).taxPct || 0,
    (b.costs || {}).equipment || 0,
    (b.costs || {}).material || 0,
    (b.costs || {}).labour || 0,
    (b.costs || {}).office || 0,
    (b.costs || {}).unitSubtotal || 0,
    (b.costs || {}).batchSubtotal || 0,
    (b.costs || {}).outros || 0,
    (b.costs || {}).profit || 0,
    (b.costs || {}).taxes || 0,
    (b.costs || {}).finalPrice || 0,
    JSON.stringify(b.outros || []),
    b.notes || ''
  ];
}

function rowToHistory(obj) {
  let outrosItems = [];
  try { outrosItems = JSON.parse(obj['Outros Items (JSON)'] || '[]'); } catch {}
  return {
    id: obj['ID'],
    createdAt: isoFromBR(obj['Data']),
    updatedAt: isoFromBR(obj['Atualizado em']) || undefined,
    status: obj['Status'] || 'pending',
    client: { name: obj['Cliente'], contact: obj['Contato'] },
    project: obj['Projeto'],
    production: {
      equipmentName: obj['Equipamento'],
      materialName: obj['Material'],
      materialType: obj['Tipo Material'],
      pieceGrams: +obj['Peça (g)'] || 0,
      supportGrams: +obj['Suporte (g)'] || 0,
      printHours: +obj['Horas Impressão'] || 0,
    },
    time: {
      research: +obj['H. Pesquisa'] || 0,
      modeling: +obj['H. Modelagem'] || 0,
      print: +obj['Horas Impressão'] || 0,
      wash: +obj['H. Lavagem'] || 0,
    },
    commercial: {
      qty: +obj['Qtd. Peças'] || 1,
      freight: +obj['Frete (R$)'] || 0,
      marginPct: +obj['Margem (%)'] || 0,
      taxPct: +obj['Impostos (%)'] || 0,
    },
    costs: {
      equipment: +obj['Custo Equipamento'] || 0,
      material: +obj['Custo Material'] || 0,
      labour: +obj['Mão de Obra'] || 0,
      office: +obj['Escritório'] || 0,
      unitSubtotal: +obj['Subtotal Peça'] || 0,
      batchSubtotal: +obj['Subtotal Lote'] || 0,
      outros: +obj['Outros (R$)'] || 0,
      profit: +obj['Lucro (R$)'] || 0,
      taxes: +obj['Impostos (R$)'] || 0,
      finalPrice: +obj['Valor Final'] || 0,
    },
    personnel: obj['Responsável'],
    outros: outrosItems,
    notes: obj['Observações'],
  };
}

function isoFromBR(str) {
  if (!str) return '';
  // "dd/mm/yyyy, hh:mm:ss" or "dd/mm/yyyy hh:mm:ss"
  const m = String(str).match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
  if (!m) return str;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`).toISOString();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
