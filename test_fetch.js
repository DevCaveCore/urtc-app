const API_KEY = "ydaGQPxfpA94dNZ05GRNur8vzCofygmn";
async function run() {
  const q = "DL1182";
  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${q}`;
  const response = await fetch(url, { headers: { 'x-apikey': API_KEY } });
  const data = await response.json();
  console.log("Returned flights:", (data.flights || []).length);
}
run();
