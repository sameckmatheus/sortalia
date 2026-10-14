(() => {
  'use strict';
  const STORAGE_KEY = 'sortalia_v1';
  const $ = id => document.getElementById(id);
  const ui = { participantList: $('participantList'), prizeList: $('prizeList'), stageName: $('stagePrizeName'), stageSub: $('stagePrizeSub'), spotlight: $('spotlight'), drawBtn: $('drawBtn'), modal: $('modalBackdrop'), modalBody: $('modalBody'), modalFooter: $('modalFooter') };
  const STAR_SVG = '<svg class="star-svg" viewBox="-20 -20 140 140" aria-hidden="true" focusable="false"><defs><linearGradient id="starGrad" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0" stop-color="#fff6b8"/><stop offset=".45" stop-color="#ffd63f"/><stop offset="1" stop-color="#ffab00"/></linearGradient><radialGradient id="starHalo"><stop offset="0" stop-color="#ffe27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient></defs><circle class="star-halo" cx="50" cy="50" r="62" fill="url(#starHalo)"/><g class="star-orbit"><circle cx="50" cy="50" r="54" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".7" stroke-dasharray="2 6"/><circle cx="50" cy="-4" r="2.2" fill="#fff"/><circle cx="104" cy="50" r="1.5" fill="#ffe27a"/></g><path class="star-main" d="M50 2C54 30 70 46 98 50C70 54 54 70 50 98C46 70 30 54 2 50C30 46 46 30 50 2Z" fill="url(#starGrad)" stroke="#fff3b0" stroke-width="1.2" stroke-linejoin="round"/><path class="star-shine" d="M50 18C52 38 62 48 82 50C62 52 52 62 50 82C48 62 38 52 18 50C38 48 48 38 50 18Z" fill="#fff" opacity=".35"/><path class="star-spark s1" d="M92 12l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z" fill="#fff"/><path class="star-spark s2" d="M8 84l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#ffe27a"/><path class="star-spark s3" d="M12 14l1.2 3.2 3.2 1.2-3.2 1.2-1.2 3.2-1.2-3.2-3.2-1.2 3.2-1.2z" fill="#fff"/></svg>';
  const DEFAULT_SETTINGS = { allowMultipleWins: false, countdown: 3, sound: false, brand: 'SORTALIA', eventName: 'EDIÇÃO CORPORATIVA', confirmDraw: false };
  const freshState = () => ({ participants: [], prizes: [], history: [], selectedPrizeId: null, settings: { ...DEFAULT_SETTINGS }, source: null });
  const EMBEDDED_MODEL = window.SORTALIA_EMBEDDED_MODEL;
  const seededState = () => ({ ...freshState(), participants: EMBEDDED_MODEL.participants.map(p => ({ ...p })), prizes: EMBEDDED_MODEL.prizes.map(p => ({ ...p })), selectedPrizeId: EMBEDDED_MODEL.prizes[0]?.id || null, source: { file: 'modelo-sortalia-preenchido.xlsx', loadedAt: null, photoCount: 5, isDemo: true } });
  let state = loadState(), isDrawing = false, isTheater = false, audioContext = null, confettiFrame = 0, confettiParticles = [], toastTimers = [];
  const normalize = s => String(s ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
  const normalizeHeader = s => normalize(s).replace(/[^a-z0-9]/g, '');
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const uid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const intVal = (v, fallback = 1) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : fallback };
  const remaining = p => Math.max(0, p.quantity - state.history.filter(h => h.prizeId === p.id).length);
  const prettyNum = n => new Intl.NumberFormat('pt-BR', { minimumIntegerDigits: 2 }).format(n);
  const textDate = s => { try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s)) } catch { return s || '' } };
  function loadState() { try { let o = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (!o || !Array.isArray(o.participants) || !Array.isArray(o.prizes) || !Array.isArray(o.history)) return seededState(); return { ...freshState(), ...o, settings: { ...DEFAULT_SETTINGS, ...o.settings } } } catch { return freshState() } }
  function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true } catch (e) { toast('Não foi possível salvar tudo no navegador. Faça um backup para evitar perda de dados.', 'error'); return false } }
  function getPrize() { return state.prizes.find(p => p.id === state.selectedPrizeId) || null }
  function getEligible(prizeId) { const hasWonHere = new Set(state.history.filter(h => h.prizeId === prizeId).map(h => h.participantId)); const hasWonAnywhere = state.settings.allowMultipleWins ? new Set() : new Set(state.history.map(h => h.participantId)); return state.participants.filter(p => !hasWonHere.has(p.id) && !hasWonAnywhere.has(p.id)) }
  function getCanDraw(p) { return Boolean(p && remaining(p) > 0 && getEligible(p.id).length > 0 && crypto?.getRandomValues) }
  function pickNextPrize() { const p = getPrize(); if (p && remaining(p) > 0) return; state.selectedPrizeId = state.prizes.find(x => remaining(x) > 0)?.id || null }
  function toast(message, type = 'success') { const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; $('toastStack').appendChild(el); let id = setTimeout(() => el.remove(), 4800); toastTimers.push(id) }
  function initials(s) { const arr = String(s).trim().split(/\s+/).filter(Boolean); return (arr.length >= 2 ? arr[0][0] + arr[arr.length - 1][0] : arr[0]?.slice(0, 2) || '?').toUpperCase() }
  function safeImageUrl(value) { let s = String(value ?? '').trim(); if (!s) return ''; if (/^data:image\/(webp|png|jpe?g|gif);base64,[A-Za-z0-9+/=]+$/i.test(s)) return s; try { const url = new URL(s); if (url.protocol === 'https:' || url.protocol === 'http:') return url.href } catch { } return '' }
  function makeImage(src, className, alt = '') { const el = document.createElement('img'); el.src = src; el.className = className; el.alt = alt; el.loading = 'lazy'; el.onerror = () => { el.replaceWith(document.createTextNode('✦')) }; return el }
  function renderParticipants() { const root = ui.participantList; root.replaceChildren(); $('participantsCount').textContent = prettyNum(state.participants.length); const p = getPrize(); const eligible = p ? getEligible(p.id) : state.participants; $('eligibleFooter').textContent = `${eligible.length} participante${eligible.length === 1 ? '' : 's'} apto${eligible.length === 1 ? '' : 's'}`; if (!state.participants.length) { root.innerHTML = '<div class="empty-mini">Nenhum participante cadastrado.<br>Adicione ou importe uma lista.</div>'; return } const displayed = state.participants.slice(0, 8), winners = new Set(state.history.map(h => h.participantId)); for (const person of displayed) { const item = document.createElement('div'); item.className = 'person-item'; const avatar = document.createElement('div'); avatar.className = 'person-avatar'; avatar.textContent = initials(person.name); const meta = document.createElement('div'); meta.className = 'person-meta'; const name = document.createElement('div'); name.className = 'person-name'; name.textContent = person.name; meta.append(name); if (person.ref) { const ref = document.createElement('div'); ref.className = 'person-id'; ref.textContent = person.ref; meta.append(ref) } const ck = document.createElement('span'); ck.className = 'person-check' + (winners.has(person.id) ? ' used' : ''); ck.textContent = winners.has(person.id) ? '●' : '✓'; ck.title = winners.has(person.id) ? 'Já contemplado' : 'Cadastrado'; item.append(avatar, meta, ck); root.append(item) } if (state.participants.length > 8) { const el = document.createElement('div'); el.className = 'empty-mini'; el.textContent = `+ ${state.participants.length - 8} participantes na base`; root.append(el) } }
  function renderPrizes() { const root = ui.prizeList; root.replaceChildren(); $('prizesCount').textContent = prettyNum(state.prizes.length); const total = state.prizes.reduce((sum, p) => sum + remaining(p), 0); $('prizeFooter').textContent = `${total} sorteio${total === 1 ? '' : 's'} disponível${total === 1 ? '' : 'eis'}`; if (!state.prizes.length) { root.innerHTML = '<div class="empty-mini">Nenhum prêmio cadastrado.<br>Adicione seu primeiro prêmio.</div>'; return } for (const p of state.prizes) { const item = document.createElement('button'); item.type = 'button'; item.className = `prize-item ${p.id === state.selectedPrizeId ? 'selected ' : ''}${remaining(p) === 0 ? 'done' : ''}`; item.title = `Selecionar: ${p.name}`; const thumb = document.createElement('span'); thumb.className = 'prize-image'; const img = safeImageUrl(p.image); if (img) thumb.append(makeImage(img, '', p.name)); else thumb.textContent = '✦'; const words = document.createElement('span'); words.className = 'prize-text'; const name = document.createElement('span'); name.className = 'prize-name-small'; name.textContent = p.name; const stock = document.createElement('span'); stock.className = 'prize-stock'; stock.style.display = 'block'; stock.textContent = `${remaining(p)} de ${p.quantity} restante${remaining(p) === 1 ? '' : 's'}`; words.append(name, stock); item.append(thumb, words); if (p.id === state.selectedPrizeId) { const mark = document.createElement('span'); mark.className = 'selected-mark'; mark.textContent = '✓'; item.append(mark) } item.addEventListener('click', () => { if (isDrawing) return; state.selectedPrizeId = p.id; persist(); renderAll() }); root.append(item) } }
  function renderStage() { pickNextPrize(); const p = getPrize(); ui.spotlight.replaceChildren(); if (!p) { const pl = document.createElement('div'); pl.className = 'spotlight-placeholder'; pl.innerHTML = STAR_SVG; ui.spotlight.append(pl); ui.stageName.textContent = 'Seu próximo grande momento.'; ui.stageSub.textContent = 'Cadastre os participantes e os prêmios para começar.'; $('drawProgress').innerHTML = '<span>✦</span><span>PREPARE A EMOÇÃO</span><span>✦</span>' } else { const image = safeImageUrl(p.image); if (image) ui.spotlight.append(makeImage(image, '', p.name)); else { const pl = document.createElement('div'); pl.className = 'spotlight-placeholder'; pl.innerHTML = STAR_SVG; ui.spotlight.append(pl) } ui.stageName.textContent = p.name; const left = remaining(p), eligible = getEligible(p.id).length; ui.stageSub.textContent = left ? `${left} unidade${left === 1 ? '' : 's'} em jogo • ${eligible} participante${eligible === 1 ? '' : 's'} elegível${eligible === 1 ? '' : 'eis'}` : 'Todas as unidades deste prêmio já foram sorteadas.'; $('drawProgress').innerHTML = '<span>✦</span><span>' + escapeHTML(`${p.quantity - left} DE ${p.quantity} CONCLUÍDOS`) + '</span><span>✦</span>' } let ok = getCanDraw(p); ui.drawBtn.disabled = !ok || isDrawing; $('drawBtnText').textContent = isDrawing ? 'SORTEIO EM ANDAMENTO' : !state.participants.length ? 'ADICIONE PARTICIPANTES' : !state.prizes.length ? 'ADICIONE UM PRÊMIO' : !p || remaining(p) === 0 ? 'SORTEIOS CONCLUÍDOS' : !getEligible(p.id).length ? 'SEM PARTICIPANTES APTOS' : 'COMEÇAR SORTEIO'; $('historyCount').textContent = state.history.length; $('certificateBtn').disabled = state.history.length === 0; renderBrand() }
  function renderBrand() { const name = 'SORTALIA'; document.querySelector('.top-mid .muted').textContent = state.source?.isDemo ? 'BASE DE DEMONSTRAÇÃO' : (state.settings.eventName || 'EDIÇÃO CORPORATIVA').toUpperCase().slice(0, 32); const strong = document.querySelector('.brand-text strong'); strong.replaceChildren(document.createTextNode(name), Object.assign(document.createElement('span'), { textContent: '.' })); document.querySelector('.brand-icon span').textContent = name.slice(0, 1).toLowerCase(); document.querySelector('.stage-bottom-number').textContent = `${name} / 2026`; document.querySelector('.stage-edition').textContent = (state.settings.eventName || 'EDIÇÃO CORPORATIVA').toUpperCase().slice(0, 32); document.querySelector('.count-bottom-brand').innerHTML = `${escapeHTML(name)} <span>✦</span> A SORTE ESTÁ LANÇADA`; document.querySelector('.winner-bottom').innerHTML = `${escapeHTML(name)} <span>✦</span> SORTEIO TRANSPARENTE`; $('soundBtn').classList.toggle('active', state.settings.sound); $('soundBtn').title = state.settings.sound ? 'Desativar som' : 'Ativar som'; $('soundIco').textContent = state.settings.sound ? '♫' : '♪' }
  function renderAll() { renderParticipants(); renderPrizes(); renderStage() }
  function addParticipant(name, ref = '') { name = String(name || '').trim().replace(/\s+/g, ' '); ref = String(ref || '').trim().slice(0, 100); if (!name || name.length > 130) return { ok: false, reason: 'Nome ausente ou muito longo' }; const key = ref ? 'id:' + normalize(ref) : 'nome:' + normalize(name); if (state.participants.some(p => (p.ref ? 'id:' + normalize(p.ref) : 'nome:' + normalize(p.name)) === key)) return { ok: false, reason: 'Participante já cadastrado' }; state.participants.push({ id: uid(), name, ref }); return { ok: true } }
  function addPrize(name, quantity = 1, image = '') { name = String(name || '').trim().replace(/\s+/g, ' '); if (!name || name.length > 160) return { ok: false, reason: 'Nome do prêmio inválido' }; if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return { ok: false, reason: 'Quantidade deve ser um inteiro de 1 a 100.000' }; if (state.prizes.some(p => normalize(p.name) === normalize(name))) return { ok: false, reason: 'Prêmio com este nome já existe' }; const obj = { id: uid(), name, quantity, image: safeImageUrl(image) }; state.prizes.push(obj); if (!state.selectedPrizeId) state.selectedPrizeId = obj.id; return { ok: true } }
  function closeModal() { ui.modal.hidden = true; ui.modalBody.replaceChildren(); ui.modalFooter.replaceChildren(); document.body.style.overflow = ''; }
  function openModal(title, kicker, body, footer = []) { $('modalTitle').textContent = title; $('modalKicker').textContent = kicker; ui.modalBody.innerHTML = body; ui.modalFooter.replaceChildren(); footer.forEach(opt => { const b = document.createElement('button'); b.type = 'button'; b.className = 'modal-button ' + (opt.className || ''); b.textContent = opt.label; b.addEventListener('click', opt.click); ui.modalFooter.append(b) }); ui.modal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => ui.modalBody.querySelector('input:not([type="file"]),textarea')?.focus(), 40) }
  function participantModal() { openModal('Novo participante', 'CADASTRO', `<div class="form-field"><label for="pName">Nome completo *</label><input id="pName" maxlength="130" placeholder="Digite o nome do participante" autocomplete="off"></div><div class="form-field"><label for="pRef">Identificador (opcional)</label><input id="pRef" maxlength="100" placeholder="Matrícula, e-mail ou código único"><p class="field-helper">Permite diferenciar pessoas com nomes iguais e evita inscrições repetidas pelo identificador.</p></div><div class="info-banner">Para várias pessoas de uma vez, utilize <strong>Importar participantes</strong> (XLSX, CSV ou TXT).</div>`, [{ label: 'Cancelar', className: 'secondary', click: closeModal }, { label: 'Salvar e adicionar outro', click: () => saveParticipant(true) }, { label: 'Salvar participante', click: () => saveParticipant(false) }]); $('pName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveParticipant(true) } }) }
  function saveParticipant(another) { const name = $('pName').value, ref = $('pRef').value; const result = addParticipant(name, ref); if (!result.ok) { toast(result.reason, 'error'); $('pName').focus(); return } persist(); renderAll(); toast('Participante adicionado com sucesso.'); if (another) { $('pName').value = ''; $('pRef').value = ''; $('pName').focus() } else closeModal() }
  async function shrinkImage(file) { if (!file) return ''; if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw Error('Utilize JPG, PNG, WebP ou GIF.'); if (file.size > 12 * 1024 * 1024) throw Error('Imagem acima de 12 MB.'); const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('Erro ao ler a imagem.')); reader.readAsDataURL(file) }); const img = await new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(Error('Imagem inválida.')); im.src = data }); const scale = Math.min(1, 700 / Math.max(img.width, img.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale)); canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/webp', .79) }
  function prizeModal(existing = null) { const edit = Boolean(existing); let imageData = existing?.image || ''; const oldDrawn = edit ? state.history.filter(h => h.prizeId === existing.id).length : 0; openModal(edit ? 'Editar prêmio' : 'Novo prêmio', edit ? 'CONFIGURAÇÕES DO PRÊMIO' : 'CADASTRO DE PRÊMIO', `<div class="form-field"><label for="awardName">Nome do prêmio *</label><input id="awardName" maxlength="160" placeholder="Ex.: Smartphone, vale-presente, notebook" value="${escapeHTML(existing?.name || '')}"></div><div class="form-grid"><div class="form-field"><label for="awardQty">Quantidade de unidades *</label><input type="number" id="awardQty" min="1" max="100000" step="1" value="${existing?.quantity ?? 1}"></div><div class="form-field"><label for="awardURL">URL da imagem (opcional)</label><input type="url" id="awardURL" placeholder="https://..." value="${escapeHTML(imageData.startsWith('http') ? imageData : '')}"></div></div><div class="form-field"><label>Foto do prêmio (opcional)</label><div class="upload-zone"><div id="prizePreviewWrap">${imageData ? '<span style="font-size:28px">🖼</span>' : '<span class="upload-icon">⇧</span>'}</div><div><strong>Enviar imagem do dispositivo</strong><p>JPG, PNG, GIF ou WebP • até 12 MB</p></div><input id="awardPhoto" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Escolher foto do prêmio"></div><p class="field-helper">As fotos enviadas são otimizadas e armazenadas localmente neste navegador.</p></div>${oldDrawn ? `<div class="metric-bar">Este prêmio já teve ${oldDrawn} sorteio(s); a quantidade não pode ficar abaixo disso.</div>` : ''}`, [{ label: 'Cancelar', className: 'secondary', click: closeModal }, { label: edit ? 'Salvar alterações' : 'Cadastrar prêmio', className: 'yellow', click: submit }]); function updatePreview() { const wrap = $('prizePreviewWrap'); wrap.replaceChildren(); const image = safeImageUrl(imageData || $('awardURL').value); if (image) { const im = makeImage(image, 'photo-preview', 'Prévia do prêmio'); wrap.append(im) } else { const span = document.createElement('span'); span.className = 'upload-icon'; span.textContent = '⇧'; wrap.append(span) } } updatePreview(); $('awardPhoto').addEventListener('change', async e => { if (!e.target.files[0]) return; try { imageData = await shrinkImage(e.target.files[0]); $('awardURL').value = ''; updatePreview() } catch (err) { toast(err.message, 'error') } }); $('awardURL').addEventListener('input', () => { if ($('awardURL').value.trim()) imageData = ''; updatePreview() }); function submit() { const name = $('awardName').value.trim(), qt = Number($('awardQty').value); const image = imageData || $('awardURL').value.trim(); if (!name || name.length > 160) { toast('Informe o nome do prêmio.', 'error'); return } if (!Number.isInteger(qt) || qt < Math.max(1, oldDrawn) || qt > 100000) { toast(`Informe quantidade inteira entre ${Math.max(1, oldDrawn)} e 100.000.`, 'error'); return } const safeImg = safeImageUrl(image); if (image && !safeImg) { toast('Imagem inválida. Use uma foto ou URL http(s).', 'error'); return } if (edit) { if (state.prizes.some(p => p.id !== existing.id && normalize(p.name) === normalize(name))) { toast('Outro prêmio já usa esse nome.', 'error'); return } Object.assign(existing, { name, quantity: qt, image: safeImg }) } else { const result = addPrize(name, qt, safeImg); if (!result.ok) { toast(result.reason, 'error'); return } } persist(); renderAll(); closeModal(); toast(edit ? 'Prêmio atualizado.' : 'Prêmio cadastrado com sucesso.') } }
  function deletePerson(id) { const p = state.participants.find(x => x.id === id); if (!p) return; if (state.history.some(h => h.participantId === id)) { toast('Este participante já foi contemplado; seu registro é protegido no histórico.', 'error'); return } if (!confirm(`Remover ${p.name} da lista?`)) return; state.participants = state.participants.filter(x => x.id !== id); persist(); renderAll(); manageParticipants() }
  function deletePrize(id) { const p = state.prizes.find(x => x.id === id); if (!p) return; if (state.history.some(h => h.prizeId === id)) { toast('Este prêmio já possui sorteios registrados. Não pode ser removido.', 'error'); return } if (!confirm(`Remover o prêmio “${p.name}”?`)) return; state.prizes = state.prizes.filter(x => x.id !== id); if (state.selectedPrizeId === id) state.selectedPrizeId = null; persist(); renderAll(); managePrizes() }
  function manageParticipants() { openModal('Participantes', 'GERENCIAMENTO DA BASE', `<div class="metric-bar">${state.participants.length} participante(s) cadastrado(s) • ${state.history.length} resultado(s) registrado(s)</div><input id="manageQuery" class="manage-search" placeholder="Buscar por nome ou identificador..."><div class="manage-list" id="manageList"></div>`, [{ label: 'Modelo CSV', className: 'secondary', click: () => downloadCSV('modelo_participantes.csv', [['nome', 'matricula'], ['Maria Silva', '001'], ['João Santos', '002']]) }, { label: 'Importar', className: 'secondary', click: () => $('participantFile').click() }, { label: 'Adicionar', click: participantModal }]); const input = $('manageQuery'), root = $('manageList'); function filter() { root.replaceChildren(); const match = state.participants.filter(p => normalize(p.name + ' ' + (p.ref || '')).includes(normalize(input.value))); if (!match.length) { root.innerHTML = '<div class="empty-large">Nenhum participante encontrado.</div>'; return } const frag = document.createDocumentFragment(); for (const p of match.slice(0, 500)) { const item = document.createElement('div'); item.className = 'manage-row'; const text = document.createElement('div'); text.style.minWidth = '0'; text.innerHTML = `<div class="row-name">${escapeHTML(p.name)}</div><small>${p.ref ? escapeHTML(p.ref) : 'Sem identificador'}${state.history.some(h => h.participantId === p.id) ? ' • já contemplado' : ''}</small>`; const del = document.createElement('button'); del.className = 'mini-remove'; del.textContent = 'Excluir'; del.disabled = state.history.some(h => h.participantId === p.id); del.title = del.disabled ? 'Participante contemplado não pode ser removido' : 'Remover participante'; if (del.disabled) del.style.opacity = '.32'; del.addEventListener('click', () => deletePerson(p.id)); item.append(text, del); frag.append(item) } root.append(frag); if (match.length > 500) { const note = document.createElement('div'); note.className = 'field-helper'; note.textContent = `Exibindo os primeiros 500 de ${match.length}. Refine sua busca.`; root.append(note) } } input.addEventListener('input', filter); filter() }
  function managePrizes() { openModal('Prêmios', 'GERENCIAMENTO DE PRÊMIOS', `<div class="metric-bar">${state.prizes.length} prêmio(s) • ${state.prizes.reduce((n, p) => n + remaining(p), 0)} unidade(s) disponível(is)</div><div class="manage-list" id="manageList"></div>`, [{ label: 'Modelo CSV', className: 'secondary', click: () => downloadCSV('modelo_premios.csv', [['premio', 'quantidade', 'imagem'], ['Fone Bluetooth', '2', ''], ['Vale-presente', '1', '']]) }, { label: 'Importar', className: 'secondary', click: () => $('prizeFile').click() }, { label: 'Adicionar', className: 'yellow', click: () => prizeModal() }]); const root = $('manageList'); if (!state.prizes.length) { root.innerHTML = '<div class="empty-large">Nenhum prêmio cadastrado.</div>'; return } for (const p of state.prizes) { const row = document.createElement('div'); row.className = 'manage-row'; const text = document.createElement('div'); text.style.flex = '1'; text.style.minWidth = '0'; text.innerHTML = `<div class="row-name">${escapeHTML(p.name)}</div><small>${remaining(p)} de ${p.quantity} disponíveis</small>`; const edit = document.createElement('button'); edit.className = 'mini-select'; edit.textContent = 'Editar'; edit.addEventListener('click', () => prizeModal(p)); const del = document.createElement('button'); del.className = 'mini-remove'; del.textContent = 'Excluir'; del.disabled = state.history.some(h => h.prizeId === p.id); if (del.disabled) del.style.opacity = '.32'; del.addEventListener('click', () => deletePrize(p.id)); row.append(text, edit, del); root.append(row) } }
  function rulesModal() {
    if (isDrawing) { toast('Aguarde o fim do sorteio para alterar as regras.', 'error'); return }
    const s = state.settings, prize = getPrize(), locked = state.history.length > 0;
    const eligibleNow = prize ? getEligible(prize.id).length : state.participants.length;
    const opt = (v, label, small, checked) => `<label class="event-option"><input type="radio" name="ruleRepeat" value="${v}" ${checked ? 'checked' : ''}><span><strong>${label}</strong><small>${small}</small></span></label>`;
    openModal('Regras do sorteio', 'TRANSPARÊNCIA & CONTROLE', `
<div class="metric-bar">${state.participants.length} participante(s) • ${state.prizes.length} prêmio(s) • ${state.history.length} resultado(s)${prize ? ' • ' + eligibleNow + ' elegível(is) para "' + escapeHTML(prize.name) + '"' : ''}</div>
${locked ? '<div class="audit-state"><strong>Sorteio em andamento.</strong> Alterações valem apenas para os próximos sorteios; cada resultado já registrado guarda a regra usada na época, preservando a auditoria.</div>' : ''}
<div class="rules-section"><h3>1 · Elegibilidade</h3>
<div class="event-options">
${opt('false', 'Um prêmio por pessoa (recomendado)', 'Quem já ganhou sai do sorteio e não concorre aos prêmios seguintes.', !s.allowMultipleWins)}
${opt('true', 'Permitir prêmios diferentes para a mesma pessoa', 'Quem já ganhou continua concorrendo a outros prêmios.', s.allowMultipleWins)}
</div>
<p class="rule-note" style="margin-top:8px">Em qualquer modo, a mesma pessoa nunca ganha duas unidades do mesmo prêmio.</p></div>
<div class="rules-section"><h3>2 · Execução</h3>
<div class="form-grid"><div class="form-field"><label for="countdownChoice">Contagem regressiva</label><select id="countdownChoice">${[3, 5, 10].map(n => `<option value="${n}" ${Number(s.countdown) === n ? 'selected' : ''}>${n} segundos</option>`).join('')}</select></div>
<div class="form-field"><label for="brandChoice">Identificação da edição / evento</label><input id="brandChoice" maxlength="30" value="${escapeHTML(s.eventName || 'EDIÇÃO CORPORATIVA')}"></div></div>
<div class="toggle-row"><div class="toggle-copy"><strong>Pedir confirmação antes de cada sorteio</strong><small>Evita sorteios acidentais durante a apresentação.</small></div><button type="button" role="switch" aria-label="Confirmar antes de sortear" aria-checked="${Boolean(s.confirmDraw)}" class="switch ${s.confirmDraw ? 'on' : ''}" id="confirmSwitch"></button></div>
<div class="toggle-row"><div class="toggle-copy"><strong>Efeitos sonoros</strong><small>Sons durante a contagem e a revelação do vencedor.</small></div><button type="button" role="switch" aria-label="Efeitos sonoros" aria-checked="${Boolean(s.sound)}" class="switch ${s.sound ? 'on' : ''}" id="soundSwitch"></button></div></div>
<div class="info-banner"><strong>Integridade:</strong> seleção uniforme por gerador criptográfico do navegador, sem viés; nenhum participante é exibido durante a seleção; homônimos podem ser diferenciados pela matrícula; cada resultado entra numa cadeia de hashes SHA-256 verificada no comprovante PDF.</div>
<p class="rule-note">Os resultados ficam apenas neste dispositivo/navegador. Para auditoria externa, exporte o histórico, baixe o backup e use uma aba por sorteio.</p>`,
      [{ label: 'Restaurar padrões', className: 'secondary', click: () => { const keepSound = state.settings.sound; state.settings = { ...state.settings, allowMultipleWins: false, countdown: 3, confirmDraw: false, eventName: DEFAULT_SETTINGS.eventName, sound: keepSound }; persist(); renderBrand(); renderAll(); rulesModal(); toast('Regras padrão restauradas.') } },
        { label: 'Cancelar', className: 'secondary', click: closeModal },
        { label: 'Aplicar regras', click: () => {
          state.settings.allowMultipleWins = document.querySelector('input[name="ruleRepeat"]:checked')?.value === 'true';
          state.settings.countdown = [3, 5, 10].includes(Number($('countdownChoice').value)) ? Number($('countdownChoice').value) : 3;
          state.settings.confirmDraw = $('confirmSwitch').getAttribute('aria-checked') === 'true';
          state.settings.sound = $('soundSwitch').getAttribute('aria-checked') === 'true';
          state.settings.brand = 'SORTALIA'; state.settings.eventName = $('brandChoice').value.trim().slice(0, 30) || 'EDIÇÃO CORPORATIVA';
          persist(); pickNextPrize(); renderBrand(); renderAll(); closeModal(); toast('Regras atualizadas.')
        } }]);
    ['confirmSwitch', 'soundSwitch'].forEach(id => $(id).addEventListener('click', () => { const b = $(id), next = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(next)); b.classList.toggle('on', next) }));
  }
  function historyModal() { const entries = state.history.slice().reverse(); const view = entries.length ? entries.map((h, i) => `<div class="history-entry"><div class="history-rank">${String(i + 1).padStart(2, '0')}</div><div class="history-text"><strong>${escapeHTML(h.name)}</strong><span>${escapeHTML(h.prizeName)}${h.ref ? ' • ' + escapeHTML(h.ref) : ''}</span></div><div class="history-time">${escapeHTML(textDate(h.timestamp))}</div></div>`).join('') : '<div class="empty-large">Ainda não há vencedores. O histórico será preenchido após cada sorteio.</div>'; openModal('Histórico de vencedores', 'RESULTADOS OFICIAIS', `<div class="metric-bar">${state.history.length} sorteio(s) concluído(s) • Registro local do evento</div><div class="manage-list" style="max-height:52vh">${view}</div>`, [{ label: 'Fechar', className: 'secondary', click: closeModal }, { label: 'Exportar CSV', className: 'secondary', click: exportHistory }, { label: 'Comprovante PDF', click: exportCertificatePDF }]) }
  function csvCell(value) { let x = String(value ?? ''); if (/^[\s]*[=+\-@\t\r]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"' }
  function downloadFile(filename, mime, data) { const blob = new Blob([data], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500) }
  function downloadCSV(name, rows) { downloadFile(name, 'text/csv;charset=utf-8', '\ufeff' + rows.map(r => r.map(csvCell).join(';')).join('\r\n')) }
  function exportHistory() { if (!state.history.length) { toast('Ainda não há resultados para exportar.', 'error'); return } const rows = [['ordem', 'data_hora', 'participante', 'identificador', 'premio', 'registro']]; state.history.forEach((h, i) => rows.push([i + 1, textDate(h.timestamp), h.name, h.ref || '', h.prizeName, h.id])); downloadCSV('resultados_sorteio.csv', rows); toast('Histórico exportado em CSV.') }
  function exportBackup() { downloadFile(`backup_sorteio_${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8', JSON.stringify({ version: 4, exportedAt: new Date().toISOString(), ...state }, null, 2)); toast('Backup JSON gerado.') }
  async function restoreBackup(file) { if (!file) return; try { if (file.size > 25 * 1024 * 1024) throw Error('Backup muito grande.'); let obj = JSON.parse(await file.text()); if (!Array.isArray(obj.participants) || !Array.isArray(obj.prizes) || !Array.isArray(obj.history)) throw Error('Formato de backup inválido.'); if (!confirm(`Substituir a base atual por ${obj.participants.length} participantes, ${obj.prizes.length} prêmios e ${obj.history.length} resultados?`)) return; const ps = obj.participants.filter(p => p && typeof p.name === 'string' && typeof p.id === 'string').map(p => ({ id: String(p.id).slice(0, 120), name: p.name.slice(0, 130), ref: String(p.ref || '').slice(0, 100) })); const prizes = obj.prizes.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string').map(p => ({ id: String(p.id).slice(0, 120), name: p.name.slice(0, 160), quantity: intVal(p.quantity), image: safeImageUrl(p.image) })); const hist = obj.history.filter(h => h && typeof h.id === 'string' && typeof h.name === 'string' && typeof h.prizeName === 'string').map(h => ({ id: String(h.id).slice(0, 120), participantId: String(h.participantId || ''), prizeId: String(h.prizeId || ''), name: h.name.slice(0, 130), prizeName: h.prizeName.slice(0, 160), ref: String(h.ref || '').slice(0, 100), timestamp: String(h.timestamp || new Date().toISOString()), audit: h.audit && typeof h.audit === 'object' ? h.audit : null, hash: typeof h.hash === 'string' ? h.hash : '' })); state = { participants: ps, prizes, history: hist, selectedPrizeId: obj.selectedPrizeId, settings: { ...DEFAULT_SETTINGS, ...obj.settings }, source: obj.source || null }; persist(); renderAll(); closeModal(); toast('Base restaurada com sucesso.') } catch (e) { toast('Não foi possível restaurar: ' + e.message, 'error') } }
  function resetModal() { openModal('Limpar todos os dados?', 'AÇÃO IRREVERSÍVEL', `<p class="warning-text">Esta operação apagará <strong>${state.participants.length} participantes, ${state.prizes.length} prêmios e ${state.history.length} resultados</strong> deste navegador. Exporte um backup antes, se precisar manter os registros.</p><div class="form-field"><label for="resetConfirm">Digite APAGAR para confirmar</label><input id="resetConfirm" autocomplete="off" placeholder="APAGAR"></div>`, [{ label: 'Cancelar', className: 'secondary', click: closeModal }, { label: 'Apagar definitivamente', className: 'danger', click: () => { if ($('resetConfirm').value.trim().toUpperCase() !== 'APAGAR') { toast('Digite APAGAR para confirmar.', 'error'); return } state = freshState(); persist(); renderAll(); closeModal(); toast('Dados apagados.') } }]) }
  function eventManagerModal() {
    openModal('Gerenciar sorteio', 'NOVO SORTEIO & DADOS', `<div class="metric-bar">${state.participants.length} participante(s) • ${state.prizes.length} prêmio(s) • ${state.history.length} resultado(s)</div>
<div class="event-options">
<button type="button" class="event-option" id="evNew"><span class="event-ico">✦</span><span><strong>Configurar novo sorteio</strong><small>Zere os resultados mantendo a base, ou comece em branco e importe um novo modelo .xlsx.</small></span></button>
<button type="button" class="event-option" id="evImport"><span class="event-ico">⇩</span><span><strong>Importar histórico baixado</strong><small>Restaura participantes, prêmios e resultados a partir de um backup .json baixado anteriormente.</small></span></button>
<button type="button" class="event-option" id="evBackup"><span class="event-ico">⇧</span><span><strong>Baixar backup agora</strong><small>Salve o estado atual (JSON) antes de iniciar outro sorteio ou limpar os dados.</small></span></button>
<button type="button" class="event-option danger" id="evClear"><span class="event-ico">✕</span><span><strong>Limpar tudo</strong><small>Apaga participantes, prêmios e resultados deste navegador.</small></span></button>
</div>`, [{ label: 'Fechar', className: 'secondary', click: closeModal }]);
    $('evNew').addEventListener('click', newDrawModal);
    $('evImport').addEventListener('click', () => { closeModal(); $('restoreFile').click() });
    $('evBackup').addEventListener('click', exportBackup);
    $('evClear').addEventListener('click', resetModal);
  }
  function newDrawModal() {
    openModal('Configurar novo sorteio', 'NOVO SORTEIO', `<p class="warning-text">Os resultados atuais (${state.history.length}) serão apagados. Recomendamos baixar um backup antes.</p>
<div class="event-options">
<label class="event-option"><input type="radio" name="newDrawMode" value="keep" checked><span><strong>Manter participantes e prêmios</strong><small>Zera apenas os resultados; todos voltam a concorrer.</small></span></label>
<label class="event-option"><input type="radio" name="newDrawMode" value="blank"><span><strong>Começar em branco</strong><small>Remove tudo; depois cadastre ou importe o modelo completo (.xlsx).</small></span></label>
</div>`, [{ label: 'Voltar', className: 'secondary', click: eventManagerModal }, { label: 'Baixar backup', className: 'secondary', click: exportBackup }, { label: 'Iniciar novo sorteio', className: 'yellow', click: () => {
      const mode = document.querySelector('input[name="newDrawMode"]:checked')?.value;
      if (mode === 'blank') { state = freshState() } else { state.history = []; state.source = state.source || null; state.selectedPrizeId = state.prizes[0]?.id || null }
      persist(); renderBrand(); renderAll(); closeModal();
      if (mode === 'blank') { toast('Novo sorteio em branco. Importe o modelo completo ou cadastre os dados.') } else { toast('Novo sorteio pronto. Resultados zerados.') }
    } }]);
  }  function countDelimiters(line, sep) { let q = false, num = 0; for (let i = 0; i < line.length; i++) { if (line[i] === '"') { if (q && line[i + 1] === '"') i++; else q = !q } else if (!q && line[i] === sep) num++ } return num }
  function readCSV(content, sep) { const rows = []; let row = [], field = '', quote = false; for (let i = 0; i < content.length; i++) { const c = content[i]; if (c === '"') { if (quote && content[i + 1] === '"') { field += '"'; i++ } else quote = !quote } else if (!quote && c === sep) { row.push(field); field = '' } else if (!quote && (c === '\n' || c === '\r')) { if (c === '\r' && content[i + 1] === '\n') i++; row.push(field); if (row.some(s => s.trim() !== '')) rows.push(row); row = []; field = '' } else field += c } row.push(field); if (row.some(s => s.trim() !== '')) rows.push(row); return rows }
  function parseTextRecords(raw, ext) { const clean = raw.replace(/^\uFEFF/, '').replace(/^\u0000+/, ''); const line = clean.split(/\r?\n/).find(x => x.trim()) || ''; let sep = [';', ',', '\t', '|'].sort((a, b) => countDelimiters(line, b) - countDelimiters(line, a))[0]; if (ext === 'txt' && countDelimiters(line, sep) === 0) return clean.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => [line]); return readCSV(clean, sep) }
  async function decodeFile(file) { const buffer = await file.arrayBuffer(); try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer) } catch { return new TextDecoder('windows-1252').decode(buffer) } }
  async function xlsxSheets(file, type) { const sheets = await readSortaliaWorkbook(file); const exact = sheets.find(x => normalize(x.name) === (type === 'participants' ? 'participantes' : 'premios')); return (exact ? [exact] : sheets.filter(x => normalize(x.name) !== 'instrucoes')).map(x => x.rows) }
  const participantHeader = ['nome', 'nomecompleto', 'participante', 'participantes', 'colaborador', 'colaboradores', 'funcionario', 'employee', 'name', 'person', 'pessoa'];
  const referenceHeader = ['id', 'identificador', 'matricula', 'codigo', 'cod', 'cpf', 'email', 'registro', 'chapa', 'inscricao'];
  const prizeHeader = ['premio', 'premios', 'brinde', 'brindes', 'nome', 'item', 'produto', 'name', 'descricao'];
  const quantityHeader = ['quantidade', 'qtd', 'unidades', 'qty', 'quantity', 'total'];
  const imageHeader = ['foto', 'imagem', 'image', 'imageurl', 'url', 'link', 'fotourl'];
  function extractRows(rows, type) { if (!rows?.length) return []; const header = (rows[0] || []).map(normalizeHeader); const possible = type === 'participants' ? participantHeader : prizeHeader; let nameCol = header.findIndex(v => possible.includes(v)), refCol = header.findIndex(v => referenceHeader.includes(v)), qtyCol = header.findIndex(v => quantityHeader.includes(v)), imgCol = header.findIndex(v => imageHeader.includes(v)); const hasHeader = nameCol !== -1; let start = hasHeader ? 1 : 0; if (!hasHeader) nameCol = 0; const out = []; for (const row of rows.slice(start)) { const name = String(row[nameCol] ?? '').trim(); if (!name || /^#/.test(name)) continue; if (type === 'participants') { out.push({ name, ref: String(row[hasHeader ? refCol : 1] ?? '').trim() }) } else { let qty = Number(String(row[hasHeader ? qtyCol : 1] ?? '1').replace(',', '.')); out.push({ name, quantity: qty, image: String(row[hasHeader ? imgCol : 2] ?? '').trim() }) } } return out }
  async function importFile(file, type) { if (!file) return; if (file.size > 15 * 1024 * 1024) { toast('Arquivo acima de 15 MB. Divida a planilha em arquivos menores.', 'error'); return } try { const ext = file.name.split('.').pop().toLowerCase(); let sheets; if (ext === 'xlsx') sheets = await xlsxSheets(file, type); else if (['csv', 'txt', 'tsv'].includes(ext)) sheets = [parseTextRecords(await decodeFile(file), ext)]; else throw Error('Formato não suportado. Utilize XLSX, CSV, TSV ou TXT.'); let entries = sheets.flatMap(rows => extractRows(rows, type)), accepted = 0, skipped = 0; for (const item of entries) { const result = type === 'participants' ? addParticipant(item.name, item.ref) : addPrize(item.name, item.quantity, safeImageUrl(item.image)); if (result.ok) accepted++; else skipped++ } persist(); renderAll(); closeModal(); toast(`${accepted} ${type === 'participants' ? 'participante(s)' : 'prêmio(s)'} importado(s) de ${file.name}.${skipped ? ' ' + skipped + ' duplicado(s) ou inválido(s) ignorado(s).' : ''}`, accepted ? 'success' : 'error'); if (!entries.length) toast('Nenhum registro identificado. Confira os cabeçalhos do arquivo.', 'error') } catch (e) { console.error(e); toast('Erro na importação: ' + e.message, 'error') } }
  function randomIndex(max) { if (!Number.isSafeInteger(max) || max < 1 || max > 4294967295) throw Error('Quantidade de participantes inválida.'); if (!crypto?.getRandomValues) throw Error('Este navegador não oferece geração aleatória segura.'); const scale = 4294967296, limit = Math.floor(scale / max) * max; const arr = new Uint32Array(1); let num; do { crypto.getRandomValues(arr); num = arr[0] } while (num >= limit); return num % max }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function beep(frequency = 500, duration = .13, wave = 'sine', gain = .032) { if (!state.settings.sound) return; try { audioContext ??= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); const o = audioContext.createOscillator(), g = audioContext.createGain(); o.type = wave; o.frequency.setValueAtTime(frequency, audioContext.currentTime); g.gain.setValueAtTime(gain, audioContext.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); o.connect(g).connect(audioContext.destination); o.start(); o.stop(audioContext.currentTime + duration) } catch { } }
  function celebrateSound() { if (!state.settings.sound) return;[523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => beep(freq, .24, 'sine', .055), i * 105)) }
  async function runDraw() {
    if (isDrawing) return;
    const prize = getPrize();
    if (!getCanDraw(prize)) { toast('Nenhum participante elegível ou unidade disponível para este prêmio.', 'error'); return }
    if (!crypto?.getRandomValues) { toast('Este navegador não suporta sorteio seguro. Use Chrome ou Edge atualizado.', 'error'); return }
    if (state.settings.confirmDraw && !confirm('Sortear agora o prêmio "' + prize.name + '"?')) return;
    isDrawing = true; renderStage();
    let eligible = getEligible(prize.id); let winnerIndex = randomIndex(eligible.length); let selected = eligible[winnerIndex];
    const digits = Number(state.settings.countdown) || 3; const cd = $('countdownOverlay'), roll = $('rollingOverlay');
    document.activeElement?.blur(); cd.hidden = false; document.body.style.overflow = 'hidden';
    try {
      for (let n = digits; n >= 1; n--) {
        $('countDigit').textContent = n; const digit = $('countDigit'); digit.classList.remove('popping'); void digit.offsetWidth; digit.classList.add('popping');
        beep(n === 1 ? 770 : 470 + ((digits - n) * 80), .12, 'sine', .05); await sleep(930);
      }
      $('countDigit').textContent = '✦'; $('countDigit').classList.remove('popping'); void $('countDigit').offsetWidth; $('countDigit').classList.add('popping');
      beep(980, .21); await sleep(430); cd.hidden = true; roll.hidden = false; await sleep(770);
      // Reconciliar outra aba antes de assinar o resultado. Não há garantia transacional entre abas.
      let latest = null; try { latest = localStorage.getItem(STORAGE_KEY) } catch { }
      if (latest) {
        try {
          const remote = JSON.parse(latest);
          if (remote && Array.isArray(remote.history) && remote.history.length > state.history.length) {
            state = remote; state.settings = { ...DEFAULT_SETTINGS, ...state.settings }; eligible = getEligible(prize.id);
            if (!eligible.length || remaining(prize) === 0) throw Error('Os participantes ou prêmios foram atualizados em outra aba.');
            winnerIndex = randomIndex(eligible.length); selected = eligible[winnerIndex];
          }
        } catch (error) { if (error.message?.includes('outra aba')) throw error }
      }
      const candidateIds = eligible.map(x => x.id); const candidateHash = await sha256(JSON.stringify(candidateIds));
      const prev = state.history.at(-1)?.hash || 'GENESIS';
      const record = { id: uid(), timestamp: new Date().toISOString(), participantId: selected.id, prizeId: prize.id, name: selected.name, prizeName: prize.name, ref: selected.ref || '', audit: { version: 1, seq: state.history.length + 1, eligibleCount: eligible.length, winnerIndex, candidateIds, candidateHash, previousHash: prev, availableBefore: remaining(prize), allowMultipleWins: state.settings.allowMultipleWins, sourceFile: state.source?.file || '' } };
      record.hash = await sha256(JSON.stringify(auditCore(record)));
      state.history.push(record);
      if (!persist()) { state.history.pop(); throw Error('O histórico não foi salvo no navegador. Libere espaço e tente novamente.') }
      roll.hidden = true; isDrawing = false; renderAll(); revealWinner(record); celebrateSound();
    } catch (e) { cd.hidden = true; roll.hidden = true; isDrawing = false; renderAll(); document.body.style.overflow = ''; toast('Sorteio não concluído: ' + e.message, 'error') }
  }
  function revealWinner(record) { $('winnerName').textContent = record.name; $('winnerPrize').textContent = record.prizeName; $('winnerSubtitle').textContent = `RESULTADO REGISTRADO EM ${textDate(record.timestamp)}`; $('winnerOverlay').hidden = false; document.body.style.overflow = 'hidden'; startConfetti() }
  function closeWinner() { if (isDrawing) return; $('winnerOverlay').hidden = true; stopConfetti(); document.body.style.overflow = ''; }
  function startConfetti() { stopConfetti(); if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; const canvas = $('confettiCanvas'), ctx = canvas.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1); const resize = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }; resize(); const palette = ['#ffd53b', '#ffffff', '#6fdcff', '#bbd9ff', '#ffc552']; const width = window.innerWidth, height = window.innerHeight; confettiParticles = Array.from({ length: 170 }, (_, i) => ({ x: Math.random() * width, y: -Math.random() * height * 1.3 - 10, w: 3 + Math.random() * 7, h: 5 + Math.random() * 12, vx: -1.6 + Math.random() * 3.2, vy: 1.9 + Math.random() * 3.8, spin: Math.random() * 6.28, vs: Math.random() * .14 - .07, color: palette[i % palette.length] })); let start = performance.now(); function frame(now) { ctx.clearRect(0, 0, width, height); for (const p of confettiParticles) { p.x += p.vx + Math.sin(now / 500 + p.spin) * .25; p.y += p.vy; p.spin += p.vs; if (p.y > height + 10) { p.y = -20; p.x = Math.random() * width } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin); ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore() } if (now - start < 13000 && !$('winnerOverlay').hidden) confettiFrame = requestAnimationFrame(frame) } confettiFrame = requestAnimationFrame(frame) }
  function stopConfetti() { cancelAnimationFrame(confettiFrame); confettiFrame = 0; const c = $('confettiCanvas'); c.getContext('2d')?.clearRect(0, 0, c.width, c.height) }
  function loadDemo() { if ((state.participants.length || state.prizes.length || state.history.length) && !confirm('A demonstração adicionará nomes e prêmios fictícios à sua base atual. Continuar?')) return; const ps = [['Ana Carolina', '1001'], ['Bruno Ferreira', '1002'], ['Camila Nogueira', '1003'], ['Daniel Oliveira', '1004'], ['Eduarda Costa', '1005'], ['Felipe Martins', '1006'], ['Gabriela Ramos', '1007'], ['Henrique Lima', '1008'], ['Isabela Rodrigues', '1009'], ['João Pedro', '1010'], ['Larissa Almeida', '1011'], ['Marcos Vinícius', '1012']]; for (const [name, ref] of ps) addParticipant(name, ref);[['Notebook Premium', 1], ['Fone Bluetooth', 2], ['Vale-presente', 3]].forEach(([name, quantity]) => addPrize(name, quantity)); persist(); renderAll(); toast('Demonstração carregada. Os dados são fictícios.') }
  function toggleFull() { isTheater = !isTheater; document.body.classList.toggle('theater', isTheater); $('fullscreenBtn').innerHTML = isTheater ? '<span class="tiny-icon">▣</span> Sair do telão' : '<span class="tiny-icon">▣</span> Modo telão'; if (isTheater) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }) } else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => { }) }
  /* SORTALIA | XLSX multi-sheet import with embedded Excel images */
  function zipResolve(source, target) {
    if (!target) return '';
    if (target[0] === '/') return target.slice(1);
    const parts = source.split('/').slice(0, -1);
    for (const component of target.replaceAll('\\', '/').split('/')) {
      if (component === '..') parts.pop(); else if (component && component !== '.') parts.push(component);
    }
    return parts.join('/');
  }
  function xmlTags(node, name) { return [...node.getElementsByTagNameNS('*', name)] }
  function parseXmlText(t) { const doc = new DOMParser().parseFromString(t, 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw Error('XML inválido no arquivo Excel'); return doc }
  async function xlsxRelationships(zip, part) {
    const pos = part.lastIndexOf('/'); const relPath = part.slice(0, pos + 1) + '_rels/' + part.slice(pos + 1) + '.rels';
    const file = zip.file(relPath); if (!file) return {};
    const doc = parseXmlText(await file.async('string')); const map = {};
    for (const el of xmlTags(doc, 'Relationship')) map[el.getAttribute('Id')] = zipResolve(part, el.getAttribute('Target'));
    return map;
  }
  async function readSortaliaWorkbook(file) {
    if (typeof JSZip === 'undefined') throw Error('Leitor XLSX indisponível.');
    if (file.size > 22 * 1024 * 1024) throw Error('Arquivo XLSX superior a 22 MB.');
    const zip = await JSZip.loadAsync(file); if (!zip.file('xl/workbook.xml')) throw Error('A estrutura do XLSX está incompleta.');
    const main = parseXmlText(await zip.file('xl/workbook.xml').async('string'));
    const links = await xlsxRelationships(zip, 'xl/workbook.xml');
    let shared = [];
    if (zip.file('xl/sharedStrings.xml')) {
      const doc = parseXmlText(await zip.file('xl/sharedStrings.xml').async('string'));
      shared = xmlTags(doc, 'si').map(node => xmlTags(node, 't').map(x => x.textContent).join(''));
    }
    const result = [];
    for (const descriptor of xmlTags(main, 'sheet')) {
      const name = descriptor.getAttribute('name') || '';
      const ref = descriptor.getAttribute('id') || descriptor.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const sheetPath = links[ref]; if (!sheetPath || !zip.file(sheetPath)) continue;
      const doc = parseXmlText(await zip.file(sheetPath).async('string'));
      const rows = [];
      for (const row of xmlTags(doc, 'row')) {
        const rowNum = Number(row.getAttribute('r')) - 1;
        if (!Number.isInteger(rowNum) || rowNum < 0 || rowNum > 30000) continue;
        const values = [];
        for (const cell of [...row.children].filter(n => n.localName === 'c')) {
          const col = (cell.getAttribute('r') || '').match(/^([A-Z]+)/i)?.[1] || 'A';
          let index = 0; for (const ch of col.toUpperCase()) index = index * 26 + ch.charCodeAt(0) - 64; index--;
          if (index > 45) continue;
          const type = cell.getAttribute('t'); let value = xmlTags(cell, 'v')[0]?.textContent ?? '';
          if (type === 'inlineStr') value = xmlTags(cell, 't').map(x => x.textContent).join('');
          else if (type === 's') value = shared[Number(value)] ?? '';
          values[index] = String(value);
        }
        rows[rowNum] = values;
      }
      const images = {};
      const sheetRels = await xlsxRelationships(zip, sheetPath);
      for (const drawingEl of xmlTags(doc, 'drawing')) {
        const id = drawingEl.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        const drawingPath = sheetRels[id]; if (!drawingPath || !zip.file(drawingPath)) continue;
        const drawingDoc = parseXmlText(await zip.file(drawingPath).async('string'));
        const drawingLinks = await xlsxRelationships(zip, drawingPath);
        for (const anchor of drawingDoc.documentElement.children) {
          const from = xmlTags(anchor, 'from')[0];
          const row = Number(from && xmlTags(from, 'row')[0]?.textContent);
          const col = Number(from && xmlTags(from, 'col')[0]?.textContent);
          const image = xmlTags(anchor, 'blip')[0];
          const imageId = image?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
          const path = drawingLinks[imageId]; if (!imageId || !path || !zip.file(path) || !Number.isInteger(row)) continue;
          const ext = path.split('.').pop().toLowerCase();
          if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) continue;
          const resource = zip.file(path); if (resource._data?.uncompressedSize > 3 * 1024 * 1024) continue;
          const content = await resource.async('base64');
          if (content.length > 4 * 1024 * 1024) continue;
          images[row] = { col, url: 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + content };
          // For prize sheets, C (Foto) contains an inserted picture, not a cell value.
          if (normalize(name) === 'premios' && col === 2) { rows[row] ??= []; rows[row][2] = images[row].url; }
        }
      }
      result.push({ name, rows: rows.map(r => r || []), images });
    }
    return result;
  }
  async function importCompleteModel(file) {
    if (!file) return;
    try {
      const sheets = await readSortaliaWorkbook(file);
      const part = sheets.find(x => normalize(x.name) === 'participantes');
      const awards = sheets.find(x => normalize(x.name) === 'premios');
      if (!part || !awards) throw Error('O arquivo precisa ter as abas Participantes e Prêmios.');
      const directions = sheets.find(x => normalize(x.name) === 'instrucoes'); const isDemo = normalize(JSON.stringify(directions?.rows || [])).includes('ficticios');
      if (normalizeHeader(part.rows[0]?.[0]) !== 'nome' || normalizeHeader(awards.rows[0]?.[0]) !== 'premio' || normalizeHeader(awards.rows[0]?.[1]) !== 'quantidade') throw Error('Cabeçalhos diferentes do modelo. Esperado: Nome; Prêmio, Quantidade, Foto.');
      const pList = [], pKeys = new Set();
      for (let i = 1; i < part.rows.length; i++) {
        const nm = String(part.rows[i]?.[0] ?? '').trim().replace(/\s+/g, ' ');
        if (!nm) continue;
        if (nm.length > 130) throw Error('Nome acima de 130 caracteres na linha ' + (i + 1));
        const key = normalize(nm); if (pKeys.has(key)) continue;
        pKeys.add(key); pList.push({ id: uid(), name: nm, ref: '' });
      }
      const prizes = [], prizeKeys = new Set(); let total = 0, photoCount = 0;
      for (let i = 1; i < awards.rows.length; i++) {
        const row = awards.rows[i] || [];
        const nm = String(row[0] ?? '').trim().replace(/\s+/g, ' ');
        if (!nm) continue;
        const raw = String(row[1] ?? '').trim(); const qt = raw ? Number(raw.replace(',', '.')) : 1;
        if (nm.length > 160 || !Number.isInteger(qt) || qt < 1 || qt > 100000) throw Error('Quantidade ou prêmio inválido na linha ' + (i + 1));
        if (prizeKeys.has(normalize(nm))) throw Error('Prêmio repetido: ' + nm);
        prizeKeys.add(normalize(nm)); total += qt;
        let image = safeImageUrl(row[2] || awards.images[i]?.url || '');
        if (image) photoCount++;
        prizes.push({ id: uid(), name: nm, quantity: qt, image });
      }
      if (!pList.length || !prizes.length) throw Error('Planilha sem participantes ou prêmios.');
      if (total > pList.length) throw Error(`O modelo possui ${total} unidades para apenas ${pList.length} participantes únicos. Sem repetição, isso não é permitido.`);
      if (state.history.length || state.participants.length || state.prizes.length) {
        if (!confirm(`Importar ${pList.length} participantes e ${total} unidades de ${prizes.length} prêmios (${photoCount} imagens)?\n\nIsso SUBSTITUIRÁ a base atual, inclusive o histórico de vencedores. Faça um backup antes, se necessário.`)) return;
      }
      state = { ...freshState(), participants: pList, prizes, selectedPrizeId: prizes[0].id, source: { file: file.name, loadedAt: new Date().toISOString(), photoCount, isDemo }, settings: { ...DEFAULT_SETTINGS, allowMultipleWins: false } };
      persist(); renderAll(); closeModal();
      toast(`Modelo importado: ${pList.length} participantes, ${prizes.length} prêmios, ${total} unidades e ${photoCount} fotos.`, 'success');
    } catch (e) { console.error(e); toast('Erro no modelo Sortalia: ' + e.message, 'error') }
  }
  /* Registros verificáveis por encadeamento SHA-256, sem pretensão de auditoria externa */
  function sha256Software(value) {
    const input = new TextEncoder().encode(String(value)); const total = Math.ceil((input.length + 9) / 64) * 64;
    const buf = new Uint8Array(total); buf.set(input); buf[input.length] = 128;
    const view = new DataView(buf.buffer); const bitlen = input.length * 8;
    view.setUint32(total - 8, Math.floor(bitlen / 4294967296), false); view.setUint32(total - 4, bitlen >>> 0, false);
    const k = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotr = (v, n) => (v >>> n) | (v << (32 - n)); const w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++)w[i] = view.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>> 0; }
      let [a, b, c, d, e, f, g, j] = h;
      for (let i = 0; i < 64; i++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25); const choice = (e & f) ^ (~e & g);
        const t1 = (j + s1 + choice + k[i] + w[i]) >>> 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22); const majority = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (s0 + majority) >>> 0;
        j = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      const next = [a, b, c, d, e, f, g, j]; for (let i = 0; i < 8; i++)h[i] = (h[i] + next[i]) >>> 0;
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
  }

  async function sha256(text) {
    if (!crypto?.subtle?.digest) return sha256Software(text);
    const bytes = new TextEncoder().encode(text);
    const buffer = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(buffer)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function auditCore(h) {
    return { id: h.id, timestamp: h.timestamp, participantId: h.participantId, prizeId: h.prizeId, name: h.name, prizeName: h.prizeName, ref: h.ref || '', audit: h.audit };
  }
  async function verifyLocalHistory() {
    let prev = 'GENESIS', legacy = 0; const failures = []; const seen = new Set();
    for (let i = 0; i < state.history.length; i++) {
      const h = state.history[i];
      if (!h.audit || !h.hash) { legacy++; prev = h.hash || 'SEM_HASH'; continue; }
      if (h.audit.previousHash !== prev) failures.push('Encadeamento divergente no registro ' + (i + 1));
      if (h.audit.seq !== i + 1) failures.push('Ordem divergente no registro ' + (i + 1));
      if (h.audit.eligibleCount < 1 || h.audit.winnerIndex < 0 || h.audit.winnerIndex >= h.audit.eligibleCount) failures.push('Índice inválido no registro ' + (i + 1));
      if (Array.isArray(h.audit.candidateIds)) {
        if (h.audit.candidateIds.length !== h.audit.eligibleCount || new Set(h.audit.candidateIds).size !== h.audit.eligibleCount) failures.push('Lista de elegíveis inválida no registro ' + (i + 1));
        if (h.audit.candidateIds[h.audit.winnerIndex] !== h.participantId) failures.push('Vencedor divergente do índice no registro ' + (i + 1));
        if (await sha256(JSON.stringify(h.audit.candidateIds)) !== h.audit.candidateHash) failures.push('Hash dos elegíveis divergente no registro ' + (i + 1));
      } else failures.push('Lista de elegíveis ausente no registro ' + (i + 1));
      try { if ((await sha256(JSON.stringify(auditCore(h)))) !== h.hash) failures.push('Resumo SHA-256 divergente no registro ' + (i + 1)); }
      catch (e) { failures.push('Impossível recalcular SHA-256: ' + e.message) }
      if (h.audit.allowMultipleWins === false && seen.has(h.participantId)) failures.push('Participante repetido no registro ' + (i + 1));
      seen.add(h.participantId); prev = h.hash;
    }
    const byPrize = {}; for (const h of state.history) byPrize[h.prizeId] = (byPrize[h.prizeId] || 0) + 1;
    for (const p of state.prizes) if ((byPrize[p.id] || 0) > p.quantity) failures.push('Prêmio com quantidade excedida: ' + p.name);
    return { ok: failures.length === 0 && legacy === 0, failures, legacy, lastHash: state.history.at(-1)?.hash || '', checked: state.history.length };
  }
  /* Renderer PDF A4 vetorial, totalmente offline, Helvetica / WinAnsi. */
  function makeSortaliaPdf({ verification }) {
    const W = 595.28, H = 841.89, navy = '#071E48', blue = '#075DE5', gold = '#FFD63F', grey = '#647998', pale = '#EDF4FF', white = '#FFFFFF', soft = '#F7F9FE';
    const normHex = (color) => [1, 3, 5].map(p => parseInt(color.slice(p, p + 2), 16) / 255).map(n => n.toFixed(3)).join(' ');
    const pdfLiteral = (v) => String(v ?? '').replace(/[\r\n\t]/g, ' ').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2022\u00b7]/g, '-').replace(/[\u2700-\u27bf\ud800-\udfff]/g, '').replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '?').replace(/([\\()])/g, '\\$1');
    const objects = [null], pages = [];
    const reserve = () => { objects.push(''); return objects.length - 1 };
    const put = (id, v) => { objects[id] = v };
    const catalogId = reserve(), pagesId = reserve(), fontRegularId = reserve(), fontBoldId = reserve();
    put(fontRegularId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    put(fontBoldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    let commands = []; let pageNumber = 0;
    const rect = (x, y, w, h, c) => { commands.push(`${normHex(c)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`) };
    const line = (x, y, X, Y, c, width = 1) => { commands.push(`${normHex(c)} RG ${width} w ${x} ${y} m ${X} ${Y} l S`) };
    const text = (value, x, y, size = 11, c = navy, bold = false) => { commands.push(`${normHex(c)} rg BT /${bold ? 'FB' : 'FR'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfLiteral(value)}) Tj ET`) };
    const dots = (value, limit) => { let v = String(value ?? ''); if (v.length > limit) v = v.slice(0, limit - 1) + '...'; return v };
    function beginPage(first = false) {
      if (pageNumber) finishPage(); pageNumber++; commands = [];
      rect(0, 0, W, H, white); rect(0, H - 16, W, 16, blue); rect(34, H - 17, 78, 5, gold);
      if (first) {
        rect(0, 610, W, 220, navy); rect(W - 93, 684, 93, 146, blue); rect(W - 59, 748, 59, 82, gold);
        text('SORTALIA.', 38, 758, 31, white, true); text('SORTEIOS COM TRANSPARÊNCIA', 39, 731, 8, '#B4C5E8', true);
        text('COMPROVANTE DE', 38, 681, 24, white, true); text('VALIDAÇÃO DO SORTEIO', 38, 651, 22, white, true);
        text('GERADO LOCALMENTE | DOCUMENTO DE RASTREABILIDADE', 39, 627, 8, '#BDD0ED');
      } else {
        rect(0, 744, W, 81, navy); text('SORTALIA.', 38, 786, 22, white, true); text('RELATÓRIO DE RESULTADOS', 38, 759, 9, '#A9C3E8', true);
      }
    }
    function finishPage() {
      const pId = reserve(), cId = reserve();
      text('SORTALIA  /  COMPROVANTE GERADO NO NAVEGADOR', 38, 29, 7, grey, true);
      text(`PÁGINA ${pageNumber}`, 501, 29, 7, grey, true); line(38, 45, W - 38, 45, '#E5ECF6', .7);
      const stream = commands.join('\n') + '\n';
      put(cId, `<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
      put(pId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /FR ${fontRegularId} 0 R /FB ${fontBoldId} 0 R >> >> /Contents ${cId} 0 R >>`);
      pages.push(pId);
    }
    const count = state.history.length, total = state.prizes.reduce((a, p) => a + p.quantity, 0), complete = total > 0 && count === total;
    const status = verification.failures.length ? 'INCONSISTÊNCIA DETECTADA' : state.source?.isDemo ? 'DEMONSTRAÇÃO - DADOS FICTÍCIOS' : verification.legacy ? 'REGISTROS LEGADOS' : verification.ok ? 'CONSISTÊNCIA LOCAL CONFERIDA' : 'INCOMPLETO';
    const issued = new Date(); const dateLine = issued.toLocaleString('pt-BR');
    const serial = `SORT-${issued.toISOString().slice(0, 10).replaceAll('-', '')}-${(verification.lastHash || 'SEMREGISTRO').slice(0, 10).toUpperCase()}`;
    const sNames = new Set(state.history.map(x => x.participantId));
    beginPage(true);
    rect(37, 559, 521, 39, verification.ok && !state.source?.isDemo ? '#EAF7ED' : verification.failures.length ? '#FFF0EF' : '#FFF7DC');
    text(status, 52, 574, 10, verification.ok && !state.source?.isDemo ? '#176846' : verification.failures.length ? '#A62426' : '#8A6419', true);
    text(complete ? 'SORTEIO FINALIZADO' : 'SORTEIO EM ANDAMENTO', 383, 574, 8, navy, true);
    const tiles = [['PARTICIPANTES', state.participants.length], ['UNIDADES PREVISTAS', total], ['RESULTADOS', count], ['VENCEDORES ÚNICOS', sNames.size]];
    for (let i = 0; i < 4; i++) { const x = 38 + i * 132; rect(x, 466, 123, 80, i % 2 ? pale : soft); rect(x, 540, 26, 6, i === 3 ? gold : blue); text(tiles[i][0], x + 9, 513, 7, grey, true); text(tiles[i][1], x + 9, 482, 28, navy, true) }
    text('IDENTIFICAÇÃO DO COMPROVANTE', 38, 441, 9, blue, true);
    text(serial, 38, 418, 14, navy, true); text('Emitido em: ' + dateLine, 38, 401, 9, grey);
    text('Origem dos dados: ' + dots(state.source?.file || 'cadastro manual / local', 58), 38, 383, 9, grey);
    if (state.source?.isDemo) text('MODELO FICTÍCIO: não utilizar estes resultados como sorteio real.', 38, 370, 8, '#946A10', true);
    text('RESULTADOS REGISTRADOS', 38, 352, 15, navy, true);
    line(38, 341, 557, 341, gold, 3);
    let y = 315;
    function resultsHeader() { rect(38, y - 2, 519, 25, blue); text('Nº', 48, y + 5, 8, white, true); text('PARTICIPANTE', 82, y + 5, 8, white, true); text('PRÊMIO', 277, y + 5, 8, white, true); text('DATA E HORA', 442, y + 5, 8, white, true); y -= 38; }
    resultsHeader();
    for (let i = 0; i < state.history.length; i++) {
      const h = state.history[i];
      if (y < 112) { beginPage(false); text('CONTINUAÇÃO DOS RESULTADOS', 38, 704, 15, navy, true); y = 664; resultsHeader() }
      rect(38, y - 9, 519, 34, i % 2 ? soft : pale);
      text(String(i + 1).padStart(2, '0'), 49, y + 2, 9, blue, true);
      text(dots(h.name, 28), 82, y + 2, 9, navy, true);
      text(dots(h.prizeName, 22), 277, y + 2, 8, navy);
      text(dots(textDate(h.timestamp), 20), 442, y + 2, 8, grey);
      y -= 43;
    }
    if (!state.history.length) { text('Ainda não há resultados registrados.', 50, y - 9, 11, grey); y -= 45 }
    function ensureRoom(space) { if (y < space) { beginPage(false); y = 691; } }
    y -= 12; ensureRoom(250);
    text('REGRAS E MÉTODO DE SELEÇÃO', 38, y, 14, navy, true); y -= 20;
    line(38, y, 557, y, gold, 2.4); y -= 21;
    const facts = [
      'Seleção uniforme: Web Crypto getRandomValues, sem viés de módulo (rejeição).',
      'Elegibilidade: ' + (state.settings.allowMultipleWins ? 'repetição permitida entre prêmios distintos' : 'cada participante pode ganhar somente uma vez') + '.',
      'Cada resultado registra índice do vencedor, quantidade de elegíveis e hash SHA-256.',
      'Encadeamento: cada registro incorpora o hash anterior para checagem de sequência.',
      'Prêmios e quantidades: ' + state.prizes.length + ' tipos; ' + total + ' unidades planejadas.'
    ];
    for (const f of facts) { ensureRoom(135); text('- ' + dots(f, 102), 43, y, 9, grey); y -= 20; }
    y -= 11; ensureRoom(170);
    text('VALIDAÇÃO E OBSERVAÇÕES', 38, y, 14, navy, true); y -= 26;
    const notes = verification.failures.length ? verification.failures : verification.legacy ? [`${verification.legacy} registro(s) sem trilha criptográfica (formato anterior).`] : ['Resumo SHA-256 e encadeamento recomputados na exportação: ' + (verification.ok ? 'sem divergências.' : 'parciais.')];
    for (const n of notes.slice(0, 6)) { ensureRoom(120); text('- ' + dots(n, 95), 42, y, 9, verification.ok ? navy : '#AF4228'); y -= 18; }
    ensureRoom(115);
    text('A consistência é verificada somente contra os dados presentes neste navegador.', 42, y - 6, 8, grey);
    text('Não há assinatura digital, servidor independente ou comprovação contra adulteração externa.', 42, y - 20, 8, grey); y -= 58;
    if (state.history.length) {
      ensureRoom(170); text('TRILHA DE RASTREABILIDADE', 38, y, 14, navy, true); y -= 18; line(38, y, 557, y, gold, 2.4); y -= 24;
      for (let i = 0; i < state.history.length; i++) {
        ensureRoom(142);
        const h = state.history[i]; text(`${String(i + 1).padStart(2, '0')}  ${dots(h.name, 42)}  |  ${dots(h.prizeName, 24)}`, 42, y, 8, navy, true); y -= 13;
        text(`ID: ${dots(h.id, 90)}`, 42, y, 7, grey); y -= 13;
        text('Elegíveis: ' + (h.audit?.eligibleCount ?? '?') + '  |  Selecionado: ' + (h.audit?.winnerIndex != null ? h.audit.winnerIndex + 1 : '?') + '  |  SHA-256 do registro:', 42, y, 7, grey); y -= 12;
        text(h.hash || 'sem registro criptográfico', 42, y, 7, grey); y -= 12;
        text('SHA-256 dos elegíveis: ' + (h.audit?.candidateHash || 'não disponível'), 42, y, 7, grey); y -= 26;
      }
    }
    finishPage();
    put(pagesId, `<< /Type /Pages /Kids [${pages.map(id => id + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
    put(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let doc = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offsets = [0];
    for (let n = 1; n < objects.length; n++) { offsets[n] = doc.length; doc += `${n} 0 obj\n${objects[n]}\nendobj\n` }
    const start = doc.length; doc += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let n = 1; n < objects.length; n++)doc += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    doc += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${start}\n%%EOF`;
    return new Uint8Array([...doc].map(c => c.charCodeAt(0) & 255));
  }
  async function exportCertificatePDF() {
    if (!state.history.length) { toast('O comprovante estará disponível após o primeiro sorteio.', 'error'); return }
    try {
      const verification = await verifyLocalHistory();
      const bytes = makeSortaliaPdf({ verification });
      const day = new Date().toISOString().slice(0, 10);
      downloadFile(`Sortalia_Comprovante_${day}.pdf`, 'application/pdf', bytes);
      toast(verification.ok ? 'Comprovante PDF gerado com validação local.' : 'PDF exportado com ressalvas na consistência do histórico.', verification.ok ? 'success' : 'error');
    } catch (e) { console.error(e); toast('Falha na geração do PDF: ' + e.message, 'error') }
  }

  $('importModelBtn').addEventListener('click', () => $('modelFile').click());
  $('modelFile').addEventListener('change', async e => { const file = e.target.files[0]; e.target.value = ''; await importCompleteModel(file) });
  $('certificateBtn').addEventListener('click', exportCertificatePDF);
  $('winnerPDFBtn').addEventListener('click', exportCertificatePDF);
  $('addParticipantBtn').addEventListener('click', participantModal); $('addPrizeBtn').addEventListener('click', () => prizeModal()); $('manageParticipantsBtn').addEventListener('click', manageParticipants); $('managePrizesBtn').addEventListener('click', managePrizes); $('importParticipantsBtn').addEventListener('click', () => $('participantFile').click()); $('importPrizesBtn').addEventListener('click', () => $('prizeFile').click()); $('participantFile').addEventListener('change', async e => { const file = e.target.files[0]; e.target.value = ''; await importFile(file, 'participants') }); $('prizeFile').addEventListener('change', async e => { const file = e.target.files[0]; e.target.value = ''; await importFile(file, 'prizes') }); $('restoreFile').addEventListener('change', async e => { const file = e.target.files[0]; e.target.value = ''; await restoreBackup(file) }); $('drawBtn').addEventListener('click', runDraw); $('historyBtn').addEventListener('click', historyModal); $('winnerHistoryBtn').addEventListener('click', () => { closeWinner(); historyModal() }); $('winnerNextBtn').addEventListener('click', closeWinner); $('closeWinnerBtn').addEventListener('click', closeWinner); $('modalClose').addEventListener('click', closeModal); ui.modal.addEventListener('click', e => { if (e.target === ui.modal) closeModal() }); $('rulesBtn').addEventListener('click', rulesModal); $('soundBtn').addEventListener('click', () => { state.settings.sound = !state.settings.sound; persist(); renderBrand(); if (state.settings.sound) beep(780, .12); toast(state.settings.sound ? 'Som ativado.' : 'Som desativado.') }); $('fullscreenBtn').addEventListener('click', toggleFull); $('exportBaseBtn').addEventListener('click', exportBackup); $('restoreBtn').addEventListener('click', () => $('restoreFile').click()); $('resetBtn').addEventListener('click', resetModal); $('newDrawBtn').addEventListener('click', eventManagerModal); $('importHistoryBtn').addEventListener('click', () => $('restoreFile').click()); $('demoBtn').addEventListener('click', loadDemo); document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!ui.modal.hidden) closeModal(); else if (!$('winnerOverlay').hidden) closeWinner(); return } if (e.code === 'Space' && ui.modal.hidden && $('winnerOverlay').hidden && !isDrawing && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) { e.preventDefault(); if (!ui.drawBtn.disabled) runDraw() } });
  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY && !isDrawing) { state = loadState(); renderAll(); toast('Base sincronizada com outra aba.') } }); document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && isTheater) { isTheater = false; document.body.classList.remove('theater'); $('fullscreenBtn').innerHTML = '<span class="tiny-icon">▣</span> Modo telão' } });
  renderAll();
})();
