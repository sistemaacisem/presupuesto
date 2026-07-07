'use strict';

const PDFDocument = require('pdfkit');
const db = require('../config/database');

function generateComparisonPDF(comparisonId) {
  return new Promise((resolve, reject) => {
    try {
      const comp = db.prepare('SELECT * FROM comparisons WHERE id = ?').get(comparisonId);
      if (!comp) return reject(Object.assign(new Error('Comparación no encontrada'), { status: 404 }));

      const budget = db.prepare(`
        SELECT b.*, p.name as provider_name
        FROM budgets b LEFT JOIN providers p ON p.id = b.provider_id
        WHERE b.id = ?
      `).get(comp.budget_id);

      const results = JSON.parse(comp.results || '[]');

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { width } = doc.page;

      doc.font('Helvetica-Bold').fontSize(18)
         .text('A.C.I.S.E.M.', { align: 'center' })
         .fontSize(10).font('Helvetica')
         .text('Secretaría de Educación — Comparación de Presupuestos', { align: 'center' })
         .moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(width - 40, doc.y).stroke('#ccc');
      doc.moveDown(1);

      doc.fontSize(11).font('Helvetica-Bold').text('Datos del Presupuesto');
      doc.font('Helvetica').fontSize(10);
      const date = new Date().toLocaleDateString('es-AR');
      doc.text(`Informe generado: ${date}`);
      if (budget) {
        doc.text(`Proveedor: ${budget.provider_name || '—'}`);
        doc.text(`N° Presupuesto: ${budget.number || '—'}`);
        doc.text(`Fecha: ${budget.date || '—'}`);
      }
      doc.moveDown(1);

      doc.fontSize(11).font('Helvetica-Bold').text('Resumen');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Presupuesto total: $${(comp.total_budget || 0).toLocaleString('es-AR')}`);
      doc.text(`Ahorro potencial: $${(comp.total_savings || 0).toLocaleString('es-AR')}`);
      doc.text(`Sobrepreciados: ${comp.items_overpriced || 0}`);
      doc.text(`En promedio: ${comp.items_average || 0}`);
      doc.text(`Más baratos: ${comp.items_cheaper || 0}`);
      doc.moveDown(1);

      if (results.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Detalle de Artículos');
        doc.moveDown(0.3);

        const tableTop = doc.y;
        const colX = [40, 160, 230, 310, 390, 460];
        const colW = [120, 70, 80, 80, 70, 70];

        doc.font('Helvetica-Bold').fontSize(8.5);
        ['Artículo', 'Cant.', 'Precio', 'Promedio', 'Var.%', 'Estado'].forEach((h, i) => {
          doc.text(h, colX[i], tableTop, { width: colW[i], align: i === 0 ? 'left' : 'center' });
        });

        doc.moveTo(40, doc.y + 2).lineTo(width - 40, doc.y + 2).stroke('#ccc');
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(8);
        for (const r of results) {
          const y = doc.y;
          const name = (r.article_name || r.raw_description || '—').substring(0, 30);
          const qty = r.quantity || 1;
          const price = r.unit_price || 0;
          const avg = r.comparison?.avgPrice || 0;
          const diff = r.comparison?.diffPct || 0;
          const status = r.status === 'overpriced' ? 'Caros' : r.status === 'cheaper' ? 'Barato' : 'Prom.';

          if (y > 720) {
            doc.addPage();
          }

          doc.text(name, colX[0], doc.y, { width: colW[0] });
          doc.text(String(qty), colX[1], doc.y - 10, { width: colW[1], align: 'center' });
          doc.text(`$${price.toLocaleString('es-AR')}`, colX[2], doc.y - 10, { width: colW[2], align: 'center' });
          doc.text(`$${Math.round(avg).toLocaleString('es-AR')}`, colX[3], doc.y - 10, { width: colW[3], align: 'center' });
          doc.text(`${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`, colX[4], doc.y - 10, { width: colW[4], align: 'center' });
          doc.text(status, colX[5], doc.y - 10, { width: colW[5], align: 'center' });
          doc.moveDown(0.1);
        }
      }

      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica').fillColor('#888')
         .text('Generado por A.C.I.S.E.M. — Asistente de Compras Inteligente para la Secretaría de Educación', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function generateBudgetPDF(budgetId) {
  return new Promise((resolve, reject) => {
    try {
      const budget = db.prepare(`
        SELECT b.*, p.name as provider_name, p.cuit as provider_cuit
        FROM budgets b LEFT JOIN providers p ON p.id = b.provider_id
        WHERE b.id = ?
      `).get(budgetId);
      if (!budget) return reject(Object.assign(new Error('Presupuesto no encontrado'), { status: 404 }));

      const details = db.prepare(`
        SELECT bd.*, a.name as article_name, a.category
        FROM budget_details bd
        LEFT JOIN articles a ON a.id = bd.article_id
        WHERE bd.budget_id = ?
      `).all(budgetId);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { width } = doc.page;

      doc.font('Helvetica-Bold').fontSize(18)
         .text('A.C.I.S.E.M.', { align: 'center' })
         .fontSize(10).font('Helvetica')
         .text('Secretaría de Educación — Detalle de Presupuesto', { align: 'center' })
         .moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(width - 40, doc.y).stroke('#ccc');
      doc.moveDown(1);

      doc.fontSize(11).font('Helvetica-Bold').text('Datos del Presupuesto');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Proveedor: ${budget.provider_name || '—'}`);
      doc.text(`CUIT: ${budget.provider_cuit || '—'}`);
      doc.text(`N°: ${budget.number || '—'}`);
      doc.text(`Fecha: ${budget.date || '—'}`);
      doc.text(`Total: $${(budget.total_amount || 0).toLocaleString('es-AR')}`);
      doc.text(`Estado: ${budget.status || '—'}`);
      doc.moveDown(1);

      if (details.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Artículos');
        doc.moveDown(0.3);

        doc.font('Helvetica-Bold').fontSize(9);
        const colX = [40, 170, 240, 310, 380, 460];
        const colW = [130, 70, 70, 70, 70, 70];
        ['Artículo', 'Cant.', 'Unidad', 'P.Unit', 'Total', 'Categoría'].forEach((h, i) => {
          doc.text(h, colX[i], doc.y, { width: colW[i], align: i === 0 ? 'left' : 'center' });
        });

        doc.moveTo(40, doc.y + 2).lineTo(width - 40, doc.y + 2).stroke('#ccc');
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(8);
        for (const d of details) {
          if (doc.y > 720) doc.addPage();
          const name = (d.article_name || d.raw_description || '—').substring(0, 35);
          doc.text(name, colX[0], doc.y, { width: colW[0] });
          doc.text(String(d.quantity || 1), colX[1], doc.y - 10, { width: colW[1], align: 'center' });
          doc.text(d.unit || 'u', colX[2], doc.y - 10, { width: colW[2], align: 'center' });
          doc.text(`$${(d.unit_price || 0).toLocaleString('es-AR')}`, colX[3], doc.y - 10, { width: colW[3], align: 'center' });
          doc.text(`$${(d.total_price || 0).toLocaleString('es-AR')}`, colX[4], doc.y - 10, { width: colW[4], align: 'center' });
          doc.text(d.category || '', colX[5], doc.y - 10, { width: colW[5], align: 'center' });
          doc.moveDown(0.1);
        }
      }

      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica').fillColor('#888')
         .text('Generado por A.C.I.S.E.M. — Asistente de Compras Inteligente', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateComparisonPDF, generateBudgetPDF };
