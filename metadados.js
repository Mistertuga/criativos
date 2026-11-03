/* Separador «Limpar metadados» da app dos criativos (02/11/2026).
   Tudo acontece neste computador: os ficheiros nunca saem do browser.
   Vídeos MP4, MOV e M4V: o rasto é apagado no próprio sítio, sem mudar o tamanho de nada,
   por isso a imagem e o som ficam byte a byte iguais. Imagens JPG, PNG e WebP: a mesma
   limpeza sem perdas da ferramenta da Anna Utrecht. */
(function () {
  'use strict';

  // ---------- bytes ----------
  const u32 = (d, o) => d[o] * 16777216 + (d[o + 1] << 16) + (d[o + 2] << 8) + d[o + 3];
  const u16 = (d, o) => (d[o] << 8) | d[o + 1];
  const ascii = (d, o, n) => String.fromCharCode(...d.subarray(o, o + n));
  const hex = (d, o, n) => Array.from(d.subarray(o, o + n), (b) => b.toString(16).padStart(2, '0')).join('');
  const join = (parts) => { const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const UTF8 = new TextDecoder('utf-8');
  const texto = (d, o, n) => n > 0 ? UTF8.decode(d.subarray(o, o + n)).replace(/[\u0000-\u001f\u007f-\u009f�]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const curto = (s, n = 36) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const zera = (d, ini, fim) => { if (fim > ini) d.fill(0, ini, fim); };
  const dataPt = (ms) => { const x = new Date(ms); return isNaN(x) ? '' : x.toLocaleDateString('pt-PT'); };

  function achados() {
    const m = new Map();
    const add = (rot, val) => { if (!m.has(rot)) m.set(rot, new Set()); if (val) m.get(rot).add(curto(val)); };
    const lista = () => [...m].map(([rot, vals]) => ({ rot, vals: [...vals] }));
    return { add, lista };
  }

  // =====================================================================
  // Vídeos (MP4, MOV, M4V): caixas do formato ISO / QuickTime
  // =====================================================================
  function* caixas(d, ini, fim) {
    let o = ini;
    while (o + 8 <= fim) {
      let tam = u32(d, o), cab = 8;
      const t = ascii(d, o + 4, 4);
      if (tam === 1) { if (o + 16 > fim) return; tam = u32(d, o + 8) * 4294967296 + u32(d, o + 12); cab = 16; }
      else if (tam === 0) tam = fim - o;
      if (tam < cab || o + tam > fim) return;
      yield { o, t, ini: o + cab, fim: o + tam };
      o += tam;
    }
  }

  const TOPO_VIDEO = new Set(['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot', 'uuid', 'styp', 'sidx', 'moof']);
  const TOPO_OK = new Set(['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide', 'moof', 'mfra', 'sidx', 'ssix', 'styp', 'emsg', 'pdin', 'uuid', 'meta', 'prft']);
  const IMAGEM_BMFF = /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1|avif|avis|crx )$/;
  const CONTENTORES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'moof', 'traf', 'mvex', 'mfra', 'tref']);
  const UUID_NOME = { be7acfcb97a942e89c71999491e3afac: 'XMP', d8fec3d61b0e483c92975828877ec481: 'C2PA' };
  const UUID_PRECISOS = new Set([ // PIFF e Smooth Streaming: fazem falta para tocar, ficam
    'a2394f525a9b4f14a2446c427c648df4', '8974dbce7be74c5184f97148f9882554', 'd08a4f1810f34a82b6c832d8aba183d3',
    '6d1d9b0542d544e680e2141daff757b2', 'd4807ef2ca3946958e5426cb9e46a79f',
  ]);
  const ROTULO = {
    '©too': 'programa', '©swr': 'programa', '©enc': 'programa', '©fmt': 'programa', tool: 'programa',
    '©mak': 'telemóvel ou câmara', '©mod': 'telemóvel ou câmara', smta: 'telemóvel ou câmara', FIRM: 'telemóvel ou câmara', LENS: 'telemóvel ou câmara', CNTH: 'telemóvel ou câmara', CNDA: 'telemóvel ou câmara',
    '©xyz': 'GPS', loci: 'GPS', 'GPS ': 'GPS',
    '©day': 'datas',
    '©nam': 'título', titl: 'título', name: 'título',
    '©cmt': 'comentário', '©des': 'comentário', '©inf': 'comentário', desc: 'comentário', ldes: 'comentário', dscp: 'comentário',
    '©ART': 'autor', '©aut': 'autor', '©wrt': 'autor', auth: 'autor',
    '©cpy': 'direitos', cprt: 'direitos',
    covr: 'imagem de capa', 'XMP_': 'XMP',
  };
  const CHAVES_APPLE = [
    [/make|model/, 'telemóvel ou câmara'], [/software/, 'programa'], [/creationdate/, 'datas'], [/location/, 'GPS'],
    [/author|artist/, 'autor'], [/title|displayname/, 'título'], [/comment|description/, 'comentário'], [/./, 'etiqueta'],
  ];
  const X264 = [0xdc, 0x45, 0xe9, 0xbd, 0xe6, 0xd9, 0x48, 0xb7, 0x96, 0x2c, 0xd8, 0x20, 0xd9, 0x23, 0xee, 0xef];
  const X265 = [0x2c, 0xa2, 0xde, 0x09, 0xb5, 0x17, 0x47, 0xdb, 0xbb, 0x55, 0xa4, 0xfe, 0x7f, 0xc2, 0xfc, 0x4e];
  const DESDE_1904 = 2082844800;
  const igual = (d, o, arr) => arr.every((v, k) => d[o + k] === v);

  // a caixa passa a «free», que os leitores ignoram, e o conteúdo fica a zeros: o tamanho não muda
  function apaga(d, b) { d[b.o + 4] = 0x66; d[b.o + 5] = 0x72; d[b.o + 6] = 0x65; d[b.o + 7] = 0x65; zera(d, b.ini, b.fim); }

  // onde começa cada pedaço de imagem e som (stco/co64): nunca se apaga uma caixa que tenha um
  function pedacosDeDados(d) {
    const out = [];
    const anda = (ini, fim) => {
      for (const b of caixas(d, ini, fim)) {
        if (b.t === 'stco' || b.t === 'co64') {
          const n = u32(d, b.ini + 4), largo = b.t === 'co64';
          for (let k = 0, o = b.ini + 8; k < n && o + (largo ? 8 : 4) <= b.fim; k++, o += largo ? 8 : 4) out.push(largo ? u32(d, o) * 4294967296 + u32(d, o + 4) : u32(d, o));
        } else if (b.t === 'moov' || b.t === 'trak' || b.t === 'mdia' || b.t === 'minf' || b.t === 'stbl') anda(b.ini, b.fim);
      }
    };
    anda(0, d.length);
    return out.sort((a, b) => a - b);
  }
  function temDados(ped, b) { // há algum pedaço a começar dentro desta caixa?
    let lo = 0, hi = ped.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ped[mid] < b.o) lo = mid + 1; else hi = mid; }
    return lo < ped.length && ped[lo] < b.fim;
  }

  function inicioMeta(d, b) { // no MP4 a «meta» tem 4 bytes de versão antes das caixas; no QuickTime não
    return ascii(d, b.ini + 4, 4) === 'hdlr' ? b.ini : b.ini + 4;
  }
  function lerMeta(d, b, add) {
    const ini = inicioMeta(d, b), chaves = [];
    let temLista = false;
    for (const c of caixas(d, ini, b.fim)) {
      if (c.t !== 'keys') continue;
      const n = u32(d, c.ini + 4);
      for (let k = 0, o = c.ini + 8; k < n && o + 8 <= c.fim; k++) { const tam = u32(d, o); if (tam < 8) break; chaves.push(ascii(d, o + 8, tam - 8)); o += tam; }
    }
    for (const c of caixas(d, ini, b.fim)) {
      if (c.t !== 'ilst') continue;
      temLista = true;
      for (const it of caixas(d, c.ini, c.fim)) {
        const idx = u32(d, it.o + 4), nome = chaves.length && idx >= 1 && idx <= chaves.length ? chaves[idx - 1] : it.t;
        let rot = ROTULO[nome];
        if (!rot && /^com\./.test(nome)) rot = CHAVES_APPLE.find(([re]) => re.test(nome.toLowerCase()))[1];
        let val = '';
        for (const v of caixas(d, it.ini, it.fim)) if (v.t === 'data' && (u32(d, v.ini) & 0xffffff) <= 1) val = texto(d, v.ini + 8, v.fim - v.ini - 8);
        add(rot || 'etiqueta', rot === 'imagem de capa' ? '' : val);
      }
    }
    if (!temLista && d.subarray(ini, b.fim).some((x) => x)) add('dados privados', '');
  }
  function lerUdta(d, b, add) {
    let algum = false;
    for (const c of caixas(d, b.ini, b.fim)) {
      algum = true;
      if (c.t === 'meta') { lerMeta(d, c, add); continue; }
      const rot = ROTULO[c.t] || 'etiqueta';
      let val = '';
      if (c.t.charCodeAt(0) === 0xa9 && c.fim - c.ini > 4) val = texto(d, c.ini + 4, Math.min(u16(d, c.ini), c.fim - c.ini - 4));
      add(rot, rot === 'XMP' ? '' : val);
    }
    if (!algum && d.subarray(b.ini, b.fim).some((x) => x)) add('dados privados', '');
  }
  function lerTempo(d, b, add, limpar) { // mvhd, tkhd e mdhd: data de criação e de alteração
    const v1 = d[b.ini] === 1, o = b.ini + 4, n = v1 ? 8 : 4;
    for (const p of [o, o + n]) {
      const s = v1 ? u32(d, p) * 4294967296 + u32(d, p + 4) : u32(d, p);
      if (s) add('datas', s > DESDE_1904 ? dataPt((s - DESDE_1904) * 1000) : '');
    }
    if (limpar) zera(d, o, o + 2 * n);
  }
  function lerHdlr(d, b, add, limpar) { // nome de quem gravou cada faixa (VideoHandler, Core Media Video…)
    const fab = ascii(d, b.ini + 12, 4);
    if (/^[A-Za-z]{4}$/.test(fab)) add('programa', fab === 'appl' ? 'Apple' : fab);
    let o = b.ini + 24, n = b.fim - o;
    if (n > 0 && d[o] && d[o] === n - 1) { o++; n--; } // nome à QuickTime, com o tamanho à frente
    const nome = texto(d, o, n);
    if (nome) add('nomes das faixas', nome);
    if (limpar) zera(d, b.ini + 12, b.fim);
  }
  function lerStsd(d, b, add, limpar, faixa) { // fabricante e nome do codificador de cada faixa
    if (faixa !== 'vide' && faixa !== 'soun') return;
    for (const e of caixas(d, b.ini + 8, b.fim)) {
      if (e.fim - e.ini < 16) continue;
      const fab = ascii(d, e.ini + 12, 4);
      if (/^[A-Za-z]{4}$/.test(fab)) add('programa', fab === 'FFMP' ? 'FFmpeg' : fab === 'appl' ? 'Apple' : fab);
      if (limpar) zera(d, e.ini + 12, e.ini + 16);
      if (faixa === 'vide' && e.fim - e.ini >= 74) {
        const p = e.ini + 42, n = d[p];
        const nome = n > 0 && n < 32 ? texto(d, p + 1, n) : texto(d, p, 32);
        if (nome) add('codificador', nome);
        if (limpar) zera(d, p, p + 32);
      }
    }
  }
  function lerMdat(d, ini, fim, add, limpar) { // assinaturas dentro da imagem e do som: o texto passa a espaços, do mesmo tamanho
    for (let i = ini; i < fim - 12; i++) {
      const c = d[i];
      if (c === 0x78 && d[i + 1] === 0x32 && d[i + 2] === 0x36 && (d[i + 3] === 0x34 || d[i + 3] === 0x35)) {
        const s = ascii(d, i, 11);
        if (s === 'x264 - core' || s === 'x265 (build') {
          let j = i; while (j < fim && j - i < 16384 && d[j] !== 0) j++;
          add('codificador', texto(d, i, Math.min(j - i, 60)).replace(/ - H\.26.*$/, ''));
          if (limpar) {
            d.fill(0x20, i, j);
            if (i - 16 >= ini && igual(d, i - 16, s[3] === '4' ? X264 : X265)) d.fill(0x20, i - 16, i);
          }
          i = j; continue;
        }
      }
      if (c === 0x4c && d[i + 1] === 0x61 && d[i + 2] === 0x76 && (d[i + 3] === 0x63 || d[i + 3] === 0x66) && d[i + 4] >= 0x30 && d[i + 4] <= 0x39) {
        let j = i + 4; while (j < fim && j - i < 40 && ((d[j] >= 0x30 && d[j] <= 0x39) || d[j] === 0x2e)) j++;
        const s = ascii(d, i, j - i);
        if (/^Lav[cf]\d+\.\d+\.\d+$/.test(s)) { add('codificador', s); if (limpar) d.fill(0x20, i, j); i = j; continue; }
      }
    }
  }

  // lê (e, com limpar, apaga) tudo o que um vídeo esconde; devolve o que encontrou antes de apagar
  function video(d, limpar) {
    if (ascii(d, 4, 4) === 'ftyp' && IMAGEM_BMFF.test(ascii(d, 8, 4))) throw new Error('HEIC e AVIF não entram, convertê-los perdia qualidade');
    const { add, lista } = achados();
    const ped = pedacosDeDados(d);
    const tira = (b) => { if (!limpar) return; if (temDados(ped, b)) add('ficou por segurança', b.t); else apaga(d, b); };
    const anda = (ini, fim, topo, faixa) => {
      for (const b of caixas(d, ini, fim)) {
        const t = b.t;
        if (t === 'mdat') lerMdat(d, b.ini, b.fim, add, limpar);
        else if (t === 'udta') { lerUdta(d, b, add); tira(b); }
        else if (t === 'meta') { lerMeta(d, b, add); tira(b); }
        else if (t === 'uuid') { const id = hex(d, b.ini, 16); if (!UUID_PRECISOS.has(id)) { add(UUID_NOME[id] || 'dados privados', ''); tira(b); } }
        else if (t === 'XMP_') { add('XMP', ''); tira(b); }
        else if (t === 'prft') { add('datas', ''); tira(b); }
        else if (t === 'free' || t === 'skip' || t === 'wide') { if (d.subarray(b.ini, b.fim).some((x) => x)) { add('blocos livres com dados', ''); if (limpar && !temDados(ped, b)) zera(d, b.ini, b.fim); } }
        else if (t === 'mvhd' || t === 'tkhd' || t === 'mdhd') lerTempo(d, b, add, limpar);
        else if (t === 'hdlr') lerHdlr(d, b, add, limpar);
        else if (t === 'stsd') lerStsd(d, b, add, limpar, faixa);
        else if (t === 'mdia') {
          let h = ''; for (const c of caixas(d, b.ini, b.fim)) if (c.t === 'hdlr') h = ascii(d, c.ini + 8, 4);
          if (h === 'meta') add('faixa de dados', '');
          anda(b.ini, b.fim, false, h || faixa);
        }
        else if (CONTENTORES.has(t)) anda(b.ini, b.fim, false, faixa);
        else if (topo && !TOPO_OK.has(t)) { add('blocos desconhecidos', t.trim()); tira(b); }
      }
    };
    anda(0, d.length, true, '');
    return lista();
  }

  // =====================================================================
  // Imagens (JPG, PNG, WebP): a limpeza sem perdas da ferramenta da Anna
  // =====================================================================
  function orientationOf(t) {
    try {
      if (t.length < 14) return 1;
      const le = t[0] === 0x49, dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
      const ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le);
      for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (dv.getUint16(e, le) === 0x0112) { const v = dv.getUint16(e + 8, le); return v >= 1 && v <= 8 ? v : 1; } }
    } catch (e) {}
    return 1;
  }
  function tiffOrientation(o) {
    const b = new Uint8Array(26), dv = new DataView(b.buffer);
    b[0] = 0x49; b[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, 8, true);
    dv.setUint16(8, 1, true); dv.setUint16(10, 0x0112, true); dv.setUint16(12, 3, true); dv.setUint32(14, 1, true); dv.setUint16(18, o, true);
    return b;
  }
  function cleanJpeg(d, opts = {}) {
    if (d[0] !== 0xFF || d[1] !== 0xD8) throw new Error('não é um JPEG válido');
    const out = [d.subarray(0, 2)];
    let i = 2, orient = 1;
    const keep = (m, seg) => {
      if (m === 0xE0 || m === 0xEE) return true;
      if (m === 0xE2 && ascii(seg, 2, 11) === 'ICC_PROFILE') return !opts.noIcc;
      if (m >= 0xE0 && m <= 0xEF) return false;
      if (m === 0xFE) return false;
      return true;
    };
    while (i < d.length) {
      if (d[i] !== 0xFF) { i++; continue; }
      while (d[i + 1] === 0xFF) i++;
      const m = d[i + 1];
      if (m === 0xD9) { out.push(d.subarray(i, i + 2)); i += 2; break; }
      if (m === 0x00 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { out.push(d.subarray(i, i + 2)); i += 2; continue; }
      const len = d[i + 2] * 256 + d[i + 3], seg = d.subarray(i + 2, i + 2 + len);
      if (m === 0xE1 && ascii(seg, 2, 4) === 'Exif') orient = orientationOf(seg.subarray(8));
      if (keep(m, seg)) out.push(d.subarray(i, i + 2 + len));
      i += 2 + len;
      if (m === 0xDA) {
        let j = i;
        while (j < d.length - 1 && !(d[j] === 0xFF && d[j + 1] !== 0x00 && !(d[j + 1] >= 0xD0 && d[j + 1] <= 0xD7))) j++;
        out.push(d.subarray(i, j)); i = j;
      }
    }
    if (orient !== 1) {
      const t = tiffOrientation(orient), body = join([new TextEncoder().encode('Exif\0\0'), t]);
      const head = new Uint8Array([0xFF, 0xE1, (body.length + 2) >> 8, (body.length + 2) & 255]);
      out.splice(1, 0, join([head, body]));
    }
    return join(out);
  }
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (u8) => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const PNG_OK = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'bKGD', 'hIST', 'pHYs', 'sPLT', 'acTL', 'fcTL', 'fdAT', 'cICP', 'mDCV', 'cLLI'];
  function cleanPng(d, opts = {}) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!sig.every((v, k) => d[k] === v)) throw new Error('não é um PNG válido');
    const KEEP = new Set(PNG_OK);
    if (opts.noIcc) KEEP.delete('iCCP');
    if (opts.normalize) KEEP.delete('pHYs');
    const anim = new TextDecoder('latin1').decode(d.subarray(0, Math.min(d.length, 200000))).includes('acTL');
    const norm = opts.normalize && !anim;
    const out = [d.subarray(0, 8)], idat = [];
    const mk = (type, payload) => {
      const t = new TextEncoder().encode(type), body = join([t, payload]), c = new Uint8Array(12 + payload.length), dv = new DataView(c.buffer);
      dv.setUint32(0, payload.length); c.set(body, 4); dv.setUint32(8 + payload.length, crc(body)); return c;
    };
    const flush = () => {
      if (!idat.length) return; const all = join(idat); idat.length = 0;
      for (let o = 0; o < all.length; o += 65536) out.push(mk('IDAT', all.subarray(o, o + 65536)));
    };
    let i = 8;
    while (i + 12 <= d.length) {
      const len = u32(d, i), type = ascii(d, i + 4, 4), end = i + 12 + len;
      if (type === 'IDAT' && norm) idat.push(d.subarray(i + 8, i + 8 + len));
      else { flush(); if (KEEP.has(type)) out.push(d.subarray(i, end)); }
      i = end;
      if (type === 'IEND') break;
    }
    return join(out);
  }
  function cleanWebp(d, opts = {}) {
    if (ascii(d, 0, 4) !== 'RIFF' || ascii(d, 8, 4) !== 'WEBP') throw new Error('não é um WebP válido');
    const chunks = []; let i = 12, orient = 1, vp8x = -1;
    while (i + 8 <= d.length) {
      const t = ascii(d, i, 4), len = d[i + 4] + (d[i + 5] << 8) + (d[i + 6] << 16) + d[i + 7] * 16777216, end = i + 8 + len + (len & 1);
      if (t === 'EXIF') orient = orientationOf(d.subarray(i + 8 + (ascii(d, i + 8, 4) === 'Exif' ? 6 : 0), i + 8 + len));
      if (t !== 'EXIF' && t !== 'XMP ' && !(opts.noIcc && t === 'ICCP')) { if (t === 'VP8X') vp8x = chunks.length; chunks.push(d.slice(i, Math.min(end, d.length))); }
      i = end;
    }
    if (vp8x >= 0) chunks[vp8x][8] &= ~(0x08 | 0x04 | (opts.noIcc ? 0x20 : 0));
    if (orient !== 1) {
      const t = tiffOrientation(orient), c = new Uint8Array(8 + t.length);
      c.set(new TextEncoder().encode('EXIF')); new DataView(c.buffer).setUint32(4, t.length, true); c.set(t, 8);
      if (vp8x >= 0) { chunks[vp8x][8] |= 0x08; chunks.splice(vp8x + 1, 0, c); }
    }
    const body = join([new TextEncoder().encode('WEBP'), ...chunks]), head = new Uint8Array(8);
    head.set(new TextEncoder().encode('RIFF')); new DataView(head.buffer).setUint32(4, body.length, true);
    return join([head, body]);
  }
  function ifdInfo(t) {
    try {
      const le = t[0] === 0x49, dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
      const ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le), tags = [];
      for (let i = 0; i < n; i++) tags.push(dv.getUint16(ifd + 2 + i * 12, le));
      return { tags, thumb: dv.getUint32(ifd + 2 + n * 12, le) > 0 };
    } catch (e) { return { tags: [], thumb: false }; }
  }
  function exifLabels(t, add) {
    const { tags, thumb } = ifdInfo(t), rest = tags.filter((x) => x !== 0x0112);
    if (tags.includes(0x8825)) add('GPS');
    if (tags.includes(0x010F) || tags.includes(0x0110)) add('telemóvel ou câmara');
    if (tags.includes(0x0131)) add('programa');
    if (tags.includes(0x0132) || tags.includes(0x9003) || tags.includes(0x8769)) add('datas');
    if (thumb) add('miniatura');
    if (rest.length) add('EXIF');
  }
  function imagem(d, opts = {}) { // o que uma imagem esconde (antes ou depois da limpeza)
    const { add, lista } = achados();
    if (d[0] === 0xFF && d[1] === 0xD8) {
      let i = 2;
      while (i < d.length - 1) {
        if (d[i] !== 0xFF) { i++; continue; }
        while (d[i + 1] === 0xFF) i++;
        const m = d[i + 1];
        if (m === 0xD9) { if (i + 2 < d.length) add('dados escondidos no fim'); break; }
        if (m === 0x00 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
        const len = d[i + 2] * 256 + d[i + 3], seg = d.subarray(i + 2, i + 2 + len);
        if (m === 0xE1) { if (ascii(seg, 2, 4) === 'Exif') exifLabels(seg.subarray(8), add); else if (ascii(seg, 2, 4) === 'http') add('XMP'); else add('dados privados'); }
        else if (m === 0xEB) add('C2PA');
        else if (m === 0xED) add('IPTC');
        else if (m === 0xFE) add('comentário');
        else if (m === 0xE2 && ascii(seg, 2, 11) !== 'ICC_PROFILE') add('dados extra');
        else if (m === 0xE2 && opts.noIcc) add('perfil de cor');
        else if (m >= 0xE3 && m <= 0xEF && m !== 0xEE) add('dados privados');
        i += 2 + len;
        if (m === 0xDA) { let j = i; while (j < d.length - 1 && !(d[j] === 0xFF && d[j + 1] !== 0x00 && !(d[j + 1] >= 0xD0 && d[j + 1] <= 0xD7))) j++; i = j; }
      }
    } else if (d[0] === 0x89 && d[1] === 0x50) {
      const OKS = new Set(PNG_OK);
      let i = 8;
      while (i + 12 <= d.length) {
        const len = u32(d, i), type = ascii(d, i + 4, 4), end = i + 12 + len;
        if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
          const k = ascii(d, i + 8, Math.min(24, len)).split('\0')[0].toLowerCase();
          add(/xmp/.test(k) ? 'XMP' : /software/.test(k) ? 'programa' : /param|prompt|comment|descr|title/.test(k) ? 'prompt ou texto' : 'texto');
        } else if (type === 'eXIf') add('EXIF');
        else if (type === 'caBX') add('C2PA');
        else if (type === 'tIME') add('datas');
        else if (type === 'iCCP' && opts.noIcc) add('perfil de cor');
        else if (type === 'pHYs' && opts.normalize) add('tamanho físico');
        else if (!OKS.has(type)) add('dados privados');
        i = end;
        if (type === 'IEND') { if (i < d.length) add('dados escondidos no fim'); break; }
      }
    } else if (d[0] === 0x52 && d[1] === 0x49) {
      let i = 12;
      while (i + 8 <= d.length) {
        const t = ascii(d, i, 4), len = d[i + 4] + (d[i + 5] << 8) + (d[i + 6] << 16) + d[i + 7] * 16777216;
        if (t === 'EXIF') exifLabels(d.subarray(i + 8 + (ascii(d, i + 8, 4) === 'Exif' ? 6 : 0), i + 8 + len), add);
        if (t === 'XMP ') add('XMP');
        if (t === 'ICCP' && opts.noIcc) add('perfil de cor');
        i += 8 + len + (len & 1);
      }
    }
    return lista();
  }

  // =====================================================================
  // Entrada única: decide pelo conteúdo do ficheiro
  // =====================================================================
  const eJpeg = (d) => d[0] === 0xFF && d[1] === 0xD8, ePng = (d) => d[0] === 0x89 && d[1] === 0x50, eWebp = (d) => d[0] === 0x52 && d[1] === 0x49 && ascii(d, 8, 4) === 'WEBP';
  const eVideo = (d) => d.length >= 16 && TOPO_VIDEO.has(ascii(d, 4, 4));
  function limpaBytes(d, opts = {}) { // d é alterado no sítio nos vídeos
    if (eVideo(d)) { const found = video(d, true); return { data: d, found, left: video(d, false), tipo: 'video' }; }
    let out;
    if (eJpeg(d)) out = cleanJpeg(d, opts);
    else if (ePng(d)) out = cleanPng(d, opts);
    else if (eWebp(d)) out = cleanWebp(d, opts);
    else throw new Error('formato não suportado');
    return { data: out, found: imagem(d, opts), left: imagem(out, opts), tipo: 'imagem' };
  }
  function veBytes(d) {
    if (eVideo(d)) return video(d, false);
    if (eJpeg(d) || ePng(d) || eWebp(d)) return imagem(d);
    throw new Error('formato não suportado');
  }
  const diz = (l) => l.map((a) => a.vals.length ? a.rot + ' (' + a.vals.join(', ') + ')' : a.rot).join(', ');
  const nomes = (l) => l.map((a) => a.rot).join(', ');

  // =====================================================================
  // O separador na página dos criativos: abre a página limpar-metadados.html
  // =====================================================================
  const CSS = `
  nav #aba-limpeza { margin-left: auto; }
  #limpeza { display: none; }
  body.lp-aberto { overflow: hidden; }
  body.lp-aberto #limpeza { display: block; }
  body.lp-aberto .barra, body.lp-aberto .explica, body.lp-aberto #lista, body.lp-aberto #rodape { display: none !important; }
  #limpeza iframe { display: block; width: 100%; height: 100%; border: 0; background: #0e1113; }
  `;

  function ligaFerramenta(p) {
    const $ = (id) => p.querySelector('#' + id);
    const drop = $('lp-drop'), list = $('lp-lista'), go = $('lp-ir'), clear = $('lp-esvaziar'), destSel = $('lp-destino'), msg = $('lp-msg');
    const OK = /\.(mp4|mov|m4v|jpe?g|png|webp)$/i;
    const HAS_DIR = typeof window.showDirectoryPicker === 'function';
    const NATIVO = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mistertuga); // a app de Mac
    const nativo = (o) => window.webkit.messageHandlers.mistertuga.postMessage(o);
    let items = [], seen = new Set(), busy = false;
    if (!HAS_DIR && !NATIVO) destSel.querySelector('option[value=pasta]').remove();

    const fmt = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(2).replace('.', ',') + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
    const mode = () => p.querySelector('input[name=lp-modo]:checked').value;
    const tick = () => new Promise((r) => setTimeout(r));

    function add(file, path) {
      if (!OK.test(file.name)) return false;
      const key = path + '|' + file.size; if (seen.has(key)) return true; seen.add(key);
      const li = document.createElement('li');
      li.innerHTML = '<span class="n"></span><span class="s"></span>';
      li.querySelector('.n').textContent = path; li.querySelector('.s').textContent = fmt(file.size);
      list.appendChild(li); items.push({ file, path, s: li.querySelector('.s') });
      return true;
    }
    function refresh(skipped = 0) {
      const total = items.reduce((s, i) => s + i.file.size, 0);
      go.disabled = clear.disabled = items.length === 0 || busy;
      msg.textContent = items.length ? items.length + (items.length === 1 ? ' ficheiro pronto (' : ' ficheiros prontos (') + fmt(total) + ').' + (skipped ? ' ' + skipped + ' ignorado(s): só MP4, MOV, JPG, PNG e WebP.' : '') : '';
    }
    function walk(entry, base) {
      return new Promise((res) => {
        if (entry.isFile) entry.file((f) => res([{ f, p: base + entry.name }]), () => res([]));
        else if (entry.isDirectory) {
          const reader = entry.createReader(), out = [];
          const read = () => reader.readEntries(async (batch) => {
            if (!batch.length) return res(out);
            for (const e of batch) out.push(...await walk(e, base + entry.name + '/'));
            read();
          }, () => res(out));
          read();
        } else res([]);
      });
    }
    async function take(files) {
      let skipped = 0; msg.textContent = 'A ler ' + files.length + ' ficheiro(s)…';
      for (let k = 0; k < files.length; k++) { if (!add(files[k].f, files[k].p)) skipped++; if (k % 200 === 199) await tick(); }
      refresh(skipped);
    }
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('sobre'); }));
    drop.addEventListener('drop', async (e) => {
      const its = [...(e.dataTransfer.items || [])].map((i) => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      let all = [];
      if (its.length) for (const en of its) all.push(...await walk(en, ''));
      else all = [...e.dataTransfer.files].map((f) => ({ f, p: f.name }));
      take(all);
    });
    $('lp-ficheiros').onchange = (e) => { take([...e.target.files].map((f) => ({ f, p: f.name }))); e.target.value = ''; };
    $('lp-pasta').onchange = (e) => { take([...e.target.files].map((f) => ({ f, p: f.webkitRelativePath || f.name }))); e.target.value = ''; };
    clear.onclick = () => { items = []; seen = new Set(); list.innerHTML = ''; $('lp-barra').style.display = 'none'; refresh(); };
    const syncExtra = () => { $('lp-mapa').disabled = !$('lp-neutros').checked; $('lp-mapa').closest('label').style.opacity = $('lp-neutros').checked ? 1 : .45; };
    $('lp-neutros').onchange = syncExtra; syncExtra();
    if ($('lp-maximo')) $('lp-maximo').onclick = () => { ['lp-neutros', 'lp-mapa', 'lp-icc', 'lp-png'].forEach((id) => { if ($(id)) $(id).checked = true; }); syncExtra(); };
    p.querySelectorAll('input[name=lp-modo]').forEach((r) => r.onchange = () => {
      const ver = mode() === 'ver';
      go.textContent = ver ? 'Ver o que escondem' : 'Apagar rasto e guardar';
      $('lp-opcoes').style.display = ver ? 'none' : '';
    });

    const save = (blob, name, logo) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      if (logo) return a.href;
      setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    };
    function zip(entries) { // zip simples, sem compressão, com nomes UTF-8
      const enc = new TextEncoder(), parts = [], central = []; let off = 0;
      const now = new Date(), dt = ((now.getFullYear() - 1980) << 9 | (now.getMonth() + 1) << 5 | now.getDate()) & 0xFFFF, tm = (now.getHours() << 11 | now.getMinutes() << 5 | now.getSeconds() >> 1) & 0xFFFF;
      for (const e of entries) {
        const name = enc.encode(e.name), size = e.data.length, c = crc(e.data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
        h.setUint16(10, tm, true); h.setUint16(12, dt, true); h.setUint32(14, c, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
        h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
        parts.push(h.buffer, name, e.data);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
        ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, c, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
        ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
        central.push(ch.buffer, name);
        off += 30 + name.length + size;
      }
      const csize = central.reduce((s, b) => s + (b.byteLength ?? b.length), 0);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
      end.setUint32(12, csize, true); end.setUint32(16, off, true);
      return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
    }
    async function dirWrite(root, path, data) {
      if (root.nativo) { // na app de Mac: cada ficheiro é descarregado e a app põe-no na pasta escolhida, no mesmo caminho
        await nativo({ acao: 'proximo', caminho: path });
        const url = save(new Blob([data]), path.split('/').pop(), true);
        const r = await Promise.race([nativo({ acao: 'espera' }), new Promise((ok) => setTimeout(() => ok('o Mac não respondeu'), 180000))]);
        URL.revokeObjectURL(url);
        if (r !== true) throw new Error(r || 'não deu para gravar');
        return;
      }
      const parts = path.split('/').filter(Boolean); let h = root;
      for (let i = 0; i < parts.length - 1; i++) h = await h.getDirectoryHandle(parts[i], { create: true });
      const fh = await h.getFileHandle(parts[parts.length - 1], { create: true });
      const w = await fh.createWritable(); await w.write(data); await w.close();
    }
    function zipSink() { // zips de cerca de 600 MB, para nunca ficar sem memória
      let cur = [], size = 0, part = 0;
      return {
        add: async (name, data) => {
          cur.push({ name, data }); size += data.length;
          if (size >= 600 * 1048576) { save(zip(cur), 'ficheiros-limpos-parte-' + (++part) + '.zip'); cur = []; size = 0; await tick(); }
        },
        end: () => {
          if (part === 0) { if (cur.length) save(zip(cur), 'ficheiros-limpos.zip'); return cur.length ? 1 : 0; }
          if (cur.length) save(zip(cur), 'ficheiros-limpos-parte-' + (++part) + '.zip');
          return part;
        },
      };
    }

    go.onclick = async () => {
      if (busy || !items.length) return;
      const ver = mode() === 'ver';
      let root = null, sink = null, aviso = '';
      if (!ver && items.length > 1) {
        if (destSel.value === 'pasta' && NATIVO) {
          let nome = null; try { nome = await nativo({ acao: 'pasta' }); } catch (e) {}
          if (!nome) return;
          root = { nativo: true, nome };
        } else if (destSel.value === 'pasta') {
          try { root = await window.showDirectoryPicker({ mode: 'readwrite' }); }
          catch (e) { if (e && e.name === 'AbortError') return; sink = zipSink(); aviso = ' Não deu para escrever na pasta, por isso foi para um zip.'; }
        } else sink = zipSink();
      }
      busy = true; go.disabled = clear.disabled = true;
      const bar = $('lp-barra'), fill = $('lp-encher'); bar.style.display = 'block'; fill.style.width = '0';
      const opts = { noIcc: $('lp-icc').checked, normalize: $('lp-png') ? $('lp-png').checked : true }, neutral = $('lp-neutros').checked, wantMap = neutral && $('lp-mapa').checked;
      const pad = Math.max(4, String(items.length).length), mapRows = [['original', 'novo']], cont = { video: 0, imagem: 0 };
      let ok = 0, failed = 0, dirty = 0, last = null;
      for (let i = 0; i < items.length; i++) {
        const it = items[i], s = it.s;
        s.className = 's'; s.textContent = ver ? 'a ver…' : 'a limpar…';
        await tick();
        try {
          const d = new Uint8Array(await it.file.arrayBuffer());
          if (ver) {
            const found = veBytes(d);
            if (found.length) { dirty++; s.textContent = 'tem: ' + diz(found); s.className = 's tem'; }
            else { s.textContent = '✓ sem metadados escondidos'; s.className = 's ok'; }
          } else {
            const r = limpaBytes(d, opts);
            let nm = $('lp-sufixo').checked ? it.path.replace(/(\.[^./]+)$/, '-limpo$1') : it.path;
            if (neutral) {
              const dir = it.path.includes('/') ? it.path.slice(0, it.path.lastIndexOf('/') + 1) : '';
              nm = dir + r.tipo + '-' + String(++cont[r.tipo]).padStart(pad, '0') + (it.path.match(/\.[^./]+$/) || [''])[0].toLowerCase();
              mapRows.push([it.path, nm]);
              r.found.push({ rot: 'nome do ficheiro', vals: [] });
            }
            if (root) await dirWrite(root, nm, r.data); else if (!sink) last = { r, nm }; else await sink.add(nm, r.data);
            s.textContent = r.left.length ? '⚠ ficou: ' + diz(r.left) : '✓ verificado · ' + (r.found.length ? 'apagado: ' + nomes(r.found) : 'já estava limpo');
            s.className = r.left.length ? 's erro' : 's ok';
          }
          ok++;
        } catch (e) { failed++; s.textContent = 'erro: ' + (e && e.message || e); s.className = 's erro'; }
        fill.style.width = Math.round((i + 1) / items.length * 100) + '%';
        msg.textContent = (ver ? 'A ver ' : 'A limpar ') + (i + 1) + ' de ' + items.length + '…';
      }
      if (wantMap && !ver && mapRows.length > 1 && items.length > 1) {
        const csv = new TextEncoder().encode('﻿' + mapRows.map((r) => r.map((x) => '"' + x.replace(/"/g, '""') + '"').join(';')).join('\r\n'));
        try { if (root) await dirWrite(root, 'nomes-antigos.csv', csv); else if (sink) await sink.add('nomes-antigos.csv', csv); } catch (e) {}
      }
      let texto;
      if (ver) texto = 'Feito: ' + dirty + ' de ' + ok + (ok === 1 ? ' ficheiro tem' : ' ficheiros têm') + ' rasto escondido.' + (failed ? ' ' + failed + ' com erro.' : '') + (dirty ? ' Escolhe «Limpar» para o apagar.' : '');
      else {
        let onde = '';
        const ondeVai = NATIVO ? ' nas Transferências' : '';
        if (root && root.nativo) { onde = ' Ficaram na pasta «' + root.nome + '».'; try { nativo({ acao: 'fim' }); } catch (e) {} }
        else if (root) onde = ' Ficaram na pasta que escolheste.';
        else if (last) { save(new Blob([last.r.data]), last.nm.split('/').pop()); onde = ' Guardado' + ondeVai + ': ' + last.nm.split('/').pop() + '.'; }
        else if (sink && ok) { const n = sink.end(); onde = n > 1 ? ' Guardados' + ondeVai + ' ' + n + ' zips.' + (NATIVO ? '' : ' Se o Chrome perguntar, deixa descarregar vários ficheiros.') : ' Guardado' + ondeVai + ': ficheiros-limpos.zip.'; }
        texto = ok ? 'Pronto: ' + ok + (ok === 1 ? ' ficheiro limpo e verificado.' : ' ficheiros limpos e verificados.') + onde + aviso + (failed ? ' ' + failed + ' com erro.' : '') : 'Nenhum ficheiro foi limpo.';
      }
      busy = false; refresh();
      msg.textContent = texto;
    };
  }

  function montar() {
    if (document.getElementById('lp-pagina')) { ligaFerramenta(document); return; } // a página limpar-metadados.html
    const nav = document.getElementById('mercados');
    if (!nav || document.getElementById('limpeza')) return;
    const estilo = document.createElement('style'); estilo.textContent = CSS; document.head.appendChild(estilo);
    const botao = document.createElement('button'); botao.type = 'button'; botao.id = 'aba-limpeza'; botao.textContent = 'Metadados';
    const painel = document.createElement('section'); painel.id = 'limpeza';
    const quadro = document.createElement('iframe'); quadro.title = 'Limpar metadados'; painel.appendChild(quadro);
    nav.after(painel);
    let aberto = false, antes = null;
    const marca = () => {
      botao.classList.toggle('ativo', aberto);
      if (aberto) nav.querySelectorAll('button[data-m]').forEach((b) => { if (b.classList.contains('ativo')) antes = b.dataset.m; b.classList.remove('ativo'); });
    };
    const poe = () => { if (botao.parentNode !== nav) nav.appendChild(botao); marca(); };
    new MutationObserver(poe).observe(nav, { childList: true }); poe(); // os mercados redesenham a barra: o separador volta sempre
    const altura = () => { if (aberto) painel.style.height = Math.max(420, innerHeight - painel.getBoundingClientRect().top) + 'px'; };
    const abre = (sim) => {
      aberto = sim; document.body.classList.toggle('lp-aberto', sim); marca();
      if (sim) {
        if (!quadro.src) quadro.src = 'limpar-metadados.html';
        window.scrollTo(0, 0); altura();
        if (location.hash !== '#limpar') history.replaceState(null, '', '#limpar');
      } else if (location.hash === '#limpar') history.replaceState(null, '', location.pathname + location.search);
    };
    addEventListener('resize', altura);
    botao.addEventListener('click', () => abre(true));
    nav.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button[data-m]')) abre(false); }, true);
    window.mtAba = (qual) => { // os atalhos da app de Mac: ⌘1 criativos, ⌘2 metadados
      if (qual === 'metadados') return abre(true);
      const b = (antes && nav.querySelector('button[data-m="' + window.CSS.escape(antes) + '"]')) || nav.querySelector('button[data-m]');
      if (b) b.click(); else abre(false);
    };
    if (location.hash === '#limpar') abre(true);
  }

  if (typeof module === 'object' && module.exports) module.exports = { limpaBytes, veBytes, diz, nomes };
  if (typeof document !== 'undefined') montar();
})();
