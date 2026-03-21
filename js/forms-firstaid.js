/* File: js/forms-firstaid.js
   Brief description: First Aid Kit Check form module.
   Handles inventory rows, quantity/minimum/expiry tracking, payload building, submit flow,
   and outbox fallback when the server or network is unavailable.
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

  function daysUntil(dateString) {
    if (!dateString) return null;

    const target = new Date(dateString);
    if (Number.isNaN(target.getTime())) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiry = new Date(target.getFullYear(), target.getMonth(), target.getDate());

    return Math.round((expiry - today) / 86400000);
  }

  function createFirstAidForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    const els = {
      form: $('#faForm'),
      site: $('#fa_site'),
      date: $('#fa_date'),
      checker: $('#fa_checker'),
      tableBody: ensureTBody('faTable'),
      addRowBtn: $('#faAddRowBtn')
    };

    function addRow(values = {}) {
      if (!els.tableBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <input
            type="text"
            class="fa-item"
            list="fa-catalog"
            placeholder="Item name"
            value="${escHtml(values.item_name || '')}"
            required
          >
        </td>
        <td><input type="number" class="fa-qty" min="0" step="1" value="${escHtml(values.quantity ?? '')}"></td>
        <td><input type="number" class="fa-min" min="0" step="1" value="${escHtml(values.minimum_stock ?? '')}"></td>
        <td><input type="date" class="fa-expiry" value="${escHtml(values.expiry_date || '')}"></td>
        <td><div class="controls"><button type="button" data-act="remove">Remove</button></div></td>
      `;
      els.tableBody.appendChild(tr);
    }

    function seed() {
      if (els.date && !els.date.value) {
        els.date.value = todayISO();
      }

      if (els.tableBody && els.tableBody.children.length === 0) {
        addRow({ item_name: 'Guidance Card', quantity: 1, minimum_stock: 1 });
        addRow({ item_name: 'Plastic Band Aid', quantity: 0, minimum_stock: 10 });
        addRow({ item_name: 'Adhesive Tapes', quantity: 0, minimum_stock: 2 });
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

      const items = els.tableBody
        ? Array.from(els.tableBody.querySelectorAll('tr')).map((tr) => {
            const item_name = tr.querySelector('.fa-item')?.value?.trim?.() || '';
            const quantity = Number(tr.querySelector('.fa-qty')?.value || 0);
            const minimum_stock = Number(tr.querySelector('.fa-min')?.value || 0);
            const expiry_date = tr.querySelector('.fa-expiry')?.value || '';

            const low_stock = quantity <= minimum_stock;
            const expiry_in_days = daysUntil(expiry_date);
            const expiry_soon = expiry_in_days !== null && expiry_in_days <= 30;

            return {
              item_name,
              quantity,
              minimum_stock,
              expiry_date: expiry_date || null,
              low_stock,
              expiry_soon
            };
          }).filter((r) => r.item_name)
        : [];

      if (!items.length) {
        throw new Error('Please add at least one kit item.');
      }

      return {
        site,
        date,
        checked_by: checker,
        items
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
        await sendToFunction('B', payload);
        alert('First Aid Check submitted.');
        resetForm();
      } catch (err) {
        console.error(err);

        const outbox = getOutbox();
        outbox.push({
          ts: Date.now(),
          formType: 'B',
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

  window.YWIFormsFirstAid = {
    create: createFirstAidForm
  };
})();
