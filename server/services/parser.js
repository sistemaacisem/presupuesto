'use strict';

const xlsx = require('xlsx');
const path = require('path');

/**
 * Servicio de parsing de archivos.
 * Soporta: Excel (.xlsx, .xls), CSV, PDF (texto seleccionable).
 * Retorna un array de objetos con los campos del presupuesto.
 */

/**
 * Parsea un archivo y retorna filas estructuradas.
 * @param {string} filePath - Ruta al archivo
 * @param {string} originalName - Nombre original del archivo
 * @returns {Object} { provider, date, number, rows }
 */
async function parseFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
    return parseSpreadsheet(filePath, ext);
  } else if (ext === '.pdf') {
    return parsePDF(filePath);
  }

  throw new Error(`Formato no soportado: ${ext}`);
}

/**
 * Parsea Excel o CSV.
 * Busca columnas por nombre (case-insensitive, acepta variantes).
 */
function parseSpreadsheet(filePath, ext) {
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(ws, { defval: '' });

  if (!rawData.length) return { rows: [] };

  // Mapeo flexible de columnas
  const colMap = buildColumnMap(Object.keys(rawData[0]));

  // Intentar extraer metadatos del encabezado
  const meta = extractMetaFromSheet(ws);

  const rows = [];
  for (const row of rawData) {
    const unitPrice = parseFloat(String(row[colMap.unitPrice] || '').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    const quantity  = parseFloat(String(row[colMap.quantity]  || '').replace(/[^\d.,]/g, '').replace(',', '.')) || 1;

    if (!row[colMap.description] && unitPrice === 0) continue;

    rows.push({
      rawDescription: String(row[colMap.description] || row[colMap.article] || '').trim(),
      quantity,
      unit:       String(row[colMap.unit]      || 'u').trim(),
      unitPrice,
      totalPrice: parseFloat(String(row[colMap.totalPrice] || '').replace(/[^\d.,]/g, '').replace(',', '.')) || (unitPrice * quantity),
      notes:      String(row[colMap.notes]     || '').trim()
    });
  }

  return {
    provider: meta.provider || '',
    date:     meta.date     || '',
    number:   meta.number   || '',
    rows:     rows.filter(r => r.rawDescription || r.unitPrice > 0)
  };
}

/**
 * Construye un mapa de nombres de columnas a nombres estándar.
 */
function buildColumnMap(headers) {
  const map = {};
  const patterns = {
    article:     /art[ií]culo|producto|ítem|item|nombre/i,
    description: /descrip|detalle|concepto/i,
    quantity:    /cant(idad)?|qty|cantidad/i,
    unit:        /unidad|um|ud|uni/i,
    unitPrice:   /precio\s*unit|p\.?\s*unit|valor\s*unit|costo\s*unit/i,
    totalPrice:  /total|importe|subtotal|precio\s*total/i,
    notes:       /obs|nota|coment/i
  };

  for (const header of headers) {
    for (const [key, pattern] of Object.entries(patterns)) {
      if (pattern.test(header) && !map[key]) {
        map[key] = header;
      }
    }
  }

  // Fallbacks por posición si no se encontraron por nombre
  if (!map.description && !map.article && headers[0]) map.description = headers[0];
  if (!map.quantity    && headers[1]) map.quantity  = headers[1];
  if (!map.unit        && headers[2]) map.unit      = headers[2];
  if (!map.unitPrice   && headers[3]) map.unitPrice = headers[3];
  if (!map.totalPrice  && headers[4]) map.totalPrice = headers[4];

  return map;
}

/**
 * Extrae metadatos del encabezado de la hoja (proveedor, fecha, número).
 */
function extractMetaFromSheet(ws) {
  const meta = {};
  const range = xlsx.utils.decode_range(ws['!ref'] || 'A1:Z1');

  // Escanear las primeras 10 filas buscando metadatos
  for (let row = range.s.r; row <= Math.min(range.s.r + 10, range.e.r); row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cell = ws[xlsx.utils.encode_cell({ r: row, c: col })];
      if (!cell || !cell.v) continue;
      const val = String(cell.v);

      if (/proveedor|empresa|razón\s*social/i.test(val)) {
        const nextCell = ws[xlsx.utils.encode_cell({ r: row, c: col + 1 })];
        if (nextCell) meta.provider = String(nextCell.v || '');
      }
      if (/fecha/i.test(val)) {
        const nextCell = ws[xlsx.utils.encode_cell({ r: row, c: col + 1 })];
        if (nextCell) meta.date = String(nextCell.v || '');
      }
      if (/n[úu]m|presupuesto\s*n[°ºo]/i.test(val)) {
        const nextCell = ws[xlsx.utils.encode_cell({ r: row, c: col + 1 })];
        if (nextCell) meta.number = String(nextCell.v || '');
      }
    }
  }
  return meta;
}

