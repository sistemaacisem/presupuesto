/**
 * History Module — Cargar Historial de Presupuestos + Mapeador
 */
import { api, formatARS, formatDate, statusLabel } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirmModal, openModal, closeModal } from '../components/modal.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Cargar presupuesto</h1>
        <p>Subí presupuestos históricos para construir la base de inteligencia de precios</p>
      </div>
    </div>

    <!-- Upload Zone -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div>
          <div class="card-title">Subir Archivo</div>
          <div class="card-subtitle">El sistema extrae automáticamente proveedor, artículos y precios</div>
        </div>
      </div>

      <div class="upload-zone" id="upload-zone-history">
        <input type="file" id="file-input-history" accept=".pdf,.xlsx,.xls,.csv" multiple>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        <h4>Arrastrar archivos aquí o hacer click para seleccionar</h4>
        <p>PDF (con texto seleccionable), Excel (.xlsx, .xls) o CSV</p>
        <div class="upload-types">
          <span class="badge badge-default">PDF</span>
          <span class="badge badge-default">XLSX</span>
          <span class="badge badge-default">XLS</span>
          <span class="badge badge-default">CSV</span>
        </div>
      </div>

      <!-- Enlaces para probar el sistema con planillas mock -->
      <div style="margin-top:12px;font-size:12px;text-align:center;padding:8px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px dashed var(--border)">
        <span style="font-weight:600;display:block;margin-bottom:4px">🧪 ¿Querés probar la carga rápido? Descargá un archivo de prueba:</span>
        <a href="/ejemplo_utiles.xlsx" download class="text-primary" style="text-decoration:underline;margin-right:12px">📊 Excel Útiles</a>
        <a href="/ejemplo_pintura.xlsx" download class="text-primary" style="text-decoration:underline;margin-right:12px">📊 Excel Pintura</a>
        <a href="/ejemplo_utiles.pdf" download class="text-primary" style="text-decoration:underline">📄 PDF Útiles</a>
      </div>

      <!-- Upload progress -->
      <div id="upload-progress" style="display:none;margin-top:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div class="spinner spinner-sm"></div>
          <span style="font-size:13px;color:var(--text-secondary)" id="upload-status">Procesando archivo...</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
      </div>

      <!-- Manual fields (optional) -->
      <details style="margin-top:20px">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text-secondary);user-select:none;padding:4px 0">
          ⚙ Campos adicionales (opcional)
        </summary>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px">
          <div class="form-group">
            <label for="hist-provider">Proveedor</label>
            <select class="select" id="hist-provider">
              <option value="">Detectar automáticamente</option>
            </select>
          </div>
          <div class="form-group">
            <label for="hist-date">Fecha del presupuesto</label>
            <input class="input" type="date" id="hist-date">
          </div>
          <div class="form-group">
            <label for="hist-number">N° de presupuesto</label>
            <input class="input" type="text" id="hist-number" placeholder="Ej: PRES-2024-001">
          </div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label for="hist-notes">Observaciones</label>
          <textarea class="textarea" id="hist-notes" placeholder="Observaciones opcionales..." rows="2"></textarea>
        </div>
      </details>
    </div>

    <!-- Lista de presupuestos históricos -->
    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <div class="search-box" style="width:260px">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="input" type="search" id="hist-search" placeholder="Buscar por proveedor o número...">
          </div>
          <select class="select" id="hist-status-filter" style="width:160px">
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="reviewed">Revisado</option>
            <option value="approved">Aprobado</option>
          </select>
          <input class="input" type="date" id="hist-date-from" style="width:155px" title="Fecha desde">
          <input class="input" type="date" id="hist-date-to" style="width:155px" title="Fecha hasta">
        </div>
        <div class="table-toolbar-right">
          <div id="hist-bulk-actions" style="display:none;align-items:center;gap:8px">
            <span id="hist-selected-count" class="text-secondary text-sm">0 seleccionados</span>
            <button class="btn btn-danger btn-sm" id="hist-bulk-delete">Eliminar seleccionados</button>
          </div>
          <span id="hist-count" class="text-secondary text-sm"></span>
        </div>
      </div>

      <div class="table-scroll-hint" style="overflow-x:auto">
        <table class="data-table" id="hist-table">
          <thead>
            <tr>
              <th style="width:40px"><input type="checkbox" id="hist-select-all" style="accent-color:var(--accent)"></th>
              <th>N° Presupuesto</th>
              <th>Proveedor</th>
              <th>Fecha</th>
              <th>Artículos</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="hist-tbody">
            <tr><td colspan="7" class="table-empty">
              <div class="spinner"></div>
            </td></tr>
          </tbody>
        </table>
      </div>

      <div class="table-footer">
        <span id="hist-footer-info" class="text-secondary text-sm"></span>
        <div class="pagination" id="hist-pagination"></div>
      </div>
    </div>`;

  // Cargar proveedores para el select
  loadProviderSelect();

  // Cargar tabla
  await loadHistoryTable();

  // Setup upload
  setupUpload();

  // Filtros
  let filterTimeout;
  document.getElementById('hist-search').addEventListener('input', () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(loadHistoryTable, 400);
  });
  document.getElementById('hist-status-filter').addEventListener('change', () => { currentPage = 1; loadHistoryTable(); });
  document.getElementById('hist-date-from').addEventListener('change', () => { currentPage = 1; loadHistoryTable(); });
  document.getElementById('hist-date-to').addEventListener('change', () => { currentPage = 1; loadHistoryTable(); });

  // Bulk selection
  document.getElementById('hist-select-all').addEventListener('change', function () {
    const checked = this.checked;
    document.querySelectorAll('.hist-checkbox').forEach(cb => cb.checked = checked);
    updateSelectionUI();
  });

  document.getElementById('hist-tbody').addEventListener('change', (e) => {
    if (e.target.classList.contains('hist-checkbox')) {
      updateSelectionUI();
    }
  });

  document.getElementById('hist-bulk-delete').addEventListener('click', bulkDeleteBudgets);
}

async function loadProviderSelect() {
  try {
    const { providers } = await api.getProviders({ limit: 200 });
    const sel = document.getElementById('hist-provider');
    providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
  } catch {}
}

let currentPage = 1;

export function cleanup() {
  currentPage = 1;
}

async function loadHistoryTable() {
  const selectAll = document.getElementById('hist-select-all');
  if (selectAll) selectAll.checked = false;
  document.getElementById('hist-bulk-actions').style.display = 'none';
  const search = document.getElementById('hist-search')?.value || '';
  const status = document.getElementById('hist-status-filter')?.value || '';
  const tbody = document.getElementById('hist-tbody');

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px"><div class="spinner"></div></td></tr>`;

  try {
    const dateFrom = document.getElementById('hist-date-from')?.value || '';
    const dateTo   = document.getElementById('hist-date-to')?.value || '';
    const params = { type: 'history', page: currentPage, limit: 15, status };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    const { budgets, total } = await api.getBudgets(params);

    document.getElementById('hist-count').textContent = `${total} presupuestos`;
    document.getElementById('hist-footer-info').textContent = `Mostrando ${budgets.length} de ${total}`;

    if (!budgets.length) {
      const hasFilters = search || status || document.getElementById('hist-date-from')?.value || document.getElementById('hist-date-to')?.value;
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="table-empty">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            ${hasFilters ? `
              <h3>Sin resultados</h3>
              <p>No se encontraron presupuestos con los filtros aplicados. Intentá con otros criterios.</p>
              <button class="btn btn-secondary" onclick="document.getElementById('hist-search').value='';document.getElementById('hist-status-filter').value='';document.getElementById('hist-date-from').value='';document.getElementById('hist-date-to').value='';loadHistoryTable()">
                Limpiar filtros
              </button>
            ` : `
              <h3>Todavía no hay presupuestos históricos</h3>
              <p>Cargá tu primer presupuesto para empezar a construir la base de inteligencia de precios.</p>
              <button class="btn btn-primary" onclick="document.getElementById('file-input-history').click()">
                Subir primer archivo
              </button>
            `}
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = budgets.map(b => `
      <tr>
        <td><input type="checkbox" class="hist-checkbox" value="${b.id}" style="accent-color:var(--accent)"></td>
        <td><code style="font-size:12px">${b.number || '—'}</code></td>
        <td>
          <div style="font-weight:500;font-size:13px">${b.provider_name || 'Sin proveedor'}</div>
          <div style="font-size:11px;color:var(--text-tertiary)">${b.file_name || ''}</div>
        </td>
        <td style="white-space:nowrap;font-size:13px">${formatDate(b.date)}</td>
        <td style="text-align:center;font-size:13px">${b.item_count || 0}</td>
        <td style="font-weight:600;font-size:13px">${formatARS(b.total_amount)}</td>
        <td><span class="status-dot ${b.status}">${statusLabel(b.status)}</span></td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm" onclick="viewBudget('${b.id}')" title="Ver detalle">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="deleteBudget('${b.id}')" style="color:var(--error-text)" title="Eliminar">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><p style="color:var(--error-text)">${err.message}</p></td></tr>`;
  }
}

function setupUpload() {
  const zone     = document.getElementById('upload-zone-history');
  const input    = document.getElementById('file-input-history');
  const progress = document.getElementById('upload-progress');
  const fill     = document.getElementById('progress-fill');
  const status   = document.getElementById('upload-status');

  const handleFiles = async (files) => {
    if (!files.length) return;

    // Si sube un único archivo y es planilla, usar el Mapeador
    if (files.length === 1) {
      const file = files[0];
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        openExcelMapperModal(file);
        return;
      }
    }

    progress.style.display = 'block';
    let done = 0;

    for (const file of files) {
      status.textContent = `Procesando: ${file.name}...`;
      const pct = Math.round((done / files.length) * 100);
      fill.style.width = `${pct}%`;
      fill.closest('.progress-bar')?.setAttribute('aria-valuenow', pct);

      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('type', 'history');

        const providerId = document.getElementById('hist-provider')?.value;
        const date       = document.getElementById('hist-date')?.value;
        const number     = document.getElementById('hist-number')?.value;
        const notes      = document.getElementById('hist-notes')?.value;

        if (providerId) fd.append('provider_id', providerId);
        if (date)       fd.append('date', date);
        if (number)     fd.append('number', number);
        if (notes)      fd.append('notes', notes);

        const result = await api.uploadBudget(fd);
        showToast('Archivo cargado', `${result.parsed.rowsFound} artículos detectados en ${file.name}`, 'success');
        done++;
      } catch (err) {
        showToast('Error al procesar', `${file.name}: ${err.message}`, 'error');
      }
    }

    fill.style.width = '100%';
    status.textContent = `✓ ${done} de ${files.length} archivos procesados`;
    setTimeout(() => { progress.style.display = 'none'; fill.style.width = '0%'; }, 2500);

    await loadHistoryTable();
  };

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });
}

