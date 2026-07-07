'use strict';

require('dotenv').config();
const db    = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function main() {
  await db.initDB();
  console.log('\n🌱 Iniciando carga de datos de demostración...\n');

  // ─── Limpiar datos existentes ─────────────────────────────────────────────────
  await db.prepare('DELETE FROM comparisons').run();
  await db.prepare('DELETE FROM search_history').run();
  await db.prepare('DELETE FROM price_history').run();
  await db.prepare('DELETE FROM budget_details').run();
  await db.prepare('DELETE FROM alerts').run();
  await db.prepare('DELETE FROM audit_log').run();
  await db.prepare('DELETE FROM budgets').run();
  await db.prepare('DELETE FROM articles').run();
  await db.prepare('DELETE FROM providers').run();
  await db.prepare('DELETE FROM users').run();
  console.log('  ✓ Base de datos limpiada');

  function batchRows(table, columns, rows) {
    if (!rows.length) return;
    const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    return db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`)
      .run(...rows.flat());
  }

  // ─── USUARIOS ────────────────────────────────────────────────────────────────
  const users = [
    { id: uuidv4(), name: 'Administrador',     email: 'admin@demo.com',    password: 'admin123',   role: 'admin' },
    { id: uuidv4(), name: 'Carlos Mendoza',    email: 'compras@demo.com',  password: 'compras123', role: 'purchases' },
    { id: uuidv4(), name: 'María Gonzalez',    email: 'consulta@demo.com', password: 'consulta123',role: 'readonly' },
  ];

  await batchRows('users', ['id','name','email','password','role'],
    users.map(u => [u.id, u.name, u.email, bcrypt.hashSync(u.password, 10), u.role]));
  console.log('  ✓ Usuarios creados (admin@demo.com / admin123)');

  // ─── PROVEEDORES ──────────────────────────────────────────────────────────────
  const PROV = {
    constructor: uuidv4(),
    pintureria:  uuidv4(),
    ferreteria:  uuidv4(),
    distribuidora: uuidv4(),
    suministros: uuidv4(),
  };

  const providers = [
    { id: PROV.constructor,   name: 'Materiales El Constructor SA',      cuit: '30-71234567-8', address: 'Av. San Martín 1542', phone: '011-4523-7890', email: 'ventas@constructor.com.ar',   city: 'Buenos Aires',   province: 'Buenos Aires',   notes: 'Proveedor principal de materiales de construcción. Entrega en 48hs.', rating: 4.5 },
    { id: PROV.pintureria,    name: 'Pinturería Color Total SRL',         cuit: '30-58234567-3', address: 'Bv. Illia 890',        phone: '0351-423-5678', email: 'info@colortotal.com.ar',     city: 'Córdoba',        province: 'Córdoba',        notes: 'Especialistas en pinturas y revestimientos. Buen servicio post-venta.', rating: 4.8 },
    { id: PROV.ferreteria,    name: 'Ferretería y Const. Norte SRL',      cuit: '20-28765432-1', address: 'Corrientes 3456',      phone: '0341-456-1234', email: 'ferreteria@norte.com.ar',    city: 'Rosario',        province: 'Santa Fe',       notes: 'Ferretería completa. Precios competitivos en electricidad y plomería.', rating: 4.2 },
    { id: PROV.distribuidora, name: 'Distribuidora Sur Materiales',        cuit: '30-71987654-2', address: 'San Lorenzo 567',      phone: '0261-489-2345', email: 'contacto@distribsur.com.ar', city: 'Mendoza',        province: 'Mendoza',        notes: 'Distribuidor regional. Descuentos por volumen.', rating: 3.9 },
    { id: PROV.suministros,   name: 'Suministros Patagónicos SRL',        cuit: '30-64321098-7', address: 'Mitre 234',            phone: '0221-467-8901', email: 'ventas@suministrospatag.com.ar', city: 'La Plata',  province: 'Buenos Aires',   notes: 'Buen stock de materiales eléctricos y sanitarios.', rating: 4.1 },
  ];

  await batchRows('providers', ['id','name','cuit','address','phone','email','city','province','notes','rating'],
    providers.map(p => [p.id, p.name, p.cuit, p.address, p.phone, p.email, p.city, p.province, p.notes, p.rating]));
  console.log('  ✓ 5 proveedores creados');

  // ─── ARTÍCULOS ────────────────────────────────────────────────────────────────
  const ART = {};
  const articles = [
    { key: 'latex_blanco',    name: 'Pintura Látex Interior Blanca',     aliases: ['Látex Blanco', 'Pintura Blanca', 'Latex Interior', 'Pintura Látex'], category: 'Pinturas',        unit: 'litro',   tags: ['pintura','interior'] },
    { key: 'latex_exterior',  name: 'Pintura Látex Exterior',            aliases: ['Látex Exterior', 'Pintura Exterior', 'Latex Ext'],                   category: 'Pinturas',        unit: 'litro',   tags: ['pintura','exterior'] },
    { key: 'esmalte',         name: 'Esmalte Sintético Brillante',       aliases: ['Esmalte Blanco', 'Esmalte Sintético', 'Esmalte'],                    category: 'Pinturas',        unit: 'litro',   tags: ['pintura','esmalte'] },
    { key: 'endudo',          name: 'Enduido Plástico',                   aliases: ['Enduido', 'Masilla', 'Enduido Plástico'],                             category: 'Pinturas',        unit: 'kg',      tags: ['pintura','endudo'] },
    { key: 'rodillo',         name: 'Rodillo para Pintar 23cm',           aliases: ['Rodillo', 'Rodillo 23cm'],                                            category: 'Pinturas',        unit: 'unidad',  tags: ['accesorio','pintura'] },
    { key: 'cielorraso',      name: 'Placa de Cielorraso 60x60',          aliases: ['Cielorraso', 'Placa 60x60', 'Durlock 60x60'],                        category: 'Construcción',    unit: 'unidad',  tags: ['construcción','cielorraso'] },
    { key: 'durlock_12',     name: 'Placa de Durlock 12mm',              aliases: ['Durlock 12mm', 'Placa Yeso 12mm'],                                    category: 'Construcción',    unit: 'unidad',  tags: ['construcción','durlock'] },
    { key: 'perfil_maestro', name: 'Perfil Maestro para Durlock',         aliases: ['Perfil Maestro', 'Perfil U'],                                          category: 'Construcción',    unit: 'unidad',  tags: ['construcción','perfil'] },
    { key: 'cemento',         name: 'Cemento Portland 50kg',              aliases: ['Cemento', 'Cemento Portland', 'Bolsa Cemento 50'],                   category: 'Construcción',    unit: 'bolsa',   tags: ['construcción','cemento'] },
    { key: 'cal',             name: 'Cal Hidráulica 25kg',                 aliases: ['Cal', 'Cal Hidráulica'],                                              category: 'Construcción',    unit: 'bolsa',   tags: ['construcción','cal'] },
    { key: 'arena',           name: 'Arena Fina x m3',                     aliases: ['Arena', 'Arena Fina'],                                                category: 'Construcción',    unit: 'm3',      tags: ['construcción','arena'] },
    { key: 'piedra',          name: 'Piedra Partida x m3',                 aliases: ['Piedra', 'Piedra Partida'],                                           category: 'Construcción',    unit: 'm3',      tags: ['construcción','piedra'] },
    { key: 'ladrillo_comun', name: 'Ladrillo Común Hueco 8x18x33',        aliases: ['Ladrillo Hueco', 'Ladrillo 8x18x33', 'Ladrillo común'],              category: 'Construcción',    unit: 'unidad',  tags: ['construcción','ladrillo'] },
    { key: 'ladrillo_vista', name: 'Ladrillo Visto 18x18x33',            aliases: ['Ladrillo Visto', 'Ladrillo Cara Vista'],                              category: 'Construcción',    unit: 'unidad',  tags: ['construcción','ladrillo'] },
    { key: 'viga_metalica',  name: 'Viga Metálica IPN 100',               aliases: ['Viga IPN 100', 'Viga Metálica', 'IPN 100'],                           category: 'Estructuras',     unit: 'metro',   tags: ['estructura','metal'] },
    { key: 'perfil_c',       name: 'Perfil C 100x50',                     aliases: ['Perfil C', 'C100x50'],                                                 category: 'Estructuras',     unit: 'metro',   tags: ['estructura','perfil'] },
    { key: 'varilla_calculo',name: 'Varilla de Construcción 8mm',        aliases: ['Varilla 8mm', 'Hierro 8'],                                             category: 'Estructuras',     unit: 'unidad',  tags: ['estructura','varilla'] },
    { key: 'ventana_alum',   name: 'Ventana de Aluminio 1x1',            aliases: ['Ventana Aluminio'],                                                   category: 'Carpintería',     unit: 'unidad',  tags: ['carpintería','aluminio'] },
    { key: 'puerta_pino',    name: 'Puerta de Pino 0.80x2.00',           aliases: ['Puerta Pino', 'Puerta 0.80','Puerta interior'],                      category: 'Carpintería',     unit: 'unidad',  tags: ['carpintería','puerta'] },
    { key: 'mesada_granito', name: 'Mesada de Granito 3m',                aliases: ['Mesada Granito', 'Granito 3m'],                                       category: 'Carpintería',     unit: 'unidad',  tags: ['carpintería','granito'] },
    { key: 'cable_6',        name: 'Cable Eléctrico 6mm (x100m)',        aliases: ['Cable 6mm', 'Cable Eléctrico 6mm'],                                   category: 'Electricidad',    unit: 'metro',   tags: ['eléctrico','cable'] },
    { key: 'cable_2_5',      name: 'Cable Eléctrico 2.5mm (x100m)',      aliases: ['Cable 2.5mm', 'Cable Eléctrico 2.5mm'],                               category: 'Electricidad',    unit: 'metro',   tags: ['eléctrico','cable'] },
    { key: 'disyuntor_16',   name: 'Disyuntor Diferencial 40A',          aliases: ['Disyuntor 40A', 'Disyuntor'],                                         category: 'Electricidad',    unit: 'unidad',  tags: ['eléctrico','seguridad'] },
    { key: 'tomacorriente',  name: 'Tomacorriente Doble',                 aliases: ['Tomacorriente', 'Toma Doble', 'Enchufe'],                             category: 'Electricidad',    unit: 'unidad',  tags: ['eléctrico','accesorio'] },
    { key: 'cano_pvc_4',     name: 'Caño PVC 110mm x 3m',                 aliases: ['Caño PVC 110', 'PVC 110', 'Caño 110'],                                category: 'Sanitarios',      unit: 'unidad',  tags: ['sanitario','pvc'] },
    { key: 'membrana',       name: 'Membrana Asfáltica 10m2',            aliases: ['Membrana Asfáltica', 'Membrana'],                                     category: 'Construcción',    unit: 'm2',     tags: ['construcción','impermeabilización'] },
    { key: 'diluyente',      name: 'Diluyente Sintético x 1lt',           aliases: ['Diluyente', 'Aguarrás', 'Solvente'],                                  category: 'Pinturas',        unit: 'litro',   tags: ['pintura','diluyente'] },
    { key: 'pico_carga',     name: 'Pico de Carga (Andamio)',            aliases: ['Pico de Carga', 'Andamio pico'],                                      category: 'Seguridad',       unit: 'unidad',  tags: ['seguridad','andamio'] },
    { key: 'malla_seguridad',name: 'Malla de Seguridad x 50m',           aliases: ['Malla Seguridad', 'Malla de Seguridad'],                              category: 'Seguridad',       unit: 'unidad',  tags: ['seguridad','malla'] },
    { key: 'botin_seguridad',name: 'Botín de Seguridad Punta de Acero',  aliases: ['Botín Seguridad', 'Botín Punta Acero', 'Calzado Seguridad'],          category: 'Seguridad',       unit: 'par',     tags: ['seguridad','calzado'] },
  ];

  await batchRows('articles', ['id','name','aliases','category','unit','tags'],
    articles.map(a => { const id = uuidv4(); ART[a.key] = id; return [id, a.name, JSON.stringify(a.aliases), a.category, a.unit, JSON.stringify(a.tags)]; }));
  console.log('  ✓ 30 artículos creados');

  // ─── PRESUPUESTOS HISTÓRICOS ──────────────────────────────────────────────────
  const BASE_PRICES = {
    latex_blanco: 4500, latex_exterior: 5200, esmalte: 3800, endudo: 2500, rodillo: 2200,
    cielorraso: 3200, durlock_12: 4800, perfil_maestro: 1800, cemento: 5500, cal: 2800,
    arena: 12000, piedra: 15000, ladrillo_comun: 180, ladrillo_vista: 350,
    viga_metalica: 8500, perfil_c: 4200, varilla_calculo: 3800,
    ventana_alum: 45000, puerta_pino: 28000, mesada_granito: 65000,
    cable_6: 2500, cable_2_5: 1200, disyuntor_16: 8500, tomacorriente: 1500,
    cano_pvc_4: 3800, membrana: 12000, diluyente: 1800,
    pico_carga: 15000, malla_seguridad: 8500, botin_seguridad: 12000
  };

  const historyArticles = [
    { key: 'latex_blanco',     qty: 50,  unit: 'litro' },
    { key: 'latex_exterior',   qty: 40,  unit: 'litro' },
    { key: 'esmalte',          qty: 15,  unit: 'litro' },
    { key: 'endudo',           qty: 20,  unit: 'kg' },
    { key: 'rodillo',          qty: 5,   unit: 'unidad' },
    { key: 'cemento',          qty: 100, unit: 'bolsa' },
    { key: 'cal',              qty: 30,  unit: 'bolsa' },
    { key: 'ladrillo_comun',   qty: 500, unit: 'unidad' },
    { key: 'arena',            qty: 5,   unit: 'm3' },
    { key: 'piedra',           qty: 3,   unit: 'm3' },
    { key: 'cielorraso',       qty: 40,  unit: 'unidad' },
    { key: 'durlock_12',       qty: 30,  unit: 'unidad' },
    { key: 'perfil_maestro',   qty: 20,  unit: 'unidad' },
    { key: 'ladrillo_vista',   qty: 200, unit: 'unidad' },
    { key: 'viga_metalica',    qty: 10,  unit: 'metro' },
    { key: 'varilla_calculo',  qty: 50,  unit: 'unidad' },
    { key: 'ventana_alum',     qty: 5,   unit: 'unidad' },
    { key: 'puerta_pino',      qty: 8,   unit: 'unidad' },
    { key: 'cable_6',          qty: 100, unit: 'metro' },
    { key: 'cable_2_5',        qty: 200, unit: 'metro' },
    { key: 'disyuntor_16',     qty: 10,  unit: 'unidad' },
    { key: 'tomacorriente',    qty: 20,  unit: 'unidad' },
    { key: 'cano_pvc_4',       qty: 15,  unit: 'unidad' },
    { key: 'membrana',         qty: 30,  unit: 'm2' },
    { key: 'diluyente',        qty: 20,  unit: 'litro' },
  ];

  function dateStr(monthsAgo, day) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d.toISOString().slice(0, 10);
  }

  function inflatePrice(basePrice, monthsAgo) {
    const monthlyInflation = 0.03;
    return Math.round(basePrice * Math.pow(1 + monthlyInflation, monthsAgo));
  }

  function providerPrice(basePrice, provId) {
    const pct = {
      [PROV.constructor]:   { min: 0.92, max: 1.08 },
      [PROV.pintureria]:    { min: 0.88, max: 1.12 },
      [PROV.ferreteria]:    { min: 0.95, max: 1.05 },
      [PROV.distribuidora]: { min: 0.90, max: 1.10 },
      [PROV.suministros]:   { min: 0.93, max: 1.07 },
    };
    const r = pct[provId] || { min: 0.90, max: 1.10 };
    const factor = r.min + Math.random() * (r.max - r.min);
    return Math.max(1, Math.round(basePrice * factor));
  }

  let budgetSeqNum = 1000;
  let totalHistoryBudgets = 0;
  let totalPriceHistory = 0;

  const historicPeriods = [18, 16, 14, 12, 10, 8, 6, 4, 2];

  for (const monthsAgo of historicPeriods) {
    for (const provId of Object.values(PROV)) {
      if (Math.random() > 0.7) continue;

      const bId = uuidv4();
      const bDate = dateStr(monthsAgo, Math.floor(Math.random() * 25) + 1);
      let total = 0;

      await db.prepare(`INSERT INTO budgets (id, provider_id, number, date, type, status, file_name, total_amount, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'history', 'pending', ?, 0, datetime('now'), datetime('now'))`)
        .run(bId, provId, `PRES-${++budgetSeqNum}`, bDate, `presupuesto_${budgetSeqNum}.xlsx`);

      const selectedArts = historyArticles.filter(() => Math.random() > 0.3);
      const details = [];
      const priceRows = [];

      for (const artDef of selectedArts) {
        const artId = ART[artDef.key];
        if (!artId) continue;
        const basePrice = inflatePrice(BASE_PRICES[artDef.key], monthsAgo);
        const unitPrice = providerPrice(basePrice, provId);
        const qty = artDef.qty + Math.floor((Math.random() - 0.5) * artDef.qty * 0.4);
        const totalPrice = unitPrice * qty;
        total += totalPrice;

        const detId = uuidv4();
        const article = articles.find(a => a.key === artDef.key);

        details.push([detId, bId, artId, article ? article.name : '', qty, artDef.unit, unitPrice, totalPrice]);
        priceRows.push([uuidv4(), artId, provId, bId, detId, unitPrice, qty, bDate]);
        totalPriceHistory++;
      }

      if (details.length) {
        await batchRows('budget_details', ['id','budget_id','article_id','raw_description','quantity','unit','unit_price','total_price'], details);
        await batchRows('price_history', ['id','article_id','provider_id','budget_id','budget_detail_id','unit_price','quantity','date'], priceRows);
      }
      await db.prepare('UPDATE budgets SET total_amount = ? WHERE id = ?').run(total, bId);
      totalHistoryBudgets++;
    }
  }

  const extraSets = [
    { proveedor: PROV.constructor,   mes: 4, arts: { cable_6: 300, cable_2_5: 500, disyuntor_16: 20, cemento: 50, ladrillo_comun: 1000 } },
    { proveedor: PROV.constructor,   mes: 1, arts: { cemento: 80, arena: 10, piedra: 5, ladrillo_vista: 400 } },
    { proveedor: PROV.pintureria,    mes: 3, arts: { latex_blanco: 100, latex_exterior: 80, esmalte: 30, endudo: 40, rodillo: 15, diluyente: 50 } },
    { proveedor: PROV.pintureria,    mes: 1, arts: { latex_blanco: 60, esmalte: 20, rodillo: 10 } },
    { proveedor: PROV.ferreteria,    mes: 5, arts: { cano_pvc_4: 30, tomacorriente: 40, cable_6: 150, cable_2_5: 300 } },
    { proveedor: PROV.ferreteria,    mes: 1, arts: { disyuntor_16: 15, tomacorriente: 50, cable_6: 200 } },
    { proveedor: PROV.distribuidora, mes: 2, arts: { durlock_12: 60, perfil_maestro: 40, cielorraso: 80, viga_metalica: 20 } },
    { proveedor: PROV.suministros,   mes: 1, arts: { ventana_alum: 8, puerta_pino: 12, mesada_granito: 3 } },
    { proveedor: PROV.suministros,   mes: 3, arts: { ventana_alum: 4, puerta_pino: 6, mesada_granito: 2 } },
  ];

  for (const set of extraSets) {
    const bId = uuidv4();
    const bDate = dateStr(set.mes, 15);
    let total = 0;

    await db.prepare(`INSERT INTO budgets (id, provider_id, number, date, type, status, file_name, total_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'history', 'pending', ?, 0, datetime('now'), datetime('now'))`)
      .run(bId, set.proveedor, `PRES-${++budgetSeqNum}`, bDate, `presupuesto_${budgetSeqNum}.xlsx`);

    const details = [];
    const priceRows = [];

    for (const [artKey, qty] of Object.entries(set.arts)) {
      const artId = ART[artKey];
      if (!artId) continue;
      const basePrice = inflatePrice(BASE_PRICES[artKey], set.mes);
      const unitPrice = providerPrice(basePrice, set.proveedor);
      const totalPrice = unitPrice * qty;
      total += totalPrice;

      const detId = uuidv4();
      const article = articles.find(a => a.key === artKey);

      details.push([detId, bId, artId, article ? article.name : '', qty, article ? article.unit : 'unidad', unitPrice, totalPrice]);
      priceRows.push([uuidv4(), artId, set.proveedor, bId, detId, unitPrice, qty, bDate]);
      totalPriceHistory++;
    }

    if (details.length) {
      await batchRows('budget_details', ['id','budget_id','article_id','raw_description','quantity','unit','unit_price','total_price'], details);
      await batchRows('price_history', ['id','article_id','provider_id','budget_id','budget_detail_id','unit_price','quantity','date'], priceRows);
    }
    await db.prepare('UPDATE budgets SET total_amount = ? WHERE id = ?').run(total, bId);
    totalHistoryBudgets++;
  }

  console.log(`  ✓ ${totalHistoryBudgets} presupuestos históricos creados`);
  console.log(`  ✓ ${totalPriceHistory} registros de historial de precios`);

  // ─── PRESUPUESTO NUEVO DE EJEMPLO ──────────────────────────────────────────
  const newBudgetId = uuidv4();
  const newBudgetArticles = [
    { key: 'latex_blanco',   qty: 80,  unit: 'litro' },
    { key: 'latex_exterior', qty: 60,  unit: 'litro' },
    { key: 'esmalte',        qty: 20,  unit: 'litro' },
    { key: 'endudo',         qty: 30,  unit: 'kg' },
    { key: 'cemento',        qty: 120, unit: 'bolsa' },
    { key: 'cal',            qty: 40,  unit: 'bolsa' },
    { key: 'aren',           qty: 6,   unit: 'm3' },
    { key: 'ladrillo_comun', qty: 800, unit: 'unidad' },
    { key: 'piedra',         qty: 4,   unit: 'm3' },
    { key: 'disyuntor_16',   qty: 12,  unit: 'unidad' },
    { key: 'cable_6',        qty: 150, unit: 'metro' },
    { key: 'cable_2_5',      qty: 300, unit: 'metro' },
    { key: 'tomacorriente',  qty: 30,  unit: 'unidad' },
    { key: 'cano_pvc_4',     qty: 20,  unit: 'unidad' },
    { key: 'membrana',       qty: 40,  unit: 'm2' },
    { key: 'diluyente',      qty: 20,  unit: 'litro' },
  ];

  const newDate = new Date().toISOString().slice(0, 10);
  let newTotal = 0;

  await db.prepare(`INSERT INTO budgets (id, provider_id, number, date, type, status, file_name, total_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'new', 'pending', ?, 0, datetime('now'), datetime('now'))`)
    .run(newBudgetId, PROV.constructor, `PRES-${++budgetSeqNum}`, newDate, 'presupuesto_nuevo.xlsx');

  const newDetails = [];
  for (const artDef of newBudgetArticles) {
    const artId = ART[artDef.key];
    if (!artId) continue;
    const basePrice = BASE_PRICES[artDef.key];
    const unitPrice = Math.round(basePrice * (0.95 + Math.random() * 0.15));
    const totalPrice = unitPrice * artDef.qty;
    newTotal += totalPrice;

    const detId = uuidv4();
    const article = articles.find(a => a.key === artDef.key);
    newDetails.push([detId, newBudgetId, artId, article ? article.name : '', artDef.qty, artDef.unit, unitPrice, totalPrice]);
  }
  if (newDetails.length) {
    await batchRows('budget_details', ['id','budget_id','article_id','raw_description','quantity','unit','unit_price','total_price'], newDetails);
  }

  await db.prepare('UPDATE budgets SET total_amount = ? WHERE id = ?').run(newTotal, newBudgetId);
  console.log(`  ✓ Presupuesto nuevo de ejemplo creado (ID: ${newBudgetId})`);

  // ─── COMPARACIÓN DE EJEMPLO ──────────────────────────────────────────────
  const results = [];
  let totalSavings = 0;
  let overpricedCount = 0, cheaperCount = 0, averageCount = 0;
  const allDetails = await db.prepare(`
    SELECT bd.*, a.name as article_name
    FROM budget_details bd
    LEFT JOIN articles a ON a.id = bd.article_id
    WHERE bd.budget_id = ?
  `).all(newBudgetId);

  for (const det of allDetails) {
    if (!det.article_id) continue;
    const stats = await db.prepare(`
      SELECT AVG(ph.unit_price) as avg_price, COUNT(*) as count
      FROM price_history ph
      WHERE ph.article_id = ? AND ph.unit_price > 0
    `).get(det.article_id);

    if (!stats || !stats.avg_price) continue;

    const avgPrice = stats.avg_price;
    const diff = det.unit_price - avgPrice;
    const pctDiff = avgPrice > 0 ? (diff / avgPrice) * 100 : 0;
    let category;

    if (pctDiff > 10)            { category = 'overpriced'; overpricedCount++; totalSavings += diff; }
    else if (pctDiff < -5)       { category = 'cheaper';    cheaperCount++; }
    else                         { category = 'average';    averageCount++; }

    results.push({
      detailId: det.id, articleId: det.article_id, articleName: det.article_name || det.raw_description,
      budgetPrice: det.unit_price, avgPrice: Math.round(avgPrice), diff: Math.round(diff), pctDiff: Math.round(pctDiff * 10) / 10, category
    });
  }

  const compId = uuidv4();
  await db.prepare(`INSERT INTO comparisons (id, budget_id, date, total_budget, total_savings, savings_pct, items_overpriced, items_average, items_cheaper, results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(compId, newBudgetId, newDate, newTotal, Math.round(Math.abs(totalSavings)),
      newTotal > 0 ? Math.round((Math.abs(totalSavings) / newTotal) * 100) : 0,
      overpricedCount, averageCount, cheaperCount, JSON.stringify(results));

  console.log(`  ✓ Comparación de ejemplo generada (ahorro potencial: $${totalSavings.toLocaleString('es-AR')})\n`);

  // ─── RESUMEN FINAL ──────────────────────────────────────────────────────
  console.log('  ═══════════════════════════════════════════════');
  console.log('  ✅ DATOS DE DEMOSTRACIÓN CARGADOS EXITOSAMENTE');
  console.log('  ═══════════════════════════════════════════════');
  console.log('');
  console.log('  Credenciales de acceso:');
  console.log('  • admin@demo.com    / admin123    (Administrador)');
  console.log('  • compras@demo.com  / compras123  (Compras)');
  console.log('  • consulta@demo.com / consulta123 (Solo lectura)');
  console.log('');
  console.log('  Inicia el servidor con: npm start');
  console.log('  Abre: http://localhost:3000\n');
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n[FATAL] Error durante la carga de datos:', err);
    process.exit(1);
  });
}

module.exports = { main };
