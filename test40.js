const mindee = require('mindee');
const { PDFDocument } = require('pdf-lib');

async function test() {
  const client = new mindee.Client({ apiKey: 'md_KM2S7lP1Nt9pFEb4ZeQY0OXWmOA0c8_0g4m1GW3Fqec' });
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  page.drawText('Invoice Date: 2023-01-01\nTotal: 100.00\nSupplier: Acme Corp\nInvoice Number: F001-123\nRUC: 20123456789\nDescription: Nails\nQuantity: 10\nUnit Price: 5.00\nTotal Amount: 50.00', { x: 50, y: 700, size: 20 });
  const pdfBytes = await pdfDoc.save();
  const inputSource = new mindee.BytesInput({ inputBytes: Buffer.from(pdfBytes), filename: 'test.pdf' });
  try {
    const res = await client.enqueueAndGetResult(mindee.product.Extraction, inputSource, { modelId: '8ce28e2f-df16-48a9-a805-bba38150f597' });
    const doc = res.document || res.inference?.document || res;
    const pred = doc?.inference?.prediction || doc?.prediction || {};
    console.log('success!', JSON.stringify(pred.fields || pred, null, 2));
  } catch(e) {
    console.log('Error:', e.message);
  }
}
test();
