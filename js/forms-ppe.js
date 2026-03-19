'use strict';

/* =========================================================
   js/forms-ppe.js
   PPE Check form module

   Purpose:
   - move PPE Check form logic out of app.js
   - manage roster rows
   - submit form D payload
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

  function createPPEForm(config = {}) {
    const sendToFunction = config.sendToFunction;
    const getOutbox = config.getOutbox;
    const setOutbox = config.setOutbox;

    const els = {
      form: $('#ppeForm'),
      site: $('#ppe_site'),
      date: $('#ppe_date'),
      checker: $('#ppe_checker'),
      tableBody: ensureTBody('ppeTable'),
      addRowBtn: $('#ppeAddRowBtn')
    };

    function addRow() {
      if (!els.tableBody) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="ppe-name" placeholder="Full name" required></td>
        <td>
          <select class="ppe-role">
            <option value="worker">Worker</option>
            <option value="staff">Staff</option>
            <option value="site_leader">Site Leader</option>
            <option value="supervisor">Supervisor</option>
            <option value="visitor">Visitor</option>
          </select>
        </td>
        <td style="text-align:center"><input type="checkbox" class="ppe-shoes" checked></td>
        <td style="text-align:center"><input type="checkbox" class="ppe-vest" checked></td>
        <td style="text-align:center"><input type="checkbox" class="ppe-plugs" checked></td>
        <td style="text-align:center"><input type="checkbox" class="ppe-goggles" checked></td>
        <td style="text-align:center"><input type="checkbox" class="ppe-muffs" checked></td>
        <td style="text-align:center"><input type="checkbox" class="ppe-gloves" checked></td>
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

      const roster = rows.map((tr) => ({
        name: tr.querySelector('.ppe-name')?.value?.trim?.() || '',
        role_on_site: tr.querySelector('.ppe-role')?.value || 'worker',
        items: {
          shoes: !!tr.querySelector('.ppe-shoes')?.checked,
          vest: !!tr.querySelector('.ppe-vest')?.checked,
          plugs: !!tr.querySelector('.ppe-plugs')?.checked,
          goggles: !!tr.querySelector('.ppe-goggles')?.checked,
          muffs: !!tr.querySelector('.ppe-muffs')?.checked,
          gloves: !!tr.querySelector('.ppe-gloves')?.checked
        }
      })).filter((r) => r.name);

      const nonCompliant = roster.some((r) =>
        !r.items.shoes ||
        !r.items.vest ||
        !r.items.plugs ||
        !r.items.goggles ||
        !r.items.muffs ||
        !r.items.gloves
      );

      return {
        site,
        date,
        checked_by: checker,
        roster,
        nonCompliant
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
        alert('PPE check submitted.');
        resetForm();
      } catch (err) {
        console.error(err);

        const outbox = getOutbox();
        outbox.push({
          ts: Date.now(),
          formType: 'D',
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

  window.YWIFormsPPE = {
    create: createPPEForm
  };
})();
