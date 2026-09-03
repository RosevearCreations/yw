/* File: js/equipment-scanner.js
   Build 185 Jobs-owned equipment scanning adapter.
   Uses BarcodeDetector + getUserMedia when supported and permanently preserves manual entry.
   Camera/manual results are untrusted until equipment-scan-manage resolves the exact identifier.
*/

'use strict';

(function () {
  const BUILD = '2026-09-02q';
  const FUNCTION_NAME = 'equipment-scan-manage';
  const ACTION = 'equipment_scan_event';
  const BUTTON_SELECTOR = '#eq_scan_code';
  const OVERLAY_ID = 'ywi_equipment_scanner_overlay';
  const DESIRED_FORMATS = [
    'qr_code','code_128','code_39','code_93','codabar','ean_13','ean_8',
    'upc_a','upc_e','itf','data_matrix','aztec','pdf417'
  ];

  let activeController = null;

  function api() { return window.YWIAPI || null; }
  function byId(id) { return document.getElementById(id); }
  function clean(value) { return String(value ?? '').trim(); }
  function makeRequestId() {
    return `equipment-scan-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }

  function setNotice(message, isError = false) {
    const target = byId('eq_summary');
    if (target) {
      target.textContent = String(message || '');
      target.style.display = message ? 'block' : 'none';
      target.dataset.scanStatus = isError ? 'error' : 'ok';
      target.classList.toggle('error', !!isError);
      return;
    }
    if (message && isError) console.warn(message);
  }

  function setInputValue(id, value) {
    const input = byId(id);
    if (!input || value === undefined || value === null) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function applyTrustedResolution(rawValue, response) {
    const resolution = response?.resolution || {};
    const status = clean(resolution.status);
    const equipmentCode = clean(resolution.equipment_code);
    const equipmentName = clean(resolution.equipment_name);
    const identifierKind = clean(resolution.identifier_kind);

    if (status !== 'resolved') {
      if (status === 'ambiguous') {
        setNotice(`Scan blocked: “${rawValue}” matches more than one equipment identity. Nothing was selected; I.T./Jobs review is required.`, true);
      } else if (status === 'master_only') {
        setNotice(`Canonical equipment “${equipmentCode || rawValue}” exists, but no physical Jobs equipment item is linked. Nothing was selected.`, true);
      } else if (status === 'inconsistent') {
        setNotice(`Scan blocked: the identifier registry and canonical equipment identity disagree for “${rawValue}”. Nothing was selected.`, true);
      } else {
        setNotice(`No exact equipment match for “${rawValue}”. The raw camera/manual value was recorded as needs-review evidence but was not trusted into the equipment form.`, true);
      }
      return false;
    }

    // Only server-resolved data is allowed to populate trusted equipment form fields.
    if (equipmentCode) setInputValue('eq_code', equipmentCode);
    if (equipmentName && !clean(byId('eq_name')?.value)) setInputValue('eq_name', equipmentName);

    if (identifierKind === 'qr_code_value') setInputValue('eq_qr_code_value', rawValue);
    if (identifierKind === 'barcode_value') setInputValue('eq_barcode_value', rawValue);
    if (identifierKind === 'asset_tag') setInputValue('eq_asset_tag', rawValue);
    if (identifierKind === 'serial_number') setInputValue('eq_serial', rawValue);

    const replayText = response?.replayed ? ' Idempotent replay: no duplicate custody row was created.' : '';
    setNotice(`Resolved ${identifierKind.replaceAll('_',' ') || 'equipment identifier'} → ${equipmentCode}${equipmentName ? ` — ${equipmentName}` : ''}.${replayText}`);
    document.dispatchEvent(new CustomEvent('ywi:equipment-scan-resolved', {
      detail:{ build:BUILD, rawValue, resolution, scan:response?.scan || null, custody:response?.custody || null, replayed:!!response?.replayed }
    }));
    return true;
  }

  async function submitUntrustedScan(rawValue, source, detectedFormat = '') {
    const value = clean(rawValue);
    if (!value) return null;
    const client = api();
    if (!client?.jsonFetch) throw new Error('The protected YWI API client is not available.');

    const idempotencyKey = makeRequestId();
    setNotice(`Resolving ${source === 'camera_barcode_detector' ? 'camera scan' : 'manual entry'} on the protected Jobs server…`);
    const response = await client.jsonFetch(FUNCTION_NAME, {
      method:'POST',
      requireAuth:true,
      headers:{ 'x-idempotency-key':idempotencyKey },
      body:{
        action:ACTION,
        scan_code:value,
        equipment_reference:value,
        scan_source:source,
        scan_stage:'field_check',
        custody_stage:'field_check',
        idempotency_key:idempotencyKey,
        notes:detectedFormat ? `Jobs equipment camera scan format: ${detectedFormat}` : 'Jobs equipment manual scan fallback.',
      }
    });
    if (!response?.ok) throw new Error(response?.error || 'Equipment scan resolution failed.');
    applyTrustedResolution(value,response);
    return response;
  }

  async function manualFallback(reason = '') {
    if (reason) setNotice(`${reason} Manual entry remains available.`, false);
    const manual = window.prompt('Enter the equipment QR, barcode, asset tag, serial number, or equipment code:');
    const value = clean(manual);
    if (!value) return null;
    try {
      return await submitUntrustedScan(value,'manual','');
    } catch (error) {
      setNotice(error?.message || 'Manual equipment scan failed.', true);
      return null;
    }
  }

  function removeOverlay() {
    byId(OVERLAY_ID)?.remove();
  }

  function stopController(controller = activeController) {
    if (!controller) return;
    controller.stopped = true;
    try { controller.stream?.getTracks?.().forEach((track) => track.stop()); } catch {}
    if (controller.raf) cancelAnimationFrame(controller.raf);
    if (activeController === controller) activeController = null;
    removeOverlay();
  }

  function createOverlay() {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Equipment barcode or QR scanner');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="width:min(680px,100%);max-height:92vh;overflow:auto;background:#fff;color:#111;border-radius:14px;padding:16px;box-shadow:0 18px 55px rgba(0,0,0,.45);">
        <div style="display:flex;gap:12px;align-items:start;justify-content:space-between;">
          <div>
            <h3 style="margin:0 0 6px;">Scan equipment QR / barcode</h3>
            <p style="margin:0 0 12px;">Point the rear camera at the label. The camera result is not trusted until the protected Jobs server resolves it.</p>
          </div>
          <button type="button" data-scan-close aria-label="Close equipment scanner">Close</button>
        </div>
        <video data-scan-video playsinline muted style="display:block;width:100%;max-height:62vh;object-fit:contain;background:#111;border-radius:10px;"></video>
        <p data-scan-status role="status" aria-live="polite" style="margin:10px 0;">Starting camera…</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <button type="button" data-scan-manual>Enter code manually</button>
          <button type="button" data-scan-cancel>Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  async function supportedDetectorFormats() {
    if (!('BarcodeDetector' in window)) return [];
    try {
      if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        return DESIRED_FORMATS.filter((format) => supported.includes(format));
      }
    } catch {}
    return DESIRED_FORMATS;
  }

  async function cameraScan() {
    if (!window.isSecureContext) return manualFallback('Camera scanning requires a secure HTTPS page.');
    if (!navigator.mediaDevices?.getUserMedia) return manualFallback('This browser does not provide camera access.');
    if (!('BarcodeDetector' in window)) return manualFallback('This browser does not support BarcodeDetector.');

    const formats = await supportedDetectorFormats();
    if (!formats.length) return manualFallback('No supported QR/barcode formats were reported by this browser.');

    const overlay = createOverlay();
    const video = overlay.querySelector('[data-scan-video]');
    const status = overlay.querySelector('[data-scan-status]');
    const controller = { stopped:false, stream:null, raf:0 };
    activeController = controller;

    const close = () => stopController(controller);
    overlay.querySelector('[data-scan-close]')?.addEventListener('click',close);
    overlay.querySelector('[data-scan-cancel]')?.addEventListener('click',close);
    overlay.addEventListener('click',(event) => { if (event.target === overlay) close(); });
    overlay.querySelector('[data-scan-manual]')?.addEventListener('click',async () => {
      stopController(controller);
      await manualFallback('Camera scan switched to manual entry.');
    });

    try {
      controller.stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 }, height:{ ideal:720 } },
        audio:false,
      });
      video.srcObject = controller.stream;
      await video.play();
      status.textContent = 'Camera ready — hold the label steady inside the view.';

      const detector = new window.BarcodeDetector({ formats });
      let lastDetectAt = 0;
      const detectFrame = async (timestamp) => {
        if (controller.stopped) return;
        if (timestamp - lastDetectAt < 160) {
          controller.raf = requestAnimationFrame(detectFrame);
          return;
        }
        lastDetectAt = timestamp;
        try {
          const codes = await detector.detect(video);
          const detected = codes?.find((entry) => clean(entry?.rawValue));
          if (detected) {
            const rawValue = clean(detected.rawValue);
            const format = clean(detected.format);
            status.textContent = `Detected ${format || 'code'}; verifying with Jobs…`;
            stopController(controller);
            try {
              await submitUntrustedScan(rawValue,'camera_barcode_detector',format);
            } catch (error) {
              setNotice(error?.message || 'Camera equipment scan failed.', true);
            }
            return;
          }
        } catch (error) {
          status.textContent = `Camera detector error: ${error?.message || 'unable to read label'}. Manual entry is still available.`;
        }
        controller.raf = requestAnimationFrame(detectFrame);
      };
      controller.raf = requestAnimationFrame(detectFrame);
      return null;
    } catch (error) {
      stopController(controller);
      return manualFallback(`Camera could not start${error?.message ? `: ${error.message}` : ''}.`);
    }
  }

  async function beginScan() {
    if (activeController) stopController(activeController);
    try {
      await cameraScan();
    } catch (error) {
      setNotice(error?.message || 'Equipment scanner failed.', true);
      await manualFallback('Camera scanning failed.');
    }
  }

  function interceptExistingScanButton(event) {
    const button = event.target?.closest?.(BUTTON_SELECTOR);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    beginScan();
  }

  // Capture phase intentionally precedes jobs-ui's legacy prompt handler. If this add-on
  // fails to load, the legacy handler remains a permanent manual fallback instead.
  document.addEventListener('click',interceptExistingScanButton,true);
  document.addEventListener('ywi:module-runtime-purge',() => stopController(activeController));
  window.addEventListener('pagehide',() => stopController(activeController));

  window.YWIEquipmentScanner = Object.freeze({ BUILD, beginScan, manualFallback, submitUntrustedScan });
})();