/**
 * Parsea un PDF con texto seleccionable.
 * Usa pdfjs-dist (Mozilla) para extracción robusta de texto.
 */
async function parsePDF(filePath) {
  try {
    const fs = require('fs');
    const pdfjsLib = await import('pdfjs-dist');
    const buf = fs.readFileSync(filePath);
    const data = new Uint8Array(buf);
    const pdfDoc = await pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      standardFontDataUrl: null
    }).promise;

    // Extraer texto por páginas, detectando saltos de línea por posición Y
    const pageTexts = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const tc = await page.getTextContent();
      const lines = [];
      let lastY = null;
      let currentLine = '';
      for (const item of tc.items) {
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (currentLine) lines.push(currentLine);
          currentLine = '';
        }
        currentLine += (currentLine && lastY !== null && Math.abs(y - lastY) <= 3 ? ' ' : '') + item.str;
        lastY = y;
      }
      if (currentLine) lines.push(currentLine);
      pageTexts.push(lines.join('\n'));
    }
    const text = pageTexts.join('\n');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const meta = {};
    const itemCandidates = [];

    const skipPattern = /^(presupuesto|detalle|cotizaci[óo]n|total|subtotal|iva|descuento|v[aá]lido|v[aá]lida|gracias|atentamente|p[aá]gina|p[aá]g|[oO]bservaci|nota|importe\s*total|son\s*pesos|nu(e|oe)stro|wsp|whastapp|instagram|domicilio|vendedor|vto|cuit|hoja|código\s+asoc|codigo\s+asoc|documento\s+no\s+v[aá]lido|nombre|fecha|exento|bonif|contado)/i;

    for (const line of lines) {
      if (/proveedor[:\s]+(.+)/i.test(line)) {
        meta.provider = line.match(/proveedor[:\s]+(.+)/i)[1].trim();
        continue;
      }
      if (/fecha[:\s]+(.+)/i.test(line)) {
        meta.date = line.match(/fecha[:\s]+(.+)/i)[1].trim();
        continue;
      }
      if (/^(?:presupuesto\s*)?n[°º]?(?:ro)?[.:]?\s*([\w-]{3,})/i.test(line) && !/art[ií]culo/i.test(line) && !/nuestro|nombre/i.test(line)) {
        const numMatch = line.match(/^(?:presupuesto\s*)?n[°º]?(?:ro)?[.:]?\s*([\w-]{3,})/i);
        if (numMatch && /[0-9]/.test(numMatch[1])) { meta.number = numMatch[1].trim(); continue; }
      }
      if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(line) && !meta.date) {
        meta.date = line;
        continue;
      }
      if (skipPattern.test(line)) continue;
      if (/^(cant|c[óo]digo|codigo|art[ií]culo|articulo|descrip|producto|importe|precio|nota)/i.test(line)) continue;
      if (line.length < 6) continue;
      // Skip lines with no text description (only numbers, $, and punctuation)
      if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(line)) continue;

      itemCandidates.push(line);
    }

    const unit = '(u|kg|l[ts]?|m\\d?|cm|mm|unidad(?:es)?|litro|metro|bolsa|caja|par|docena|paquete|hora|rollo|resma|plancha|pieza)';
    const p = '(\\d+(?:[.,]\\d+)*)';

    const patterns = [
      { re: new RegExp('^(\\d+(?:[.,]\\d+)?)\\s+' + unit + '\\s+(.+?)\\s+\\$?\\s*' + p + '(?:\\s+\\$?\\s*' + p + ')?$', 'i'),
        parse: m => ({ qty: pf(m[1]), unit: m[2].toLowerCase(), desc: m[3].trim(), up: pf(m[4]), tp: m[5] ? pf(m[5]) : pf(m[4]) * pf(m[1]) }) },
      { re: new RegExp('^(\\d+(?:[.,]\\d+)?)\\s+(.+?)\\s+\\$?\\s*' + p + '\\s+\\$?\\s*' + p + '$', 'i'),
        parse: m => ({ qty: pf(m[1]), desc: m[2].trim(), up: pf(m[3]), tp: pf(m[4]), unit: 'u' }) },
      { re: new RegExp('^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s+' + unit + '\\s+\\$?\\s*' + p + '\\s+\\$?\\s*' + p + '$', 'i'),
        parse: m => ({ desc: m[1].trim(), qty: pf(m[2]), unit: m[3], up: pf(m[4]), tp: pf(m[5]) }) },
      { re: new RegExp('^(.+?)\\s+\\$?\\s*' + p + '\\s+\\$?\\s*' + p + '$', 'i'),
        parse: m => ({ desc: m[1].trim(), up: pf(m[2]), tp: pf(m[3]), qty: 1, unit: 'u' }) },
      { re: new RegExp('^(\\d+(?:[.,]\\d+)?)\\s+(.+?)\\s+\\$?\\s*' + p + '$', 'i'),
        parse: m => ({ qty: pf(m[1]), desc: m[2].trim(), up: pf(m[3]), tp: pf(m[3]) * pf(m[1]), unit: 'u' }) },
      { re: new RegExp('^(.+?)\\s+\\$?\\s*' + p + '$', 'i'),
        parse: m => ({ desc: m[1].trim(), up: pf(m[2]), tp: pf(m[2]), qty: 1, unit: 'u' }) },
    ];

    function pf(str) {
      const s = String(str).trim().replace(/[$£€\s]/g, '');
      if (!s) return 0;
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      let n = s;
      if (lastComma > lastDot) {
        n = s.replace(/\./g, '').replace(',', '.');
      } else if (lastDot > lastComma) {
        n = s.replace(/,/g, '');
      } else if (lastComma !== -1) {
        const after = s.split(',').pop();
        n = /^\d{2}$/.test(after) ? s.replace(',', '.') : s.replace(/,/g, '');
      }
      return parseFloat(n) || 0;
    }

    const rows = [];

    for (const line of itemCandidates) {
      let parsed = null;

      // 1) Try regex patterns
      for (let pi = 0; pi < patterns.length && !parsed; pi++) {
        const m = line.match(patterns[pi].re);
        if (!m) continue;
        const r = patterns[pi].parse(m);
        if (r.desc && r.up > 0) {
          // Validate: tp must be > 0 and match up * qty within 5%
          if (r.tp <= 0) continue;
          const expected = r.up * r.qty;
          const ratio = Math.max(expected, r.tp) / Math.min(expected, r.tp);
          if (Math.abs(expected - r.tp) > 0.01 && ratio > 1.05) continue;
          parsed = r;
        }
      }

      // 2) Fallback: token heuristic for lines regex missed
      if (!parsed) {
        const tokens = line.split(/\s+/);
        const numInfo = [];
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];
          const cleaned = t.replace(/[$£€\s]/g, '');
          if (/^\d/.test(cleaned) && pf(cleaned) > 0) {
            numInfo.push({ idx: i, val: pf(cleaned), raw: t, hasDollar: /^[$£€]/.test(t) });
          }
        }

        if (numInfo.length >= 1) {
          // Prices must have $ prefix — ignore naked numbers (they're IVA/discount/extra)
          const prices = numInfo.filter(n => n.hasDollar);
          if (prices.length >= 1) {
            // Everything after the last $ price is non-item garbage
            const lastPriceIdx = prices[prices.length - 1].idx;
            const relevantNumbers = numInfo.filter(n => n.idx <= lastPriceIdx);

            let qty = 1;
            const nonPriceNumbers = relevantNumbers.filter(n => !n.hasDollar);
            if (nonPriceNumbers.length > 0) {
              qty = Math.round(nonPriceNumbers[nonPriceNumbers.length - 1].val);
            }

            let unitPrice = prices[0].val;
            let totalPrice = prices.length > 1 ? prices[1].val : unitPrice * qty;

            // Swap if total * qty ≈ unit (meaning they're reversed)
            if (prices.length > 1 && Math.abs(totalPrice * qty - unitPrice) / Math.max(unitPrice, 1) < 0.05) {
              [unitPrice, totalPrice] = [totalPrice, unitPrice];
            }

            // Description: everything before the first relevant number
            const firstNumIdx = relevantNumbers.length > 0 ? relevantNumbers[0].idx : tokens.length;
            const desc = tokens.slice(0, firstNumIdx).join(' ').trim();

            if (desc && desc.length > 2 && unitPrice > 0) {
              parsed = { desc, qty, unit: 'u', up: unitPrice, tp: totalPrice };
            }
          }
        }
      }

      if (parsed && parsed.desc && parsed.up > 0) {
        rows.push({
          rawDescription: parsed.desc,
          quantity:       parsed.qty,
          unit:           parsed.unit,
          unitPrice:      parsed.up,
          totalPrice:     parsed.tp,
          notes:          ''
        });
      }
    }

    return { ...meta, rows };
  } catch (err) {
    console.error('Error parseando PDF:', err.message);
    return { rows: [] };
  }
}

module.exports = { parseFile };