// ─── MAPEADOR INTERACTIVO DE COLUMNAS (HISTORIAL) ──────────────────────────────────
function openExcelMapperModal(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = e.target.result;
    const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
    
    let activeSheet = workbook.SheetNames[0];
    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[activeSheet], { header: 1, defval: '' });
    
    const renderMapperBody = () => {
      const headers = sheetData[0] || [];
      const previewRows = sheetData.slice(1, 6);

      const patterns = {
        description: /descrip|detalle|concepto|art[ií]culo|producto|ítem|item|nombre/i,
        quantity:    /cant(idad)?|qty|cantidad/i,
        unit:        /unidad|um|ud|uni/i,
        unitPrice:   /precio\s*unit|p\.?\s*unit|valor\s*unit|costo\s*unit|unitario/i,
        notes:       /obs|nota|coment/i
      };

      const autoMatches = {};
      Object.keys(patterns).forEach(key => {
        const foundIdx = headers.findIndex(h => patterns[key].test(String(h)));
        autoMatches[key] = foundIdx !== -1 ? foundIdx : '';
      });

      if (autoMatches.description === '' && headers.length > 0) autoMatches.description = 0;
      if (autoMatches.quantity === '' && headers.length > 1) autoMatches.quantity = 1;
      if (autoMatches.unit === '' && headers.length > 2) autoMatches.unit = 2;
      if (autoMatches.unitPrice === '' && headers.length > 3) autoMatches.unitPrice = 3;

      const selectors = [
        { key: 'description', label: 'Artículo / Descripción *' },
        { key: 'quantity', label: 'Cantidad' },
        { key: 'unit', label: 'Unidad de medida' },
        { key: 'unitPrice', label: 'Precio Unitario *' },
        { key: 'notes', label: 'Observaciones' }
      ];

      return `
        <div style="display:flex;flex-direction:column;gap:16px">
          <p style="font-size:13px;color:var(--text-secondary)">Alineá las columnas de tu Excel para cargar el historial de forma precisa:</p>
          
          <div class="form-group">
            <label>Seleccionar Hoja del Excel</label>
            <select class="select" id="map-sheet-select">
              ${workbook.SheetNames.map(s => `<option ${s === activeSheet ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>

          <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:12px">
            ${selectors.map(sel => `
              <div class="form-group">
                <label>${sel.label}</label>
                <select class="select map-col-selector" data-field="${sel.key}">
                  <option value="">-- No incluir --</option>
                  ${headers.map((h, idx) => `<option value="${idx}" ${autoMatches[sel.key] === idx ? 'selected' : ''}>${h || `Columna ${idx+1}`}</option>`).join('')}
                </select>
              </div>
            `).join('')}
          </div>

          <!-- Vista previa -->
          <div>
            <label>Previsualización (Primeras filas)</label>
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-md);margin-top:6px;max-height:160px">
              <table class="data-table" style="font-size:11.5px">
                <thead>
                  <tr>
                    ${headers.map(h => `<th>${h || '—'}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${previewRows.map(row => `
                    <tr>
                      ${headers.map((_, idx) => `<td>${row[idx] != null ? row[idx] : ''}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>`;
    };

    const modalOverlay = openModal({
      title: `⚙️ Mapeador de Historial — ${file.name}`,
      size: 'lg',
      body: renderMapperBody(),
      footer: `
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="btn-process-mapped">Importar al Historial</button>`
    });

    modalOverlay.querySelector('#map-sheet-select').addEventListener('change', function() {
      activeSheet = this.value;
      sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[activeSheet], { header: 1, defval: '' });
      modalOverlay.querySelector('.modal-body').innerHTML = renderMapperBody();
    });

    modalOverlay.querySelector('#btn-process-mapped').addEventListener('click', async () => {
      const selectors = modalOverlay.querySelectorAll('.map-col-selector');
      const mappings = {};
      selectors.forEach(sel => {
        mappings[sel.dataset.field] = sel.value !== '' ? parseInt(sel.value) : null;
      });

      if (mappings.description === null || mappings.unitPrice === null) {
        showToast('Error', 'Los campos de Descripción y Precio Unitario son obligatorios', 'error');
        return;
      }

      const rowsToSave = [];
      const dataRows = sheetData.slice(1);

      for (const row of dataRows) {
        const descVal = mappings.description !== null ? String(row[mappings.description] || '').trim() : '';
        const rawPrice = mappings.unitPrice !== null ? String(row[mappings.unitPrice] || '') : '0';
        const price = parseFloat(rawPrice.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        
        if (!descVal && price === 0) continue;

        const qtyVal = mappings.quantity !== null ? String(row[mappings.quantity] || '') : '1';
        const qty = parseFloat(qtyVal.replace(/[^\d.,]/g, '').replace(',', '.')) || 1;

        rowsToSave.push({
          description: descVal,
          quantity: qty,
          unit: mappings.unit !== null ? String(row[mappings.unit] || 'unidad').trim() : 'unidad',
          unit_price: price,
          total_price: qty * price,
          notes: mappings.notes !== null ? String(row[mappings.notes] || '').trim() : ''
        });
      }

      if (!rowsToSave.length) {
        showToast('Error', 'No se encontraron filas válidas para importar', 'error');
        return;
      }

      closeModal();
      const pBar = document.getElementById('upload-progress');
      const pFill = document.getElementById('progress-fill');
      const pStatus = document.getElementById('upload-status');
      
      pBar.style.display = 'block';
      pFill.style.width = '50%';
      pStatus.textContent = 'Enviando historial al sistema...';

      try {
        const providerId = document.getElementById('hist-provider')?.value;
        const date       = document.getElementById('hist-date')?.value;
        const number     = document.getElementById('hist-number')?.value;
        const notes      = document.getElementById('hist-notes')?.value;

        const payload = {
          provider_id: providerId || null,
          number: number || `PRES-${Date.now()}`,
          date: date || new Date().toISOString().split('T')[0],
          type: 'history',
          file_name: file.name,
          notes: notes || '',
          details: rowsToSave
        };

        await api.createBudget(payload);
        pFill.style.width = '100%';
        pStatus.textContent = '✓ Historial cargado';

        showToast('Historial cargado', `${rowsToSave.length} artículos agregados exitosamente.`, 'success');
        setTimeout(() => { pBar.style.display = 'none'; pFill.style.width = '0%'; }, 2000);

        await loadHistoryTable();

      } catch (err) {
        pBar.style.display = 'none';
        showToast('Error al importar', err.message, 'error');
      }
    });

  };
  reader.readAsBinaryString(file);
}

function updateSelectionUI() {
  const checked = document.querySelectorAll('.hist-checkbox:checked');
  const total = document.querySelectorAll('.hist-checkbox').length;
  const count = checked.length;
  const bulkActions = document.getElementById('hist-bulk-actions');
  const selectedCount = document.getElementById('hist-selected-count');
  if (count > 0) {
    bulkActions.style.display = 'flex';
    selectedCount.textContent = `${count} de ${total} seleccionados`;
  } else {
    bulkActions.style.display = 'none';
  }
}

async function bulkDeleteBudgets() {
  const checked = document.querySelectorAll('.hist-checkbox:checked');
  if (!checked.length) return;
  if (!(await confirmModal(`Se eliminarán ${checked.length} presupuestos y todos sus datos asociados.`, '¿Eliminar seleccionados?'))) return;
  const ids = Array.from(checked).map(cb => cb.value);
  try {
    await api.bulkDeleteBudgets(ids);
    showToast('Eliminados', `${ids.length} presupuestos eliminados correctamente`, 'success');
    const totalLeft = parseInt(document.getElementById('hist-count').textContent) - ids.length;
    if (totalLeft <= 0) currentPage = 1;
    await loadHistoryTable();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

// Funciones globales
window.viewBudget = (id) => navigateTo(`budget/${id}`);

window.deleteBudget = async (id) => {
  if (!(await confirmModal('Se eliminará el presupuesto y todos sus datos asociados.', '¿Eliminar presupuesto?'))) return;
  try {
    await api.deleteBudget(id);
    showToast('Eliminado', 'Presupuesto eliminado correctamente', 'success');
    loadHistoryTable();
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
};
