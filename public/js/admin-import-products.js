// File: /public/js/admin-import-products.js
// Brief description: Adds preview-first product import tooling so admins can validate rows,
// duplicates, and media URLs before seeding products into the store. This pass adds a CSV-first
// workflow with a downloadable template and explicit required/optional field guidance.

document.addEventListener('DOMContentLoaded', () => {
  const mountEl = document.getElementById('productsAdminMount');
  if (!mountEl || !window.DDAuth || !window.DDAuth.isLoggedIn()) return;

  let rendered = false;
  const REQUIRED_FIELDS = ['name', 'product_type', 'price_cents'];
  const OPTIONAL_FIELDS = ['slug', 'status', 'currency', 'sku', 'short_description', 'description', 'compare_at_price_cents', 'taxable', 'tax_class_id', 'requires_shipping', 'weight_grams', 'inventory_tracking', 'inventory_quantity', 'digital_file_url', 'featured_image_url', 'sort_order'];

  function setMessage(message, isError = false) {
    const el = document.getElementById('adminImportProductsMessage');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    el.style.color = isError ? '#b00020' : '#0a7a2f';
  }

  function render() {
    if (rendered) return;
    rendered = true;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '18px';
    card.innerHTML = `
      <h3 style="margin-top:0">Finished Product Mass Upload</h3>
      <p class="small" style="margin-top:0">Use CSV or JSON. Images are optional during import and can be reviewed before a product is marked ready for the store.</p>
      <div id="adminImportProductsMessage" class="small" style="display:none;margin-bottom:12px"></div>
      <div class="grid cols-2" style="gap:14px;align-items:start">
        <div class="card">
          <h4 style="margin-top:0">CSV workflow</h4>
          <p class="small">Download the template, fill your rows, then upload the CSV here.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            <a class="btn" href="/public/products-import-template.csv" download>Download CSV template</a>
            <input id="adminImportProductsCsvFile" type="file" accept=".csv,text/csv" />
          </div>
          <div class="small"><strong>Required fields:</strong> ${REQUIRED_FIELDS.join(', ')}</div>
          <div class="small" style="margin-top:8px"><strong>Optional fields:</strong> ${OPTIONAL_FIELDS.join(', ')}</div>
          <div class="small" style="margin-top:8px">Image fields remain optional during import. You can add or require featured images later during product review.</div>
        </div>
        <div class="card">
          <h4 style="margin-top:0">JSON workflow</h4>
          <p class="small">Paste a JSON array if you are importing from a script or prior export.</p>
          <label class="small" for="adminImportProductsJson">Products JSON</label>
          <textarea id="adminImportProductsJson" rows="10" placeholder='[{"name":"Example Ring","slug":"example-ring","product_type":"physical","status":"draft","price_cents":4500,"inventory_tracking":1,"inventory_quantity":3}]'></textarea>
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <h4 style="margin-top:0">Normalized preview source</h4>
        <label class="small" for="adminImportProductsPreviewSource">Rows ready for preview/import</label>
        <textarea id="adminImportProductsPreviewSource" rows="10" placeholder="CSV upload will convert rows here as JSON."></textarea>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" type="button" id="adminPreviewProductImportButton">Preview Import</button>
        <button class="btn" type="button" id="adminRunProductImportButton">Run Import</button>
      </div>
      <div id="adminImportProductsPreview" class="small" style="margin-top:12px">No preview run yet.</div>`;
    mountEl.appendChild(card);
    document.getElementById('adminPreviewProductImportButton')?.addEventListener('click', previewImport);
    document.getElementById('adminRunProductImportButton')?.addEventListener('click', runImport);
    document.getElementById('adminImportProductsCsvFile')?.addEventListener('change', handleCsvFile);
  }

  function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values.map((value) => value.trim());
  }

  function maybeNumber(value) {
    if (value == null) return value;
    const text = String(value).trim();
    if (text === '') return '';
    if (/^-?\d+$/.test(text)) return Number(text);
    return value;
  }

  function csvToRows(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim());
    if (lines.length < 2) throw new Error('CSV must include a header row and at least one data row.');
    const headers = parseCsvLine(lines[0]).map((value) => String(value || '').trim());
    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = maybeNumber(values[index] ?? '');
      });
      return row;
    });
  }

  function setPreviewSource(rows) {
    const el = document.getElementById('adminImportProductsPreviewSource');
    if (el) el.value = JSON.stringify(rows, null, 2);
  }

  function parseRows() {
    const previewSource = document.getElementById('adminImportProductsPreviewSource')?.value || '';
    const rawJson = previewSource.trim() || document.getElementById('adminImportProductsJson')?.value || '[]';
    const rows = JSON.parse(rawJson);
    if (!Array.isArray(rows)) throw new Error('Import source must resolve to an array of rows.');
    return rows;
  }

  async function handleCsvFile(event) {
    try {
      const file = event.target?.files?.[0];
      if (!file) return;
      const text = await file.text();
      const rows = csvToRows(text);
      setPreviewSource(rows);
      setMessage(`Loaded ${rows.length} CSV row(s). Preview them before import.`);
    } catch (error) {
      setMessage(error.message || 'Failed to read CSV file.', true);
    }
  }

  async function previewImport() {
    try {
      setMessage('Running import preview...');
      const rows = parseRows();
      const response = await window.DDAuth.apiFetch('/api/admin/import-products-preview', { method: 'POST', body: JSON.stringify({ rows }) });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to preview import.');
      const previewEl = document.getElementById('adminImportProductsPreview');
      const previewRows = Array.isArray(data.preview) ? data.preview : [];
      previewEl.innerHTML = `
        <div><strong>${data.summary?.valid_rows || 0}</strong> valid row(s) • <strong>${data.summary?.invalid_rows || 0}</strong> invalid row(s)</div>
        <div class="admin-table-wrap" style="margin-top:12px">
          <table>
            <thead><tr><th>Row</th><th>Name</th><th>Slug</th><th>Status</th><th>Price</th><th>Image</th><th>Issues</th></tr></thead>
            <tbody>${previewRows.map((row) => `
              <tr>
                <td>${row.row_number}</td>
                <td>${row.normalized?.name || 'Unnamed'}</td>
                <td>${row.normalized?.slug || '—'}</td>
                <td><span class="status-chip">${row.valid ? 'Valid' : 'Needs review'}</span></td>
                <td>${row.normalized?.price_cents ?? '—'}</td>
                <td>${row.normalized?.featured_image_url ? 'Provided' : 'Optional / blank'}</td>
                <td>${row.issues?.length ? row.issues.join(' | ') : 'None'}</td>
              </tr>`).join('') || '<tr><td colspan="7">No rows to preview.</td></tr>'}</tbody>
          </table>
        </div>`;
      setMessage('Preview complete.');
    } catch (error) {
      setMessage(error.message || 'Failed to preview import.', true);
    }
  }

  async function runImport() {
    try {
      setMessage('Running import...');
      const rows = parseRows();
      const response = await window.DDAuth.apiFetch('/api/admin/import-products', { method: 'POST', body: JSON.stringify({ rows }) });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Failed to import products.');
      setMessage(`Import finished. Inserted ${data.inserted_count || 0} row(s).${data.error_count ? ` ${data.error_count} row(s) failed.` : ''}`);
      document.dispatchEvent(new CustomEvent('dd:product-updated', { detail: { inserted_count: data.inserted_count || 0 } }));
    } catch (error) {
      setMessage(error.message || 'Failed to import products.', true);
    }
  }

  document.addEventListener('dd:admin-ready', (event) => {
    if (!event?.detail?.ok) return;
    render();
  });

  render();
});
