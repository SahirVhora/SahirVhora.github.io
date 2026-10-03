'use strict';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const KEY = 'observatory-v1';
function stored() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
const initial = stored();
let state = { saved: initial.saved || {}, read: initial.read || {}, notes: initial.notes || {}, theme: initial.theme || 'dark', lastVisit: initial.lastVisit || null };
const previousVisit = state.lastVisit;
let edition = null, view = 'today', topic = 'all', deferredInstall, activeStory, bridgeIndex = 0;
const categories = {ai: 'AI', physics: 'Physics', consulting: 'Consulting'};
const labels = {ai: '01 / THE EDGE', physics: '02 / THE WONDER', consulting: '03 / THE PERSPECTIVE'};
const prompts = {
  ai: {question: 'What would you test before trusting this on a real task?', caveat: 'A release or company claim is not independent evidence of performance. Check availability, evaluation conditions, and limitations.'},
  physics: {question: 'What was observed, and which explanation does that observation support?', caveat: 'Distinguish an experiment from a theory, a profile, or an institutional announcement. A headline cannot establish the strength of evidence.'},
  consulting: {question: 'Which assumption in your current work would this make you revisit?', caveat: 'A management perspective is not a universal result. Check the sector, incentives, sample, and conditions before applying it.'}
};
const bridges = [
  ['What would change your mind?', 'A physics experiment tests a prediction. An AI evaluation tests a capability. A consulting pilot tests an assumption.', 'Before your next pilot, write down what result would make you stop.'],
  ['The map is not the territory.', 'A model of a particle, a language model, and a programme plan each leave something out.', 'Ask which missing detail could change your decision.'],
  ['A better question beats more data.', 'Scientists choose what to measure. Consultants choose what to investigate. AI tools depend on how a task is framed.', 'Replace “Can AI do this?” with “What result would make this useful?”'],
  ['Make uncertainty visible.', 'An error bar shows a measurement’s limits. A pilot can show where a business assumption still needs evidence.', 'Name one uncertainty in your next recommendation, and how you would reduce it.']
];
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeURL(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { toast('Browser storage is unavailable. Changes last for this visit only.'); return false; } }
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500); }
function dateLabel(value) { return new Date(value).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}); }
function todayKey() { return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
function ageDays(value) { return Math.floor((Date.now() - Date.parse(value)) / 86400000); }
function isNew(story) { return previousVisit && Date.parse(story.firstSeen || story.published) > Date.parse(previousVisit); }
function updateTheme() { document.documentElement.dataset.theme = state.theme; $('#theme').textContent = state.theme === 'dark' ? 'Light mode' : 'Dark mode'; $('#theme').setAttribute('aria-label', `Switch to ${state.theme === 'dark' ? 'light' : 'dark'} mode`); }
updateTheme();
$('#theme').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; persist(); updateTheme(); };
$('#reflection').value = state.notes[todayKey()] || '';
$('#save-reflection').onclick = () => { state.notes[todayKey()] = $('#reflection').value.trim(); if (persist()) { $('#reflection-status').textContent = 'Saved on this device.'; toast('Your thought is saved on this device.'); } };
function setView(next) { view = next; topic = 'all'; render(); }
$$('[data-view]').forEach(b => { b.onclick = () => setView(b.dataset.view); });
$$('[data-topic]').forEach(b => { b.onclick = () => { topic = b.dataset.topic; render(); }; });
function dailyPicks() {
  return Object.keys(categories).map(category => {
    const items = edition.stories.filter(s => s.category === category);
    // Briefed stories take priority only while they remain close to that topic's newest publication.
    const newest = items[0];
    return items.find(s => s.brief && newest && Date.parse(newest.published) - Date.parse(s.published) <= 3 * 86400000) || newest;
  }).filter(Boolean);
}
function selectStories() {
  let stories = view === 'today' ? dailyPicks() : view === 'saved' ? Object.values(state.saved).sort((a,b) => b.savedAt.localeCompare(a.savedAt)) : view === 'new' ? edition.stories.filter(isNew) : edition.stories;
  return stories.filter(s => topic === 'all' || s.category === topic);
}
function card(s) {
  const saved = !!state.saved[s.id], read = !!state.read[s.id];
  const summary = s.brief?.summary || s.excerpt || 'The publisher supplied a headline without a short description. Open the source for the complete context.';
  return `<article class="story" data-category="${escapeHTML(s.category)}"><div class="story-top"><span class="story-label">${labels[s.category] || 'PERSPECTIVE'}</span><span class="story-time">${dateLabel(s.published)}</span></div><h2><button data-open="${s.id}">${escapeHTML(s.title)}</button></h2><p class="source-label">${s.brief ? 'EDITORIAL BRIEF · BASED ON THE SOURCE FEED' : 'PUBLISHER PREVIEW'}</p><p class="story-summary">${escapeHTML(summary)}</p><div class="story-meta"><a href="${escapeHTML(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.source)}</a><span>· ${escapeHTML(s.evidence)}</span>${s.retained ? '<span>· Last-known copy</span>' : ''}${ageDays(s.published) > 14 ? '<span>· Older perspective</span>' : ''}</div><div class="story-bottom"><button class="open-button" data-open="${s.id}">Make this useful</button><div class="story-actions"><button class="small-button" data-read="${s.id}" aria-pressed="${read}" aria-label="${read ? 'Mark unread' : 'Mark read'}: ${escapeHTML(s.title)}">${read ? '✓ Read' : 'Mark read'}</button><button class="small-button" data-save="${s.id}" aria-pressed="${saved}" aria-label="${saved ? 'Unsave' : 'Save'}: ${escapeHTML(s.title)}">${saved ? '◆ Saved' : '◇ Save'}</button></div></div></article>`;
}
function getStory(id) { return edition.stories.find(s => s.id === id) || state.saved[id]; }
function bindCards() {
  $$('[data-open]').forEach(b => { b.onclick = () => openStory(getStory(b.dataset.open)); });
  $$('[data-save]').forEach(b => { b.onclick = () => {
    const s = getStory(b.dataset.save);
    if (state.saved[s.id]) { delete state.saved[s.id]; toast('Removed from your collection.'); }
    else { state.saved[s.id] = {...s, savedAt: new Date().toISOString()}; toast('Saved to your collection on this device.'); }
    persist(); render();
  }; });
  $$('[data-read]').forEach(b => { b.onclick = () => { const id = b.dataset.read; if (state.read[id]) delete state.read[id]; else state.read[id] = new Date().toISOString(); persist(); render(); }; });
}
function render() {
  if (!edition) return;
  $$('[data-view]').forEach(b => { const selected = b.dataset.view === view; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', selected); });
  $$('[data-topic]').forEach(b => { const selected = b.dataset.topic === topic; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', selected); });
  const titles = {today:'A wider view.<br><em>A sharper mind.</em>', new:'A fresh<br><em>perspective.</em>', saved:'Ideas worth<br><em>keeping.</em>', all:'Follow your<br><em>curiosity.</em>'};
  const descriptions = {today:'One idea for your work. One for your wonder. One to connect them.', new:previousVisit ? `Stories first collected since ${dateLabel(previousVisit)}.` : 'Your first visit starts the clock. Return later to see newly collected stories.', saved:'Your saved stories stay here, even when they leave the current feed. Stored on this device.', all:'Follow the source. Form your own view. There is no need to read everything.'};
  $('#view-title').innerHTML = titles[view]; $('#view-description').textContent = descriptions[view];
  $('#saved-count').textContent = Object.keys(state.saved).length;
  $('#new-count').textContent = previousVisit ? edition.stories.filter(isNew).length : '';
  $('#constellation-count').textContent = Object.keys(state.saved).length;
  for (const category of Object.keys(categories)) {
    const count = Object.values(state.saved).filter(s => s.category === category).length;
    $(`.${category}-star`).setAttribute('r', String(7 + Math.min(count, 10)));
  }
  const stories = selectStories();
  $('#stories').innerHTML = stories.length ? stories.map(card).join('') : `<div class="empty"><h2>${view === 'saved' ? 'A place for your next good idea.' : view === 'new' ? 'You are caught up.' : 'No stories in this view.'}</h2><p>${view === 'saved' ? 'Tap Save on any story to keep it here.' : view === 'new' ? 'Explore the current feed while the next edition takes shape.' : 'Try another topic, or check Sources & freshness.'}</p><button id="empty-explore" class="small-button">Explore the feed</button></div>`;
  if ($('#empty-explore')) $('#empty-explore').onclick = () => setView('all');
  $('#ritual').hidden = view === 'all' || view === 'new';
  if (view === 'saved') {
    const notes = Object.entries(state.notes).filter(([,text]) => text).sort(([a],[b]) => b.localeCompare(a));
    if (notes.length) {
      const section = document.createElement('section'); section.className = 'empty';
      section.innerHTML = '<h2>Your past takeaways</h2>' + notes.slice(0,14).map(([date,text]) => `<p><strong>${escapeHTML(date)}</strong><br>${escapeHTML(text)}</p>`).join('');
      $('#stories').append(section);
    }
  }
  bindCards();
}
function showDialog(label, content) { $('#dialog-label').textContent = label; $('#dialog-content').innerHTML = content; if (!$('#dialog').open) $('#dialog').showModal(); }
$('#close-dialog').onclick = () => $('#dialog').close();
$('#dialog').addEventListener('click', e => { if (e.target === $('#dialog')) { const rect = $('#dialog').getBoundingClientRect(); if(e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) $('#dialog').close(); } });
$('#dialog').addEventListener('close', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); });
function openStory(s) {
  if (!s) return;
  activeStory = s;
  const lens = prompts[s.category];
  showDialog(`${categories[s.category]} · ${dateLabel(s.published)}`, `<h2>${escapeHTML(s.title)}</h2><p class="source-label">${escapeHTML(s.source)} · ${escapeHTML(s.evidence)}</p><h3>${s.brief ? 'In brief' : 'From the publisher'}</h3><p>${escapeHTML(s.brief?.summary || s.excerpt || 'No short description was supplied. Read the original for details.')}</p><h3>A question to take away</h3><p>${escapeHTML(s.brief?.question || lens.question)}</p><h3>Keep in mind</h3><p>${escapeHTML(s.brief?.caveat || lens.caveat)}</p><p class="source-label">${escapeHTML(s.brief?.basis || 'Short publisher excerpt. The question and caution are general reading prompts, not findings from this article.')}</p><div class="dialog-actions"><a class="primary-link" href="${escapeHTML(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">Read the original</a><button id="listen" class="small-button">Listen to this card</button><button id="share" class="small-button">Share source</button></div><p class="source-label">Listening uses your browser's available voice. Availability varies by device.</p>`);
  $('#listen').disabled = !('speechSynthesis' in window);
  $('#listen').onclick = () => {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); $('#listen').textContent = 'Listen to this card'; return; }
    const utterance = new SpeechSynthesisUtterance(`${s.title}. ${s.brief?.summary || s.excerpt || ''}. A question to take away. ${s.brief?.question || lens.question}. Keep in mind. ${s.brief?.caveat || lens.caveat}`);
    utterance.lang = 'en-GB'; utterance.rate = .96;
    utterance.onend = utterance.onerror = () => { if ($('#listen')) $('#listen').textContent = 'Listen to this card'; };
    speechSynthesis.speak(utterance); $('#listen').textContent = 'Stop listening';
  };
  $('#share').onclick = async () => { try { if (navigator.share) await navigator.share({title:s.title,url:safeURL(s.url)}); else { await navigator.clipboard.writeText(safeURL(s.url)); toast('Source link copied.'); } } catch(e) { if(e.name !== 'AbortError') toast('Open the original and copy its address to share.'); } };
}
$('#surprise').onclick = () => { if (!edition?.stories.length) return; const pool = edition.stories.filter(s => !state.read[s.id] && (topic === 'all' || s.category === topic)); const options = pool.length ? pool : selectStories(); if (options.length) openStory(options[Math.floor(Math.random() * options.length)]); else toast('No stories in this view yet.'); };
$('#next-bridge').onclick = () => { bridgeIndex = (bridgeIndex + 1) % bridges.length; const [title,body,question] = bridges[bridgeIndex]; $('#bridge-title').textContent=title; $('#bridge-body').textContent=body; $('#bridge-question').textContent=question; };
$('#recall-reveal').onclick = () => { const open = $('#recall-answer').hidden; $('#recall-answer').hidden = !open; $('#recall-reveal').textContent = open ? 'Hide the thought' : 'Reveal the thought'; };
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
$('#setup').onclick = () => {
  showDialog('TAKE YOUR OBSERVATORY WITH YOU', `<h2>A small ritual.<br>Always within reach.</h2><h3>On your Pixel</h3><ol><li>Open this page in Chrome.</li><li>Open the three-dot menu.</li><li>Choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li></ol>${deferredInstall ? '<button id="install-app" class="primary-link">Install Observatory</button>' : ''}<h3>On your MacBook</h3><p>Bookmark this page in your work browser. Your saved stories and notes stay in that browser.</p><h3>Receive the feed</h3><p>Copy the feed address into an RSS reader on your phone. Reader notifications depend on your chosen app and settings.</p><button id="copy-feed" class="small-button">Copy feed address</button><h3>Twice a day</h3><p>New editions are scheduled for 06:17 and 17:17 UTC. That is 07:17 and 18:17 during British Summer Time, or 06:17 and 17:17 in winter. GitHub may delay scheduled runs.</p><p>This site does not send push notifications. The home-screen app and RSS subscription give you two ways to return.</p>`);
  $('#copy-feed').onclick = async () => { try { await navigator.clipboard.writeText(new URL('feed.xml', location.href).href); toast('Feed address copied.'); } catch { toast(`Feed: ${new URL('feed.xml', location.href).href}`); } };
  if ($('#install-app')) $('#install-app').onclick = async () => { await deferredInstall.prompt(); deferredInstall = null; $('#dialog').close(); };
};
$('#sources-button').onclick = () => {
  if (!edition) return;
  showDialog('SOURCES & FRESHNESS', `<h2>Know where it comes from.</h2><p>Last collection: ${escapeHTML(new Date(edition.updatedAt).toLocaleString('en-GB', {timeZone:'Europe/London'}))} London time.</p><p>Publisher feeds are collected twice daily. Dates on cards are publication dates. Older retained stories are labelled.</p>${edition.sources.map(s => `<div class="source-row"><a href="${escapeHTML(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.name)}</a><small>${s.ok ? `Collected ${s.count} stories` : `Could not refresh · ${s.count} retained stories`}</small></div>`).join('')}<p>Sources include company announcements and opinion. Coverage is selective, and a source's inclusion is not an endorsement.</p>`);
};
$('#about').onclick = () => showDialog('HOW THIS WORKS', '<h2>A reading desk, not a race.</h2><p>Your daily three selects one story from each topic. Recent editorial briefs take priority; otherwise, the newest collected story appears.</p><p>Editorial briefs paraphrase the cited feed descriptions. Other cards display short publisher excerpts. No live AI model writes or verifies future stories.</p><p>Questions and connections help you reflect. They are labelled as prompts, not new research findings.</p><p>Saved stories, reading marks, and notes remain in this browser. They do not sync between your Pixel and MacBook. Clearing browser data removes them.</p><p>The site stores no account details and contains no analytics. It loads fonts from Google Fonts and links to external publishers.</p><p>“Check for updates” downloads the latest published edition. It does not start a new source collection. GitHub runs the collector twice daily.</p>');
async function loadEdition(manual = false) {
  $('#refresh').disabled = true;
  try {
    const response = await fetch(`data/edition.json?v=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error('Could not load edition');
    const data = await response.json();
    if (!Array.isArray(data.stories) || !Array.isArray(data.sources) || !data.updatedAt) throw new Error('Invalid edition');
    edition = data;
    const stale = Date.now() - Date.parse(data.updatedAt) > 36 * 3600000;
    const failures = data.sources.filter(s => !s.ok).length;
    $('#freshness').textContent = `Collected ${dateLabel(data.updatedAt)} · ${new Date(data.updatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})} London`;
    $('#edition-date').textContent = `${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/London'}).toUpperCase()} / YOUR DAILY PERSPECTIVE`;
    const warnings = [];
    if (!navigator.onLine || response.headers.get('X-Observatory-Cached') === 'true') warnings.push('The network is unavailable or offline. This is the last cached edition.');
    if (stale) warnings.push('This edition is over 36 hours old. Check Sources & freshness before treating it as current.');
    if (failures) warnings.push(`${failures} source${failures > 1 ? 's' : ''} could not refresh. Other sources are available.`);
    $('#warning').textContent = warnings.join(' '); $('#warning').hidden = !warnings.length;
    if (!state.lastVisit || Date.parse(state.lastVisit) < Date.now()) { state.lastVisit = new Date().toISOString(); persist(); }
    render();
    if (manual) toast('Latest published edition loaded.');
  } catch {
    if (!edition) $('#stories').innerHTML = '<div class="empty"><h2>Your edition could not load.</h2><p>Check your connection, then choose Check for updates. Your saved stories remain stored in this browser.</p></div>';
    $('#freshness').textContent = 'Unable to check the latest edition';
    if (manual) toast('Could not check for updates. Please try again.');
  } finally { $('#refresh').disabled = false; }
}
$('#refresh').onclick = () => loadEdition(true);
loadEdition();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
