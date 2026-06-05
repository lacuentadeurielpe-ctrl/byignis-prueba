const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

async function test() {
  const data = new FormData();
  data.append('document', fs.createReadStream('test.png'));
  try {
    const res = await fetch('https://api.mindee.net/v1/products/uriel_uriels_organization/invoice/v1/predict', {
      method: 'POST',
      headers: {
        'Authorization': 'Token md_KM2S7lP1Nt9pFEb4ZeQY0OXWmOA0c8_0g4m1GW3Fqec'
      },
      body: data
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch(e) {
    console.log('Error:', e.message);
  }
}
test();
