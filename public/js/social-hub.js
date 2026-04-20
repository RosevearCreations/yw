document.addEventListener('DOMContentLoaded', async () => {
  const profileGrid = document.getElementById('socialProfileGrid');
  const youtubeGrid = document.getElementById('socialYoutubeGrid');
  const messageEl = document.getElementById('socialHubMessage');
  const notesEl = document.getElementById('socialFeedNotes');
  const SNAPSHOT_KEY = 'dd_social_hub_snapshot_v3';

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setMessage(message, tone = 'success') {
    if (!messageEl) return;
    messageEl.textContent = message || '';
    messageEl.style.display = message ? 'block' : 'none';
    messageEl.className = 'status-note' + (message ? ` ${tone}` : '');
  }

  function saveSnapshot(payload) {
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload)); } catch {}
  }

  function loadSnapshot() {
    try { return JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null'); } catch { return null; }
  }

  function rotateThumbnail(event) {
    const img = event?.target;
    if (!img) return;
    const candidates = String(img.getAttribute('data-thumbnail-candidates') || '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
    const nextIndex = Number(img.getAttribute('data-thumbnail-index') || 0) + 1;
    const nextUrl = candidates[nextIndex] || '';
    if (nextUrl) {
      img.setAttribute('data-thumbnail-index', String(nextIndex));
      img.src = nextUrl;
      return;
    }
    img.onerror = null;
    img.style.display = 'none';
    const fallback = img.closest('[data-youtube-card]')?.querySelector('[data-youtube-fallback]');
    if (fallback) fallback.style.display = 'flex';
  }

  function renderProfiles(data) {
    const profiles = data?.profiles || {};
    const profileKeys = ['youtube', 'instagram', 'tiktok', 'facebook', 'x', 'patreon'];
    if (!profileGrid) return;
    profileGrid.innerHTML = profileKeys.map((key) => {
      const row = profiles[key] || {};
      return `<a class="card" href="${esc(row.url || '#')}" target="_blank" rel="noopener"><strong>${esc(row.label || key)}</strong><div class="small" style="margin-top:8px">${esc(row.handle || row.url || '')}</div></a>`;
    }).join('');
  }

  function renderVideos(data) {
    const videos = Array.isArray(data?.youtube_videos) ? data.youtube_videos : [];
    if (!youtubeGrid) return;
    youtubeGrid.innerHTML = videos.map((row) => {
      const fallbackCandidates = Array.isArray(row.thumbnail_candidates) ? row.thumbnail_candidates.filter(Boolean) : [];
      const thumbnailCandidates = fallbackCandidates.length
        ? fallbackCandidates
        : (row.thumbnail_url ? [row.thumbnail_url] : []);
      const primaryThumbnail = row.thumbnail_url || thumbnailCandidates[0] || '';
      const badge = esc(row.kind || 'Video');
      return `<article class="card" data-youtube-card>
        <a href="${esc(row.url || '#')}" target="_blank" rel="noopener" style="display:block;text-decoration:none;color:inherit">
          <div style="position:relative;border-radius:12px;overflow:hidden;background:#111827;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center">
            ${primaryThumbnail ? `<img src="${esc(primaryThumbnail)}" alt="${esc(row.title || 'Devil n Dove video thumbnail')}" loading="lazy" data-youtube-thumbnail data-thumbnail-index="0" data-thumbnail-candidates="${esc(thumbnailCandidates.join('|'))}" style="width:100%;height:100%;object-fit:cover;display:block">` : ''}
            <div data-youtube-fallback class="small" style="${primaryThumbnail ? 'display:none;' : 'display:flex;'}position:absolute;inset:0;align-items:center;justify-content:center;padding:16px;text-align:center;background:linear-gradient(135deg, rgba(17,24,39,.95), rgba(55,65,81,.95));color:#fff">Thumbnail unavailable right now.<br/>Open on YouTube</div>
            <div style="position:absolute;left:10px;top:10px;background:rgba(17,24,39,.84);color:#fff;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700">${badge}</div>
          </div>
        </a>
        <h3 style="margin:12px 0 6px 0;font-size:1.05rem">${esc(row.title || '')}</h3>
        <div class="small">${badge} · YouTube</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn" href="${esc(row.url || '#')}" target="_blank" rel="noopener">Watch on YouTube</a>
          ${row.embed_url ? `<a class="btn" href="${esc(row.embed_url)}" target="_blank" rel="noopener">Open embed</a>` : ''}
        </div>
      </article>`;
    }).join('') || '<div class="small">No YouTube videos are listed yet.</div>';

    youtubeGrid.querySelectorAll('[data-youtube-thumbnail]').forEach((img) => {
      img.addEventListener('error', rotateThumbnail);
    });
  }

  function renderFeed(data) {
    renderProfiles(data);
    renderVideos(data);
    if (notesEl) {
      const notes = data?.feed_notes || {};
      notesEl.textContent = [notes.youtube, notes.instagram, notes.tiktok, notes.x].filter(Boolean).join(' ') || 'Feed notes are not available right now.';
    }
  }

  try {
    const response = await fetch('/api/social-feed', { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Could not load the social hub feed.');
    renderFeed(data);
    saveSnapshot({ data, cached_at: new Date().toISOString() });

    if (data?.warning) setMessage(data.warning, 'warning');
    else setMessage(`Social hub updated from ${data?.updated_at || 'the latest saved feed file'}.`, 'success');
  } catch (error) {
    const cached = loadSnapshot();
    if (cached?.data) {
      renderFeed(cached.data);
      setMessage(`Live social feed is unavailable. Showing the last saved snapshot from ${cached.cached_at || 'an earlier visit'}.`, 'warning');
      return;
    }
    setMessage(error.message || 'Could not load the social hub feed.', 'error');
    if (profileGrid) profileGrid.innerHTML = '<div class="small">Social profiles are unavailable right now.</div>';
    if (youtubeGrid) youtubeGrid.innerHTML = '<div class="small">YouTube videos are unavailable right now.</div>';
    if (notesEl) notesEl.textContent = 'Feed notes are unavailable right now.';
  }
});
