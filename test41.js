const mindee = require('mindee');
const fs = require('fs');

async function test() {
  const client = new mindee.Client({ apiKey: 'md_KM2S7lP1Nt9pFEb4ZeQY0OXWmOA0c8_0g4m1GW3Fqec' });
  const inputSource = new mindee.PathInput({ inputPath: 'test.png' });
  try {
    const res = await client.enqueueAndGetResult(mindee.product.Extraction, inputSource, { modelId: '8ce28e2f-df16-48a9-a805-bba38150f597' });
    const doc = res.document || res.inference?.document || res;
    const pred = doc?.inference?.prediction || doc?.prediction || {};
    console.log(JSON.stringify(pred.fields || pred, null, 2));
  } catch(e) {
    console.log('Error:', e.message);
  }
}
test();
