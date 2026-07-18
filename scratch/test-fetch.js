const fetch = require('node-fetch');

async function testRoute() {
  const url = 'https://uintegrus.com/api/test-db';
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testRoute();
