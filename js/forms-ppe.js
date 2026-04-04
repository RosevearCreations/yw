/* File: js/forms-ppe.js
   Brief description: PPE Check form module.
   Handles roster rows, PPE compliance values, payload building, submit flow,
   and outbox fallback if the server or network is unavailable.
*/

'use strict';

(function () {
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function ensureTBody(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return null;

    let tbody = table.querySelector('tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      table.appendChild(tbody);
    }

    return tbody;
  }

  function yesNoSelect(className, value = '') {
    return `
      <select class="${className}">
        <option value="" ${value === '' ? 'selected' : ''}>—</option>
        <option value="yes" ${value === 'yes' ? 'selected' : ''}>Yes</option>
        <option value="no" ${value === 'no' ? 'selected' : ''}>No</option>
        <option value="na" ${value === 'na' ? 'selected' : ''}>N/A</option>
      </select>
    `;
  }


  function ensureLayout() {
    const section = document.getElementById('ppe');
    if (!section || section.dataset.layoutReady === '1') return;
    section.dataset.layoutReady = '1';
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>PPE Check</h2>
          <p class="section-subtitle">Daily PPE compliance roster for workers, visitors, and supervisors.</p>
        </div>
      </div>
      <form id="ppeForm">
        <div class="grid">
          <label>Site
            <input id="ppe_site" type="text" list="site-options" placeholder="Site name" required>
          </label>
          <label>Date
            <input id="ppe_date" type="date" required>
          </label>
          <label>Checked By
            <input id="ppe_checker" type="text" list="employee-options" placeholder="Inspector / checker" required>
          </label>
        </div>
        <div class="table-scroll" style="margin-top:14px;">
          <table id="ppeTable">
            <thead><tr><th>Name</th><th>Role</th><th>Shoes</th><th>Vest</th><th>Plugs</th><th>Goggles</th><th>Muffs</th><th>Gloves</th><th>Actions</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="form-footer" style="margin-top:10px;">
          <button id="ppeAddRowBtn" type="button" class="secondary">Add Row</button>
          <button type="submit">Submit PPE Check</button>
        </div>
      </form>
    `;
  }

  function createPPEForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    ensureLayout();

    const els = {
      form: $('#ppeForm'),
      site: $('#ppe_site'),
      date: $('#ppe_date'),
      checker: $('#ppe_checker'),
      tableBody: ensureTBody('ppeTable'),
      addRowBtn: $('#ppeAddRowBtn')
    };

    function addRow(values = {}) {
      if (!els.tableBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="ppe-name" list="employee-options" placeholder="Full name" value="${escHtml(values.name || '')}" required></td>
        <td>
          <select class="ppe-role">
            <option value="worker" ${values.role_on_site === 'worker' ? 'selected' : ''}>Worker</option>
            <option value="staff" ${values.role_on_site === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="site_leader" ${values.role_on_site === 'site_leader' ? 'selected' : ''}>Site Leader</option>
            <option value="supervisor" ${values.role_on_site === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="visitor" ${values.role_on_site === 'visitor' ? 'selected' : ''}>Visitor</option>
          </select>
        </td>
        <td>${yesNoSelect('ppe-shoes', values.shoes || '')}</td>
        <td>${yesNoSelect('ppe-vest', values.vest || '')}</td>
        <td>${yesNoSelect('ppe-plugs', values.plugs || '')}</td>
        <td>${yesNoSelect('ppe-goggles', values.goggles || '')}</td>
        <td>${yesNoSelect('ppe-muffs', values.muffs || '')}</td>
        <td>${yesNoSelect('ppe-gloves', values.gloves || '')}</td>
        <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
      `;
      els.tableBody.appendChild(tr);
    }

    function seed() {
      if (els.date && !els.date.value) {
        els.date.value = todayISO();
      }

      if (els.tableBody && els.tableBody.children.length === 0) {
        addRow();
        addRow();
      }
    }

    function resetForm() {
      els.form?.reset();

      if (els.date) {
        els.date.value = todayISO();
      }

      if (els.tableBody) {
        els.tableBody.innerHTML = '';
        seed();
      }
    }

    function collectPayload() {
      const site = els.site?.value?.trim?.() || '';
      const date = els.date?.value || '';
      const checker = els.checker?.value?.trim?.() || '';

      if (!site || !date || !checker) {
        throw new Error('Please fill Site, Date, and Checked By.');
      }

      const roster = els.tableBody
        ? Array.from(els.tableBody.querySelectorAll('tr')).map((tr) => {
            const name = tr.querySelector('.ppe-name')?.value?.trim?.() || '';
            const role = tr.querySelector('.ppe-role')?.value || 'worker';
            const shoes = tr.querySelector('.ppe-shoes')?.value || '';
            const vest = tr.querySelector('.ppe-vest')?.value || '';
            const plugs = tr.querySelector('.ppe-plugs')?.value || '';
            const goggles = tr.querySelector('.ppe-goggles')?.value || '';
            const muffs = tr.querySelector('.ppe-muffs')?.value || '';
            const gloves = tr.querySelector('.ppe-gloves')?.value || '';

            return {
              name,
              role_on_site: role,
              shoes,
              vest,
              plugs,
              goggles,
              muffs,
              gloves
            };
          }).filter((r) => r.name)
        : [];

      if (!roster.length) {
        throw new Error('Please add at least one worker.');
      }

      return {
        site,
        date,
        checked_by: checker,
        roster
      };
    }

    async function submit(e) {
      e.preventDefault();

      let payload;
      try {
        payload = collectPayload();
      } catch (err) {
        alert(err.message || 'Please complete the form.');
        return;
      }

      try {
        await sendToFunction('D', payload);
        alert('PPE Check submitted.');
        resetForm();
      } catch (err) {
        console.error(err);

        const outbox = getOutbox();
        outbox.push({
          ts: Date.now(),
          formType: 'D',
          payload,
          localImages: []
        });
        setOutbox(outbox);

        alert('Offline/server error. Saved to Outbox.');
      }
    }

    function bindEvents() {
      els.addRowBtn?.addEventListener('click', () => addRow());

      els.tableBody?.addEventListener('click', (e) => {
        const btn = (e.target instanceof Element) ? e.target.closest('button') : null;
        if (!btn) return;

        if (btn.dataset.act === 'remove') {
          btn.closest('tr')?.remove();
        }
      });

      els.form?.addEventListener('submit', submit);
    }

    async function init() {
      seed();
      bindEvents();
    }

    return {
      init,
      seed,
      resetForm,
      collectPayload
    };
  }

  window.YWIFormsPPE = {
    create: createPPEForm
  };
})();
