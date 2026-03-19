'use strict';

/* =========================================================
   js/forms-firstaid.js
   First Aid Kit Daily Check form module

   Purpose:
   - move First Aid Kit form logic out of app.js
   - manage item rows
   - calculate flagged state
   - submit form B payload
   - save failed submissions to outbox
========================================================= */

(function () {
  function $(sel, root = document) {
    return root.querySelector(sel);
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

  function within30Days(iso) {
    if (!iso) return false;
    const now = new Date();
    const d = new Date(iso);
    return ((d.getTime() - now.getTime()) / 86400000) <= 30;
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

    function addRow() {
      if (!els.tableBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="fa-name" list="fa-catalog" placeholder="Select or type…" required></td>
        <td><input type="number" class="fa-qty" min="0" value="0"></td>
        <td><input type="number" class="fa-min" min="0" value="0"></td>
        <td><input type="date" class="fa-exp"></td>
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

      const rows = els.tableBody
        ? Array.from(els.tableBody.querySelectorAll('tr'))
        : [];

      const items = rows.map((tr) => {
        const name = tr.querySelector('.fa-name')?.value?.trim?.() || '';
        const qty = parseInt(tr.querySelector('.fa-qty')?.value || '0', 10);
        const min = parseInt(tr.querySelector('.fa-min')?.value || '0', 10);
        const exp = tr.querySelector('.fa-exp')?.value || null;

        return {
          name,
          quantity: qty,
          min,
          expiry: exp
        };
      }).filter((i) => i.name);

      const flagged = items.some((i) =>
        (i.quantity <= (i.min || 0)) ||
        (i.expiry && (within30Days(i.expiry) || (new Date(i.expiry) < new Date())))
      );

      return {
        site,
        date,
        checked_by: checker,
        items,
        flagged
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
        alert('First aid check submitted.');
        resetForm();
      } catch (err) {
        console.error(err);

        const outbox = getOutbox();
        outbox.push({
          ts: Date.now(),
          formType: 'B',
          payload
        });
        setOutbox(outbox);

        alert('Offline/server error. Saved to Outbox.');
      }
    }

    function bindEvents() {
      els.addRowBtn?.addEventListener('click', addRow);

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
