const { fileURLToPath } = require('url');

/**
 * Drop lazy-load `?query` / `#hash` from a local path without mangling the
 * Windows extended-length prefix (`\\?\C:\…` / `\\?\UNC\…`), whose `?` is
 * literal — a naive split on `?` would leave only `\\`.
 */
function stripQueryHashFromLocalPath(value) {
  const extended = value.match(/^(\\\\\?\\)([\s\S]*)$/);
  if (extended) {
    return extended[1] + extended[2].split(/[?#]/, 1)[0];
  }
  return value.split(/[?#]/, 1)[0];
}

/**
 * Resolve a clipboard/nav entry to a local filesystem path.
 * URL.pathname leaves a leading slash on Windows (`/C:/...`), so existsSync
 * and path comparisons fail — fileURLToPath is the portable fix.
 * Also strips surrounding quotes from Windows "Copy as path" / some file managers.
 */
function localPathFromFileUrlOrPath(entry) {
  if (!entry) return entry;
  let value = String(entry).trim();
  // "C:\Users\...\img.png" or 'file:///...' — quotes break existsSync.
  // Also strip backticks (shell/markdown copy), curly/smart quotes
  // (Word/Slack/Discord “Copy as path”), guillemets, German low-high
  // quotes, white corner / vertical presentation corner / square /
  // double-prime quotation / tortoise shell brackets, and fullwidth ASCII quotes / square
  // brackets / parentheses / white parentheses / curly braces / angle brackets
  // (ASCII + fullwidth) / pipes (ASCII | |, fullwidth ｜｜, double vertical ‖‖)
  // / dingbat medium (double) angle / heavy angle / medium curly / math
  // flattened parenthesis / ceiling / floor ornaments — same existsSync
  // failure mode.
  // Peel nested wrappers (e.g. `"/tmp/a.png"`, `「"/tmp/a.png"」`, markdown
  // `` `/tmp/a.png` `` inside chat quotes). A single pass left the inner layer
  // literal so existsSync failed and Ctrl+V reported "No image".
  while (value.length >= 2) {
    const open = value[0];
    const close = value[value.length - 1];
    const paired =
      (open === '"' && close === '"') ||
      (open === "'" && close === "'") ||
      (open === '`' && close === '`') ||
      (open === '\u201C' && close === '\u201D') || // “ ”
      (open === '\u2018' && close === '\u2019') || // ‘ ’
      // Ornamental heavy quotes ❛ ❜ / ❝ ❞ — Word/typography "Copy as path"
      // wrappers (companion to curly “ ” / ‘ ’). Left literal they break existsSync.
      (open === '\u275B' && close === '\u275C') || // ❛ ❜
      (open === '\u275D' && close === '\u275E') || // ❝ ❞
      (open === '\u300C' && close === '\u300D') || // 「 」
      (open === '\u300E' && close === '\u300F') || // 『 』 (white corner)
      // CJK vertical presentation forms ﹁path﹂ / ﹃path﹄ — companions to
      // 「」/『』 used by vertical-text IME / typography "Copy as path".
      // Left literal they break existsSync.
      (open === '\uFE41' && close === '\uFE42') || // ﹁ ﹂
      (open === '\uFE43' && close === '\uFE44') || // ﹃ ﹄
      // Vertical presentation square ﹇path﹈ — companion to ﹁﹂/﹃﹄ and to
      // ASCII/fullwidth [］ wrappers; vertical-text IME "Copy as path".
      // Left literal they break existsSync.
      (open === '\uFE47' && close === '\uFE48') || // ﹇ ﹈
      // CJK double-prime quotation 〝path〞 / 〝path〟 — East-Asian typography /
      // IME "Copy as path" wrappers (companions to 「」/『』). Left literal they
      // break existsSync.
      (open === '\u301D' && close === '\u301E') || // 〝 〞
      (open === '\u301D' && close === '\u301F') || // 〝 〟 (low double prime close)
      (open === '\uFF02' && close === '\uFF02') || // ＂ ＂ (fullwidth ")
      (open === '\uFF07' && close === '\uFF07') || // ＇ ＇ (fullwidth ')
      // Fullwidth ［path］ — CJK IME fullwidth mode often wraps Copy-as-path
      // like ASCII [path]; left literal they break existsSync.
      (open === '\uFF3B' && close === '\uFF3D') || // ［ ］
      (open === '\u00AB' && close === '\u00BB') || // « »
      (open === '\u00BB' && close === '\u00AB') || // » « (DE/CH reversed)
      (open === '\u2039' && close === '\u203A') || // ‹ ›
      (open === '\u203A' && close === '\u2039') || // › ‹
      (open === '\u201E' && close === '\u201C') || // „ “ (German)
      (open === '\u201A' && close === '\u2018') || // ‚ ‘ (German single)
      // CJK tortoise shell 〔path〕 — Word/IME "Copy as path" wrappers.
      // Left literal they break existsSync (same failure mode as 「」/『』).
      (open === '\u3014' && close === '\u3015') || // 〔 〕
      // CJK white tortoise shell 〘path〙 — companion to 〔〕; IME / messenger
      // Copy-as-path wrappers. Left literal they break existsSync.
      (open === '\u3018' && close === '\u3019') || // 〘 〙
      // Dingbat light tortoise shell ❲path❳ — ornamental companion to 〔〕/〘〙
      // (Word / messenger "Copy as path" wrappers). Left literal they break
      // existsSync.
      (open === '\u2772' && close === '\u2773') || // ❲ ❳
      // Dingbat medium parenthesis ❨path❩ — ornamental companion to ❲❳ / （）;
      // Word / messenger "Copy as path" wrappers. Left literal they break
      // existsSync.
      (open === '\u2768' && close === '\u2769') || // ❨ ❩
      // Dingbat medium flattened parenthesis ❪path❫ — ornamental companion to
      // ❨❩ (Word / messenger "Copy as path" wrappers). Left literal they
      // break existsSync.
      (open === '\u276A' && close === '\u276B') || // ❪ ❫
      // Dingbat medium angle ❬path❭ — ornamental companion to ❪❫ / ❨❩;
      // Word / messenger "Copy as path" wrappers. Left literal they break
      // existsSync.
      (open === '\u276C' && close === '\u276D') || // ❬ ❭
      // Dingbat medium double angle ❮path❯ — ornamental companion to ❬ ❭;
      // Word / messenger "Copy as path" wrappers. Left literal they break
      // existsSync.
      (open === '\u276E' && close === '\u276F') || // ❮ ❯
      // Dingbat heavy angle ❰path❱ — ornamental companion to ❮ ❯;
      // Word / messenger "Copy as path" wrappers. Left literal they break
      // existsSync.
      (open === '\u2770' && close === '\u2771') || // ❰ ❱
      // Dingbat medium curly ❴path❵ — ornamental companion to ❰❱ / ❨❩;
      // Word / messenger "Copy as path" wrappers. Left literal they break
      // existsSync.
      (open === '\u2774' && close === '\u2775') || // ❴ ❵
      // CJK black lenticular 【path】 — common IME / messenger Copy-as-path
      // wrappers. Left literal they break existsSync.
      (open === '\u3010' && close === '\u3011') || // 【 】
      // CJK white lenticular 〖path〗 — same IME / messenger wrappers as 【】.
      // Left literal they break existsSync.
      (open === '\u3016' && close === '\u3017') || // 〖 〗
      // CJK presentation form 〚path〛 — IME / messenger Copy-as-path wrappers.
      // Left literal they break existsSync (same failure mode as 【】/〖〗).
      (open === '\u301A' && close === '\u301B') || // 〚 〛
      // Mathematical white square ⟦path⟧ — typography / math-mode IME wrappers
      // (companion to 〚〛). Left literal they break existsSync.
      (open === '\u27E6' && close === '\u27E7') || // ⟦ ⟧
      // Mathematical angle ⟨path⟩ — typography / math-mode IME wrappers
      // (companion to ⟦⟧). Left literal they break existsSync.
      (open === '\u27E8' && close === '\u27E9') || // ⟨ ⟩
      // Mathematical double angle ⟪path⟫ — typography / math-mode IME wrappers
      // (companion to ⟨⟩). Left literal they break existsSync.
      (open === '\u27EA' && close === '\u27EB') || // ⟪ ⟫
      // Mathematical white tortoise shell ⟬path⟭ — typography / math-mode IME
      // wrappers (companion to ⟪⟫ / 〔〕). Left literal they break existsSync.
      (open === '\u27EC' && close === '\u27ED') || // ⟬ ⟭
      // Mathematical flattened parenthesis ⟮path⟯ — typography / math-mode IME
      // wrappers (companion to ⟬⟭ / （）). Left literal they break existsSync.
      (open === '\u27EE' && close === '\u27EF') || // ⟮ ⟯
      // Mathematical ceiling ⌈path⌉ — typography / math-mode IME wrappers
      // (companion to ⟨⟩ / ⟦⟧). Left literal they break existsSync.
      (open === '\u2308' && close === '\u2309') || // ⌈ ⌉
      // Mathematical floor ⌊path⌋ — companion to ⌈⌉; typography / math-mode
      // IME wrappers. Left literal they break existsSync.
      (open === '\u230A' && close === '\u230B') || // ⌊ ⌋
      // Halfwidth corner ｢path｣ — Japanese IME / halfwidth katakana mode
      // Copy-as-path wrappers (companion to fullwidth 「」). Left literal they
      // break existsSync.
      (open === '\uFF62' && close === '\uFF63') || // ｢ ｣
      // CJK double angle 《path》 — Chinese IME / messenger Copy-as-path
      // wrappers. Left literal they break existsSync.
      (open === '\u300A' && close === '\u300B') || // 《 》
      // CJK single angle 〈path〉 — companion to 《》; Chinese IME / messenger
      // Copy-as-path wrappers. Left literal they break existsSync.
      (open === '\u3008' && close === '\u3009') || // 〈 〉
      // Fullwidth （path） — CJK IME fullwidth mode wraps Copy-as-path like
      // ASCII (path); left literal they break existsSync.
      (open === '\uFF08' && close === '\uFF09') || // （ ）
      // Fullwidth white ｟path｠ — CJK IME / typography companion to （）; left
      // literal they break existsSync (same failure mode as （）/()).
      (open === '\uFF5F' && close === '\uFF60') || // ｟ ｠
      // ASCII (path) — chat/docs/markdown and some "Copy as path" helpers wrap
      // the path; left literal they break existsSync (same mode as （）).
      (open === '(' && close === ')') ||
      // ASCII [path] — companion to fullwidth ［］; chat/docs/markdown and some
      // Copy-as-path helpers wrap the path; left literal they break existsSync.
      (open === '[' && close === ']') ||
      // Fullwidth ｛path｝ — CJK IME fullwidth mode wraps Copy-as-path like
      // ASCII {path}; left literal they break existsSync (same mode as ［］/（）).
      (open === '\uFF5B' && close === '\uFF5D') || // ｛ ｝
      // ASCII {path} — companion to fullwidth ｛｝; chat/docs/markdown and some
      // Copy-as-path helpers wrap the path; left literal they break existsSync.
      (open === '{' && close === '}') ||
      // Fullwidth ＜path＞ — CJK IME fullwidth mode wraps Copy-as-path like
      // ASCII <path>; left literal they break existsSync (same mode as （）/［］).
      // Distinct from 《》/〈〉 (CJK angle brackets already handled above).
      (open === '\uFF1C' && close === '\uFF1E') || // ＜ ＞
      // ASCII <path> — companion to fullwidth ＜＞; chat/docs/markdown and some
      // Copy-as-path helpers wrap the path; left literal they break existsSync.
      (open === '<' && close === '>') ||
      // ASCII |path| — chat/docs/markdown and some Copy-as-path helpers wrap
      // the path; left literal they break existsSync (same mode as <> / ()).
      (open === '|' && close === '|') ||
      // Fullwidth ｜path｜ — CJK IME fullwidth mode wraps Copy-as-path like
      // ASCII |path|; left literal they break existsSync.
      (open === '\uFF5C' && close === '\uFF5C') || // ｜ ｜
      // Double vertical ‖path‖ — typography / math-mode companion to |path|;
      // left literal they break existsSync.
      (open === '\u2016' && close === '\u2016'); // ‖ ‖
    if (!paired) break;
    value = value.slice(1, -1).trim();
  }
  if (/^file:/i.test(value)) {
    try {
      value = fileURLToPath(value);
    } catch {
      try {
        value = decodeURIComponent(new URL(value).pathname);
      } catch {
        // keep value
      }
    }
  } else {
    // Plain absolute / drive / UNC paths sometimes keep lazy-load cache
    // busters (`/tmp/a.png?v=1` or `#frag`) from HTML/text exporters.
    // file: URLs already drop query/hash via fileURLToPath; plain paths do
    // not — without this, existsSync fails and Ctrl+V reports "No image".
    // Windows extended-length paths use a literal `\\?\` prefix — naive
    // split on `?` would truncate to `\\` and break paste/existsSync.
    if (/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(value)) {
      value = stripQueryHashFromLocalPath(value);
    }
    // Clipboard HTML often leaves absolute paths percent-encoded
    // (`/tmp/my%20photo.png`) while the file on disk has a real space.
    // file: URLs already decode via fileURLToPath; plain paths do not —
    // without this, existsSync fails and Ctrl+V reports "No image".
    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      try {
        value = decodeURIComponent(value);
      } catch {
        // keep value
      }
    }
  }
  // CF_HTML / Word often encode spaces as &nbsp; / &ensp; / &emsp; / &thinsp;
  // (or numeric &#x2009; etc.). Files on disk almost always use ASCII space —
  // without normalizing, existsSync fails after entity decode (including
  // file: URLs) and Ctrl+V reports "No image".
  // U+00A0 NBSP; U+2000–U+200A en/em/thin/hair/…; U+202F/U+205F/U+3000.
  if (/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/.test(value)) {
    value = value.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  }
  // Soft hyphen / zero-width / bidi format chars from Word wrapping or HTML
  // entities (&shy; / &#xAD; / &#8203; / &zwnj; / &lrm; / &rlm; …) are not on
  // disk — strip them or existsSync fails and Ctrl+V reports "No image".
  // U+00AD soft hyphen; U+200B–U+200F ZWSP/ZWNJ/ZWJ/LRM/RLM; U+FEFF BOM; U+2060 WJ.
  if (/[\u00AD\u200B-\u200F\uFEFF\u2060]/.test(value)) {
    value = value.replace(/[\u00AD\u200B-\u200F\uFEFF\u2060]/g, '');
  }
  // Word/Outlook typographic dashes (&ndash; / &mdash; / &minus; / &hyphen; or
  // numeric &#8211;/&#8212;/&#8722;/&#8210;/&#8213;/&#8208;/&#8209;) and CJK
  // IME fullwidth hyphen-minus (U+FF0D) almost never match the ASCII
  // hyphen-minus on disk — normalize or existsSync fails and Ctrl+V reports
  // "No image".
  // U+2010 hyphen; U+2011 non-breaking hyphen; U+2012 figure dash; U+2013 en
  // dash; U+2014 em dash; U+2015 horizontal bar; U+2212 minus; U+FF0D fullwidth -.
  if (/[\u2010-\u2015\u2212\uFF0D]/.test(value)) {
    value = value.replace(/[\u2010-\u2015\u2212\uFF0D]/g, '-');
  }
  // CJK IME fullwidth mode often inserts ／ (U+FF0F) / ＼ (U+FF3C) instead of
  // ASCII / and \. Left literal, existsSync fails and Ctrl+V reports "No image".
  if (/[\uFF0F\uFF3C]/.test(value)) {
    value = value.replace(/\uFF0F/g, '/').replace(/\uFF3C/g, '\\');
  }
  // Word / math / locale typography also substitutes ∕ (U+2215 division slash)
  // or ⁄ (U+2044 fraction slash) for ASCII path separators. Left literal,
  // existsSync fails and Ctrl+V reports "No image" (same mode as ／).
  if (/[\u2215\u2044]/.test(value)) {
    value = value.replace(/[\u2215\u2044]/g, '/');
  }
  // CJK IME fullwidth mode also turns the drive-letter colon into ： (U+FF1A),
  // e.g. C：\Users\… or C：/tmp/…. Left literal, existsSync fails and Ctrl+V
  // reports "No image".
  if (/^[A-Za-z]\uFF1A/.test(value)) {
    value = value[0] + ':' + value.slice(2);
  }
  // CJK IME fullwidth mode turns the extension separator into ． (U+FF0E),
  // e.g. photo．png or sketch．webp. Left literal, existsSync fails and Ctrl+V
  // reports "No image" (disk almost always uses ASCII '.').
  // Japanese/Chinese IME default sentence punctuation is 。 (U+3002 ideographic
  // full stop) or ｡ (U+FF61 halfwidth) — same failure mode as ．.
  // Typography / some IMEs also emit ․ (U+2024 ONE DOT LEADER) as a lookalike
  // period in pasted paths — left literal, existsSync fails the same way.
  if (/[\uFF0E\u3002\uFF61\u2024]/.test(value)) {
    value = value.replace(/[\uFF0E\u3002\uFF61\u2024]/g, '.');
  }
  return value;
}

module.exports = { localPathFromFileUrlOrPath, stripQueryHashFromLocalPath };
