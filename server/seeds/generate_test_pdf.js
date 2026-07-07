const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../../public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

function generateTestPdf() {
  const doc = new PDFDocument({ margin: 50, compress: false });
  const stream = fs.createWriteStream(path.join(publicDir, 'ejemplo_utiles.pdf'));
  doc.pipe(stream);

  // Cabecera
  doc.fontSize(20).text('PRESUPUESTO COMERCIAL', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text('Fecha: 02/07/2026');
  doc.text('Proveedor: Librería Escolar Sur');
  doc.text('Presupuesto Nro: PRE-UTIL-882');
  doc.moveDown(2);

  // Tabla simulada de artículos (formato texto para el parser)
  const drawRow = (cant, unidad, desc, precio) => {
    doc.text(`${cant} ${unidad} ${desc} $${precio}`);
  };

  doc.fontSize(14).text('Detalle de Artículos solicitados:');
  doc.moveDown();
  
  // Usamos el formato que nuestro parser de regex suele entender:
  // "150 metro Cable IRAM Unipolar 2.5mm² $ 1950"
  doc.fontSize(11);
  drawRow('150', 'metro', 'Cable IRAM Unipolar 2.5mm²', '1950');
  drawRow('5', 'unidad', 'Disyuntor Termomagnético 16A', '19500');
  drawRow('8', 'caja', 'Guantes de Látex Talle M', '9200');
  drawRow('12', 'caja', 'Barbijo N95 / FFP2', '11500');
  drawRow('25', 'unidad', 'Tomacorriente Doble 2P+T', '5400');

  doc.moveDown(2);
  doc.text('Cotización válida por 15 días.', { align: 'center' });

  doc.end();
  console.log('PDF de prueba generado exitosamente');
}

generateTestPdf();
