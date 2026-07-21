const fs = require('fs');
const path = require('path');
const { ipcRenderer, shell, remote } = require('electron');
const XLSX = require('xlsx');
const QRCode = require('qrcode');

const fileInput = document.getElementById('fileInput');
const previewBtn = document.getElementById('previewBtn');
const mappingSection = document.getElementById('mappingSection');
const mappingsDiv = document.getElementById('mappings');
const generateBtn = document.getElementById('generateBtn');
const selectOut = document.getElementById('selectOut');
const outFolderSpan = document.getElementById('outFolder');
const progressSection = document.getElementById('progressSection');
const logEl = document.getElementById('log');

let workbook = null;
let sheetData = null;
let outputDir = null;
let headers = [];

function log(msg) {
  logEl.textContent += msg + "\n";
}

selectOut.addEventListener('click', async () => {
  const dir = await ipcRenderer.invoke('select-output-dir');
  if (dir) {
    outputDir = dir;
    outFolderSpan.textContent = outputDir;
  }
});

previewBtn.addEventListener('click', () => {
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Vyberte .xlsx soubor');
    return;
  }
  const f = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    sheetData = json;
    if (json.length === 0) {
      alert('Žádná data v Excelu');
      return;
    }

    headers = Object.keys(json[0]);
    renderMappingUI(headers);
    mappingSection.style.display = 'block';
  };
  reader.readAsArrayBuffer(f);
});

function renderMappingUI(headers) {
  mappingsDiv.innerHTML = '';
  const suggested = {
    account: guessHeader(headers, ['account', 'iban', 'acc', 'účet', 'ucet', 'iban'] ),
    vs: guessHeader(headers, ['vs', 'variable symbol', 'variabilni symbol', 'variable_symbol'] ),
    amount: guessHeader(headers, ['amount', 'castka', 'price', 'sum'] ),
    currency: guessHeader(headers, ['currency', 'mena', 'cc'] ),
    message: guessHeader(headers, ['message', 'msg', 'note', 'zprava'] ),
    name: guessHeader(headers, ['name', 'recipient', 'nazev'] ),
  };

  for (const key of Object.keys(suggested)) {
    const div = document.createElement('div');
    div.innerHTML = `<label>${key}: <select id="map_${key}"></select></label>`;
    mappingsDiv.appendChild(div);
    const sel = div.querySelector('select');
    const noneOpt = document.createElement('option'); noneOpt.value=''; noneOpt.textContent='(žádný)'; sel.appendChild(noneOpt);
    headers.forEach(h => {
      const opt = document.createElement('option'); opt.value = h; opt.textContent = h; sel.appendChild(opt);
    });
    if (suggested[key]) sel.value = suggested[key];
  }
}

function guessHeader(headers, candidates) {
  const lower = headers.map(h => h.toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i !== -1) return headers[i];
  }
  return null;
}

generateBtn.addEventListener('click', async () => {
  if (!sheetData || sheetData.length === 0) {
    alert('Nejsou načtená data');
    return;
  }
  if (!outputDir) {
    alert('Vyberte výstupní složku');
    return;
  }

  const map = {
    account: document.getElementById('map_account').value,
    vs: document.getElementById('map_vs').value,
    amount: document.getElementById('map_amount').value,
    currency: document.getElementById('map_currency').value,
    message: document.getElementById('map_message').value,
    name: document.getElementById('map_name').value,
  };

  progressSection.style.display = 'block';
  logEl.textContent = '';

  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    const account = (map.account && row[map.account]) ? String(row[map.account]).trim() : '';
    const vs = (map.vs && row[map.vs]) ? String(row[map.vs]).trim() : '';
    const amount = (map.amount && row[map.amount]) ? String(row[map.amount]).trim() : '';
    const currency = (map.currency && row[map.currency]) ? String(row[map.currency]).trim() : 'CZK';
    const message = (map.message && row[map.message]) ? String(row[map.message]).trim() : '';
    const name = (map.name && row[map.name]) ? String(row[map.name]).trim() : '';

    // Build SPD string (minimal)
    // Format: SPD*1.0*ACC:IBAN*AM:123.45*CC:CZK*X-VS:12345*MSG:Text
    let spd = 'SPD*1.0';
    if (account) spd += `*ACC:${account}`;
    if (amount) spd += `*AM:${amount}`;
    if (currency) spd += `*CC:${currency}`;
    if (vs) spd += `*X-VS:${vs}`;
    if (name) spd += `*RN:${escapeSep(name)}`;
    if (message) spd += `*MSG:${escapeSep(message)}`;

    const filenameBase = vs || (`row_${i+1}`);
    const outPath = path.join(outputDir, `${filenameBase}.png`);

    try {
      await QRCode.toFile(outPath, spd, { errorCorrectionLevel: 'H', type: 'png', width: 400 });
      log(`OK: ${outPath}`);
    } catch (err) {
      log(`ERROR: ${outPath} -> ${err.message}`);
    }
  }

  log('Hotovo.');
  ipcRenderer.invoke('show-message-box', { message: 'Generování dokončeno', buttons: ['OK'] });
});

function escapeSep(s) {
  // remove asterisk and a few illegal chars to be safe
  return String(s).replace(/\*/g, '').replace(/\^/g, '');
}
