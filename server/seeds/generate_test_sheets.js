/**
 * generate_test_sheets.js
 * Genera archivos Excel de prueba en la carpeta pública
 * para que el usuario pueda descargarlos y probar el sistema.
 */

const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '../../public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

function generateUtilesSheet() {
  const data = [
    ["Presupuesto N°", "PRE-UTIL-882", "", ""],
    ["Fecha", "2026-07-02", "", ""],
    ["Proveedor", "Librería Escolar Sur", "", ""],
    [],
    ["Detalle del Artículo", "Cant.", "Unidad", "Precio Unit.", "Observaciones"],
    ["Cable IRAM Unipolar 2.5mm²", "150", "metro", "1950", "Color celeste"],
    ["Disyuntor Termomagnético 16A", "5", "unidad", "19500", "Marca Sica"],
    ["Guantes de Látex Talle M", "8", "caja", "9200", "Descartables"],
    ["Barbijo N95 / FFP2", "12", "caja", "11500", "Protección respiratoria"],
    ["Tomacorriente Doble 2P+T", "25", "unidad", "5400", "Línea standard"]
  ];

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, "Útiles y Suministros");
  xlsx.writeFile(wb, path.join(publicDir, 'ejemplo_utiles.xlsx'));
}

function generatePinturaSheet() {
  const data = [
    ["PINTURAS Y CONSTRUCCIÓN - PEDIDO MUNICIPAL"],
    ["Nro Documento", "FAC-9912A"],
    [],
    ["Producto Solicitado", "Volumen / Cantidad", "Precio x Unidad", "Notas"],
    ["Pintura Látex Interior Blanca", "80", "10200", "Baldes de 20L"],
    ["Pintura Látex Exterior", "40", "11500", "Alta resistencia"],
    ["Cemento Portland 50kg", "100", "19200", "Loma Negra"],
    ["Cal Hidráulica 25kg", "50", "10400", "Bolsas"],
    ["Rodillo de Lana 22cm", "15", "7200", "Uso profesional"],
    ["Pincel N° 2", "30", "4100", "Cerda fina"]
  ];

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, "Pintura y Obra");
  xlsx.writeFile(wb, path.join(publicDir, 'ejemplo_pintura.xlsx'));
}

generateUtilesSheet();
generatePinturaSheet();
console.log('🌱 Excel files generated successfully in public directory!');
