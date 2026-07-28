const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { imageRefFromClipboardHtml } = require('../lib/clipboard-html');

describe('imageRefFromClipboardHtml', () => {
  it('extracts data:image URLs from img src', () => {
    const html = '<meta charset="utf-8"><img src="data:image/png;base64,aaa=" width="10">';
    assert.equal(imageRefFromClipboardHtml(html), 'data:image/png;base64,aaa=');
  });

  it('accepts single-quoted src', () => {
    const html = "<div><img alt='x' src='data:image/jpeg;base64,/9j/'></div>";
    assert.equal(imageRefFromClipboardHtml(html), 'data:image/jpeg;base64,/9j/');
  });

  it('extracts file: URLs', () => {
    const html = '<img src="file:///home/hypt/Pictures/sketch.png">';
    assert.equal(imageRefFromClipboardHtml(html), 'file:///home/hypt/Pictures/sketch.png');
  });

  it('extracts absolute local image paths', () => {
    const html = '<img src="/tmp/clip.webp">';
    assert.equal(imageRefFromClipboardHtml(html), '/tmp/clip.webp');
  });

  it('extracts Windows UNC share image paths', () => {
    // Explorer / Office "Copy" HTML sometimes exposes a share path without file:.
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\sketch.png">'),
      '\\\\fileserver\\art\\sketch.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\photo.jfif">'),
      '\\\\fileserver\\art\\photo.jfif'
    );
    // Still reject non-image UNC paths.
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\docs\\notes.txt">'),
      null
    );
  });

  it('extracts Windows extended-length \\\\?\\ local image paths', () => {
    // Explorer / long-path APIs use \\\\?\\C:\\… — the literal "?" must not be
    // treated as a URL query delimiter or paste reports "No image".
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\?\\C:\\Users\\x\\photo.png">'),
      '\\\\?\\C:\\Users\\x\\photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\?\\C:\\Users\\x\\photo.png?cache=1">'),
      '\\\\?\\C:\\Users\\x\\photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\?\\UNC\\fileserver\\art\\sketch.webp">'),
      '\\\\?\\UNC\\fileserver\\art\\sketch.webp'
    );
  });

  it('extracts absolute local .jpe paths (classic JPEG alias)', () => {
    // jpe?g matches jpg/jpeg only — bare .jpe used to be rejected.
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/photo.jpe">'), '/tmp/photo.jpe');
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Camera/IMG_0001.JPE">'),
      'file:///tmp/Camera/IMG_0001.JPE'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\photo.jpe">'),
      '\\\\fileserver\\art\\photo.jpe'
    );
  });

  it('extracts absolute local .jfif paths (Windows JPEG alias)', () => {
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/photo.jfif">'), '/tmp/photo.jfif');
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Camera/IMG_0001.JFIF">'),
      'file:///tmp/Camera/IMG_0001.JFIF'
    );
  });

  it('extracts absolute local .pjpeg paths (IE progressive JPEG alias)', () => {
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/photo.pjpeg">'), '/tmp/photo.pjpeg');
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Camera/IMG_0001.PJPEG">'),
      'file:///tmp/Camera/IMG_0001.PJPEG'
    );
  });

  it('extracts absolute local .pjp paths (Chromium progressive JPEG alias)', () => {
    // Distinct from .pjpeg — Chromium's short progressive-JPEG extension.
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/photo.pjp">'), '/tmp/photo.pjp');
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Camera/IMG_0001.PJP">'),
      'file:///tmp/Camera/IMG_0001.PJP'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\photo.pjp">'),
      '\\\\fileserver\\art\\photo.pjp'
    );
  });

  it('extracts absolute local .avif paths (modern Chromium image format)', () => {
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/photo.avif">'), '/tmp/photo.avif');
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Camera/IMG_0001.AVIF">'),
      'file:///tmp/Camera/IMG_0001.AVIF'
    );
  });

  it('extracts absolute local .ico paths (Windows icon / Chromium)', () => {
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/app.ico">'), '/tmp/app.ico');
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Icons/App.ICO">'),
      'file:///tmp/Icons/App.ICO'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\app.ico">'),
      '\\\\fileserver\\art\\app.ico'
    );
  });

  it('extracts absolute local .tif / .tiff paths (scanner / photo TIFF)', () => {
    // Distinct from .gif/.avif — scanners and photo apps often Copy TIFF paths.
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/scan.tif">'), '/tmp/scan.tif');
    assert.equal(imageRefFromClipboardHtml('<img src="/tmp/scan.tiff">'), '/tmp/scan.tiff');
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Camera/IMG_0001.TIF">'),
      'file:///tmp/Camera/IMG_0001.TIF'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/Camera/IMG_0001.TIFF">'),
      'file:///tmp/Camera/IMG_0001.TIFF'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\scan.tiff">'),
      '\\\\fileserver\\art\\scan.tiff'
    );
  });

  it('ignores non-image http(s) sources and empty input', () => {
    assert.equal(imageRefFromClipboardHtml('<img src="https://example.com/a.png">'), null);
    assert.equal(imageRefFromClipboardHtml('<p>no image</p>'), null);
    assert.equal(imageRefFromClipboardHtml(''), null);
    assert.equal(imageRefFromClipboardHtml(null), null);
  });

  it('skips a leading remote <img> to reach a later embeddable one', () => {
    // Browser / mail "Copy" HTML often prefixes a favicon or CDN pixel.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/favicon.png"><img src="file:///tmp/photo.png">'
      ),
      'file:///tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/a.png" alt=""><img src="/tmp/clip.webp" alt="sketch">'
      ),
      '/tmp/clip.webp'
    );
    // Still reject when every <img> is remote-only.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/a.png"><img src="https://example.com/b.png">'
      ),
      null
    );
  });

  it('extracts embeddable urls from <amp-img> when plain <img> is absent', () => {
    // AMP "Copy" HTML uses <amp-img> with the same src / data-src attrs.
    assert.equal(
      imageRefFromClipboardHtml('<amp-img src="file:///tmp/a.png" width="10" height="10"></amp-img>'),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<amp-img src="https://example.com/x.png" data-src="/tmp/clip.webp"></amp-img>'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><amp-img src="data:image/png;base64,aaa="></amp-img>'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only amp-img stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml('<amp-img src="https://example.com/a.png"></amp-img>'),
      null
    );
  });

  it('decodes entity-quoted src attributes from CF_HTML fragments', () => {
    const html = '<img src=&quot;data:image/png;base64,aaa=&quot; width=&quot;10&quot;>';
    assert.equal(imageRefFromClipboardHtml(html), 'data:image/png;base64,aaa=');
  });

  it('decodes &amp; inside file: image paths', () => {
    const html = '<img src="file:///tmp/a&amp;b.png">';
    assert.equal(imageRefFromClipboardHtml(html), 'file:///tmp/a&b.png');
  });

  it('decodes &nbsp; in local image paths (named entity)', () => {
    // Numeric &#160; already worked; named &nbsp; used to stay literal and
    // break existsSync for Word/mail CF_HTML paths with spaces.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&nbsp;b.png">'),
      '/tmp/a\u00A0b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&nbsp;sketch.webp">'),
      'file:///tmp/cool\u00A0sketch.webp'
    );
  });

  it('decodes &ensp; / &emsp; / &thinsp; / &hairsp; in local image paths', () => {
    // Same Word/mail CF_HTML space-entity class as &nbsp; — left literal they
    // break existsSync; localPath normalizes the decoded chars to ASCII space.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&ensp;b.png">'),
      '/tmp/a\u2002b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&emsp;b.png">'),
      '/tmp/a\u2003b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&thinsp;sketch.webp">'),
      'file:///tmp/cool\u2009sketch.webp'
    );
    // Named &hairsp; (U+200A) — numeric &#x200A; already worked via the
    // generic decimal/hex decoder; the named form must match too.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&hairsp;b.png">'),
      '/tmp/a\u200Ab.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&HAIRSP;sketch.webp">'),
      'file:///tmp/cool\u200Asketch.webp'
    );
  });

  it('decodes &numsp; / &puncsp; in local image paths', () => {
    // Named figure / punctuation spaces (U+2007 / U+2008) — numeric
    // &#x2007;/&#x2008; already decode; named forms must match too or the
    // literal "&numsp;" / "&puncsp;" segment breaks existsSync. localPath
    // normalizes the decoded chars to ASCII space.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&numsp;b.png">'),
      '/tmp/a\u2007b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&puncsp;b.png">'),
      '/tmp/a\u2008b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&NUMSP;sketch.webp">'),
      'file:///tmp/cool\u2007sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&PUNCSP;sketch.webp">'),
      'file:///tmp/cool\u2008sketch.webp'
    );
  });

  it('decodes &emsp13; / &emsp14; in local image paths', () => {
    // Named three-per-em / four-per-em spaces (U+2004 / U+2005) — numeric
    // &#x2004;/&#x2005; already decode; named forms must match too or the
    // literal "&emsp13;" / "&emsp14;" segment breaks existsSync. localPath
    // normalizes the decoded chars to ASCII space.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&emsp13;b.png">'),
      '/tmp/a\u2004b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&emsp14;b.png">'),
      '/tmp/a\u2005b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&EMSP13;sketch.webp">'),
      'file:///tmp/cool\u2004sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&EMSP14;sketch.webp">'),
      'file:///tmp/cool\u2005sketch.webp'
    );
  });

  it('decodes &circ; / &mediumsp; / &nnbsp; in local image paths', () => {
    // Named six-per-em / medium math / narrow no-break spaces
    // (U+2006 / U+205F / U+202F) — numeric &#x2006;/&#x205F;/&#x202F; already
    // decode; named forms must match too or the literal "&circ;" /
    // "&mediumsp;" / "&nnbsp;" segment breaks existsSync. localPath
    // normalizes the decoded chars to ASCII space.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&circ;b.png">'),
      '/tmp/a\u2006b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&mediumsp;b.png">'),
      '/tmp/a\u205Fb.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&nnbsp;b.png">'),
      '/tmp/a\u202Fb.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&CIRC;sketch.webp">'),
      'file:///tmp/cool\u2006sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="file:///tmp/cool&MEDIUMSP;sketch.webp">'
      ),
      'file:///tmp/cool\u205Fsketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="file:///tmp/cool&NNBSP;sketch.webp">'
      ),
      'file:///tmp/cool\u202Fsketch.webp'
    );
  });

  it('decodes &shy; / &zwnj; / &zwj; / &ZeroWidthSpace; in local image paths', () => {
    // Word wraps long paths with soft hyphens / zero-width joiners; left
    // literal they break existsSync. localPath strips the decoded chars.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&shy;sketch.png">'),
      '/tmp/cool\u00ADsketch.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&zwnj;sketch.webp">'),
      'file:///tmp/cool\u200Csketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&zwj;sketch.png">'),
      '/tmp/cool\u200Dsketch.png'
    );
    // Named &ZeroWidthSpace; (not only &#8203;) must decode to U+200B.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&ZeroWidthSpace;sketch.png">'),
      '/tmp/cool\u200Bsketch.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="file:///tmp/cool&zerowidthspace;sketch.webp">'
      ),
      'file:///tmp/cool\u200Bsketch.webp'
    );
  });

  it('decodes &WJ; / &NoBreak; in local image paths', () => {
    // HTML5 word-joiner names (&WJ; / &NoBreak; → U+2060). Numeric &#8288;
    // already worked; left as literal entity text they break existsSync.
    // localPath strips the decoded U+2060.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&WJ;sketch.png">'),
      '/tmp/cool\u2060sketch.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&NoBreak;sketch.webp">'),
      'file:///tmp/cool\u2060sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&wj;sketch.png">'),
      '/tmp/cool\u2060sketch.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&nobreak;sketch.png">'),
      '/tmp/cool\u2060sketch.png'
    );
  });

  it('decodes &lrm; / &rlm; in local image paths', () => {
    // Word/Outlook CF_HTML injects bidi marks into paths; left literal (or
    // decoded but unstripped) they break existsSync. localPath strips them.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&lrm;sketch.png">'),
      '/tmp/cool\u200Esketch.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&rlm;sketch.webp">'),
      'file:///tmp/cool\u200Fsketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&LRM;sketch.png">'),
      '/tmp/cool\u200Esketch.png'
    );
  });

  it('decodes &ndash; / &mdash; / &minus; in local image paths', () => {
    // Word auto-formats hyphens in CF_HTML paths; left literal they break
    // existsSync. localPath maps the decoded chars to ASCII '-'.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&ndash;b.png">'),
      '/tmp/a\u2013b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&mdash;sketch.webp">'),
      'file:///tmp/cool\u2014sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&minus;b.png">'),
      '/tmp/a\u2212b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&NDASH;b.png">'),
      '/tmp/a\u2013b.png'
    );
  });

  it('decodes &hyphen; in local image paths', () => {
    // Named &hyphen; (U+2010) — numeric &#8208; already worked via the generic
    // decoder; the named form must match too. localPath maps to ASCII '-'.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&hyphen;b.png">'),
      '/tmp/a\u2010b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&HYPHEN;sketch.webp">'),
      'file:///tmp/cool\u2010sketch.webp'
    );
  });

  it('decodes &period; / &colon; / &sol; / &bsol; / &frasl; in local image paths', () => {
    // Named path punctuation — left literal, embeddableImageRef rejects
    // photo&period;png and drive paths like C&colon;\… never match on disk.
    // Numeric &#46;/&#58;/&#47;/&#92;/&#8260; already worked; named forms must
    // match. &frasl; decodes to U+2044 (localPath maps to ASCII '/').
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&period;png">'),
      '/tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="&sol;tmp&sol;cool&period;webp">'),
      '/tmp/cool.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="C&colon;&bsol;Users&bsol;x&bsol;a&period;png">'),
      'C:\\Users\\x\\a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&frasl;b&period;png">'),
      '/tmp/a\u2044b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/cool&PERIOD;sketch&period;webp">'),
      'file:///tmp/cool.sketch.webp'
    );
  });

  it('decodes &quest; / &num; query-hash delimiters in local image paths', () => {
    // Named ? / # — left literal, embeddableImageRef rejects
    // photo.png&quest;v=1 (extension check fails) and existsSync fails on the
    // &quest; / &num; segment. Numeric &#63;/&#35; already worked; named forms
    // must match so stripQueryHash / fileURLToPath can drop the buster.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a.png&quest;v=1">'),
      '/tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a.png&num;frag">'),
      '/tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/clip.webp&QUEST;cache=1&NUM;x">'),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:///tmp/a.png&quest;v=1">'),
      'file:///tmp/a.png?v=1'
    );
  });

  it('decodes &percnt; in local image paths (percent-encoding)', () => {
    // HTML5 named % — left literal, embeddableImageRef rejects
    // photo&percnt;20x.png and existsSync fails on the "&percnt;" segment.
    // Numeric &#37; already worked; named form must match so main-process
    // localPath can decodeURIComponent %20 → space.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/photo&percnt;20x.png">'),
      '/tmp/photo%20x.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&PERCNT;20sketch.webp">'),
      '/tmp/cool%20sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="file:///tmp/a&percnt;2Fb&percnt;20c.png">'
      ),
      'file:///tmp/a%2Fb%20c.png'
    );
  });

  it('decodes &equals; in local image paths', () => {
    // HTML5 named = — left literal, existsSync fails on the "&equals;" segment
    // (filenames with '=' and fully-named query tails). Numeric &#61; already
    // worked; named form must match.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a&equals;b.png">'),
      '/tmp/a=b.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&EQUALS;sketch.webp">'),
      '/tmp/cool=sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/a.png&quest;v&equals;1">'),
      '/tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="file:///tmp/a&equals;b.png&quest;v&equals;1">'
      ),
      'file:///tmp/a=b.png?v=1'
    );
  });

  it('decodes &lowbar; in local image paths', () => {
    // HTML5 named _ — left literal, existsSync fails on the "&lowbar;" segment
    // (underscored filenames are common in CF_HTML exports). Numeric &#95;
    // already worked; named form must match.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/my&lowbar;photo.png">'),
      '/tmp/my_photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool&LOWBAR;sketch.webp">'),
      '/tmp/cool_sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="file:///tmp/a&lowbar;b.png&quest;v=1">'
      ),
      'file:///tmp/a_b.png?v=1'
    );
  });

  it('decodes numeric character references around src (&#34; / &#x22;)', () => {
    const decimal = '<img src=&#34;data:image/png;base64,aaa=&#34; width=&#34;10&#34;>';
    assert.equal(imageRefFromClipboardHtml(decimal), 'data:image/png;base64,aaa=');
    const hex = '<img src=&#x22;file:///tmp/a.png&#x22;>';
    assert.equal(imageRefFromClipboardHtml(hex), 'file:///tmp/a.png');
  });

  it('falls back to srcset when src is missing, empty, or non-embeddable', () => {
    assert.equal(
      imageRefFromClipboardHtml('<img srcset="data:image/png;base64,aaa= 1x">'),
      'data:image/png;base64,aaa='
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="" srcset="file:///tmp/a.png 1x, file:///tmp/b.png 2x">'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/a.png" srcset="/tmp/clip.webp 1x">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img srcset="https://example.com/a.png 1x">'),
      null
    );
  });

  it('prefers lazy-load data-src over a tiny placeholder src data URL', () => {
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-src="file:///tmp/real.png" width="10">`
      ),
      'file:///tmp/real.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="about:blank" data-original="/tmp/clip.webp">`
      ),
      '/tmp/clip.webp'
    );
    // Real (non-tiny) data: src still wins over a stale data-src.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" data-src="file:///tmp/other.png">'
      ),
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    );
  });

  it('prefers gallery hi-res / zoom / full-src attrs over remote or blank src', () => {
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-hi-res-src="file:///tmp/hi.png">'
      ),
      'file:///tmp/hi.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-full-src="/tmp/clip.webp" src="https://cdn.example.com/a.png">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-zoom-image="file:///tmp/zoom.png" src="https://cdn.example.com/t.png">'
      ),
      'file:///tmp/zoom.png'
    );
    // Elevate Zoom / similar lightboxes stash the full asset in data-zoom-src
    // (not data-zoom-image). Without this, Ctrl+V reports no image.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-zoom-src="file:///tmp/zoom-src.png" src="https://cdn.example.com/t.png">'
      ),
      'file:///tmp/zoom-src.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-zoom-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    // data-zoom-image still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-zoom-image="file:///tmp/a.png" data-zoom-src="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="about:blank" data-large="file:///tmp/large.png">'
      ),
      'file:///tmp/large.png'
    );
  });

  it('prefers Pinterest data-pin-media over a remote thumb src', () => {
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://i.pinimg.com/236x/ab/cd.jpg" data-pin-media="file:///tmp/pin.png">'
      ),
      'file:///tmp/pin.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-pin-media="/tmp/clip.webp" src="https://i.pinimg.com/originals/x.jpg">'
      ),
      '/tmp/clip.webp'
    );
    // Remote-only pin media stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://i.pinimg.com/236x/ab/cd.jpg" data-pin-media="https://i.pinimg.com/originals/ab/cd.jpg">'
      ),
      null
    );
  });

  it('prefers Angular ng-src over a missing or remote thumb src', () => {
    // Angular "Copy" HTML often uses ng-src with no plain src attribute.
    assert.equal(
      imageRefFromClipboardHtml('<img ng-src="file:///tmp/ng.png" alt="x">'),
      'file:///tmp/ng.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" ng-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img ng-src="data:image/png;base64,aaa=" width="10">'
      ),
      'data:image/png;base64,aaa='
    );
    // Real (non-tiny) data: src still wins over a stale ng-src.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" ng-src="file:///tmp/other.png">'
      ),
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    );
    // Remote-only ng-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" ng-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers echo.js data-echo over a remote or spacer thumb src', () => {
    // Echo Lazy Load / similar WP plugins put the real file in data-echo.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-echo="file:///tmp/echo.png">`
      ),
      'file:///tmp/echo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-echo="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-echo="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-echo stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-echo="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-real-src over a remote or spacer thumb src', () => {
    // CDN / East-Asian lazy-loaders often put the real file in data-real-src.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-real-src="file:///tmp/real.png">`
      ),
      'file:///tmp/real.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-real-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-real-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-real-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-real-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-true-src over a remote or spacer thumb src', () => {
    // Some CDN / theme lazy-loaders stash the full asset in data-true-src
    // (distinct from data-real-src / data-actualsrc). Without this, Ctrl+V
    // reports no image when src is a remote thumb or 1×1 spacer.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-true-src="file:///tmp/true.png">`
      ),
      'file:///tmp/true.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-true-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-true-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // data-real-src still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-real-src="file:///tmp/a.png" data-true-src="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-true-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-true-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers Cloudflare data-cfsrc over a remote or spacer thumb src', () => {
    // CF Mirage / Rocket Loader stash the real file in data-cfsrc.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-cfsrc="file:///tmp/cf.png">`
      ),
      'file:///tmp/cf.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-cfsrc="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-cfsrc="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-cfsrc stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-cfsrc="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers Baidu data-actualsrc over a remote or spacer thumb src', () => {
    // Baidu image search / similar lazy-loaders stash the real asset here.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-actualsrc="file:///tmp/actual.png">`
      ),
      'file:///tmp/actual.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-actualsrc="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-actualsrc="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-actualsrc stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-actualsrc="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers classic lowsrc over a remote or spacer thumb src', () => {
    // Older HTML / exporters put a progressive preview in lowsrc.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" lowsrc="file:///tmp/low.png">`
      ),
      'file:///tmp/low.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" lowsrc="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img lowsrc="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only lowsrc stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" lowsrc="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers retina.js data-src-retina over a remote or spacer thumb src', () => {
    // retina.js / HiDPI "Copy" HTML stashes the @2x file in data-src-retina.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-src-retina="file:///tmp/retina.png">`
      ),
      'file:///tmp/retina.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-src-retina="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-src-retina="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-src-retina stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-src-retina="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers WP Smush data-smush-src over a remote or spacer thumb src', () => {
    // Smush / Smush.it "Copy" HTML stashes the optimized file in data-smush-src.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-smush-src="file:///tmp/smush.png">`
      ),
      'file:///tmp/smush.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-smush-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-smush-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-smush-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-smush-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-bigsrc over a remote or spacer thumb src', () => {
    // Gallery / CDN "Copy" HTML often stashes the full asset in data-bigsrc.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-bigsrc="file:///tmp/big.png">`
      ),
      'file:///tmp/big.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-bigsrc="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-bigsrc="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-bigsrc stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-bigsrc="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers WooCommerce data-large_image over a remote or spacer thumb src', () => {
    // WooCommerce product gallery markup stashes the full file here.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-large_image="file:///tmp/product.png">`
      ),
      'file:///tmp/product.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb-300x300.jpg" data-large_image="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-large_image="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-large_image stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-large_image="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-lazyload-src over a remote or spacer thumb src', () => {
    // a3/a9 Lazy Load and similar WP plugins stash the full file here.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-lazyload-src="file:///tmp/lazy.png">`
      ),
      'file:///tmp/lazy.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-lazyload-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-lazyload-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only data-lazyload-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-lazyload-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-highres over a remote or spacer thumb src', () => {
    // Theme / gallery "Copy" HTML often uses data-highres (no hyphens), distinct
    // from data-hi-res-src. Without this, Ctrl+V reports no image.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-highres="file:///tmp/high.png">`
      ),
      'file:///tmp/high.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-highres="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-highres="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // data-hi-res-src still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-hi-res-src="file:///tmp/a.png" data-highres="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-highres stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-highres="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers PageSpeed data-pagespeed-lazy-src over a remote or spacer thumb src', () => {
    // Google PageSpeed / mod_pagespeed rewrites put the real file here while
    // src stays a spacer or remote thumb. Without this, Ctrl+V reports no image.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-pagespeed-lazy-src="file:///tmp/ps.png">`
      ),
      'file:///tmp/ps.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-pagespeed-lazy-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-pagespeed-lazy-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // data-highres still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-highres="file:///tmp/a.png" data-pagespeed-lazy-src="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-pagespeed-lazy-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-pagespeed-lazy-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers LiteSpeed data-litespeed-src over a remote or spacer thumb src', () => {
    // LiteSpeed Cache lazy-load rewrites put the real file here while src
    // stays a spacer or remote thumb. Without this, Ctrl+V reports no image.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-litespeed-src="file:///tmp/ls.png">`
      ),
      'file:///tmp/ls.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-litespeed-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-litespeed-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // data-pagespeed-lazy-src still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-pagespeed-lazy-src="file:///tmp/a.png" data-litespeed-src="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-litespeed-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-litespeed-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers lazysizes data-ll-src over a remote or spacer thumb src', () => {
    // lazysizes / forks stash the real file in data-ll-src (distinct from
    // data-lazy-src / data-src). Without this, Ctrl+V reports no image.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-ll-src="file:///tmp/ll.png">`
      ),
      'file:///tmp/ll.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-ll-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-ll-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // data-lazy still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-lazy="file:///tmp/a.png" data-ll-src="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-ll-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-ll-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-lazy over a remote or spacer thumb src', () => {
    // Older themes / custom lazy-load scripts put the real URL in data-lazy
    // (distinct from data-lazy-src / data-lazyload-src). Boolean flags must
    // not steal the match — embeddableImageRef rejects "true"/"lazy".
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-lazy="file:///tmp/lazy.png">`
      ),
      'file:///tmp/lazy.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-lazy="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-lazy="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Boolean / class-like data-lazy flags are not URLs — ignore them and keep
    // the same reject policy as a remote-only <img src>.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-lazy="true">'
      ),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-lazy="lazy">'
      ),
      null
    );
    // Remote-only data-lazy stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-lazy="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-original-src over a remote or spacer thumb src', () => {
    // Theme / CDN lazy-loaders often stash the full asset in data-original-src
    // (distinct from data-original). Without this, Ctrl+V reports no image.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-original-src="file:///tmp/orig.png">`
      ),
      'file:///tmp/orig.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-original-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-original-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // data-original still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-original="file:///tmp/a.png" data-original-src="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-original-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-original-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-origsrc over a remote or spacer thumb src', () => {
    // Compact WP / CDN lazy-load form (no hyphen) — distinct from data-orig-file /
    // data-original / data-original-src. Without this, Ctrl+V reports no image.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-origsrc="file:///tmp/orig.png">`
      ),
      'file:///tmp/orig.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-origsrc="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-origsrc="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // data-orig-file still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-orig-file="file:///tmp/a.png" data-origsrc="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-origsrc stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-origsrc="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers data-orig-src over a remote or spacer thumb src', () => {
    // BJ Lazy Load / a3 Lazy Load hyphenated form — distinct from compact
    // data-origsrc and from data-original-src / data-orig-file. Without this,
    // Ctrl+V reports no image when src is a remote thumb or 1×1 spacer.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-orig-src="file:///tmp/orig.png">`
      ),
      'file:///tmp/orig.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb.png" data-orig-src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-orig-src="data:image/png;base64,aaa=" alt="x">'
      ),
      'data:image/png;base64,aaa='
    );
    // Must not steal data-original-src (longer name) — attr boundaries keep them distinct.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-original-src="file:///tmp/a.png">'
      ),
      'file:///tmp/a.png'
    );
    // Compact data-origsrc still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-origsrc="file:///tmp/a.png" data-orig-src="file:///tmp/b.png">'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only data-orig-src stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.png" data-orig-src="https://cdn.example.com/full.png">'
      ),
      null
    );
  });

  it('prefers WordPress data-orig-file / data-large-file / data-medium-file over a remote thumb src', () => {
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb-150x150.jpg" data-orig-file="file:///tmp/full.png">'
      ),
      'file:///tmp/full.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-large-file="/tmp/clip.webp" src="https://cdn.example.com/medium.jpg">'
      ),
      '/tmp/clip.webp'
    );
    // WP often emits only data-medium-file for mid-size attachment copies.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/thumb-150x150.jpg" data-medium-file="file:///tmp/med.png">'
      ),
      'file:///tmp/med.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-medium-file="/tmp/clip.webp" src="https://cdn.example.com/t.jpg">'
      ),
      '/tmp/clip.webp'
    );
    // Prefer orig-file, then large-file, over medium-file when several are present.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.jpg" data-orig-file="file:///tmp/a.png" data-large-file="file:///tmp/b.png" data-medium-file="file:///tmp/c.png">'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.jpg" data-large-file="file:///tmp/b.png" data-medium-file="file:///tmp/c.png">'
      ),
      'file:///tmp/b.png'
    );
    // Remote-only WP attrs stay rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.jpg" data-orig-file="https://cdn.example.com/full.jpg">'
      ),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://cdn.example.com/t.jpg" data-medium-file="https://cdn.example.com/med.jpg">'
      ),
      null
    );
  });

  it('does not let data-src steal the src attribute match', () => {
    // `\bsrc` wrongly matched `data-src` when it appeared first, so a remote
    // data-src hid a perfectly pasteable local src.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-src="https://cdn.example.com/real.png" src="file:///tmp/local.png">'
      ),
      'file:///tmp/local.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img data-srcset="https://cdn.example.com/a.png 1x" src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
  });

  it('prefers data-srcset over a tiny placeholder src data URL', () => {
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-srcset="file:///tmp/real.png 1x">`
      ),
      'file:///tmp/real.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/a.png" data-srcset="/tmp/clip.webp 1x">'
      ),
      '/tmp/clip.webp'
    );
  });

  it('prefers data-lazy-srcset over a tiny placeholder src data URL', () => {
    // WordPress / theme lazy-loaders often stash the real candidates here.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-lazy-srcset="file:///tmp/real.png 1x, file:///tmp/real@2x.png 2x">`
      ),
      'file:///tmp/real.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/a.png" data-lazy-srcset="/tmp/clip.webp 1x">'
      ),
      '/tmp/clip.webp'
    );
    // data-srcset still wins when both are present (more specific / earlier).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/a.png" data-srcset="file:///tmp/a.png 1x" data-lazy-srcset="file:///tmp/b.png 1x">'
      ),
      'file:///tmp/a.png'
    );
  });

  it('prefers data-originalset over a tiny placeholder src data URL', () => {
    // WP Rocket / similar lazy-loaders stash responsive candidates here.
    const spacer =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    assert.equal(
      imageRefFromClipboardHtml(
        `<img src="${spacer}" data-originalset="file:///tmp/real.png 1x, file:///tmp/real@2x.png 2x">`
      ),
      'file:///tmp/real.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/a.png" data-originalset="/tmp/clip.webp 1x">'
      ),
      '/tmp/clip.webp'
    );
    // data-lazy-srcset still wins when both are present (earlier in the chain).
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/a.png" data-lazy-srcset="file:///tmp/a.png 1x" data-originalset="file:///tmp/b.png 1x">'
      ),
      'file:///tmp/a.png'
    );
  });

  it('strips query/hash from absolute local image paths', () => {
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/clip.webp?cache=1#frag">'),
      '/tmp/clip.webp'
    );
  });

  it('normalizes fullwidth full stop in absolute local image paths', () => {
    // CJK IME fullwidth ． (U+FF0E) — left literal, extension match fails and
    // Ctrl+V reports "No image". Must normalize before the embeddable check.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/photo\uFF0Epng">'),
      '/tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool\uFF0Esketch\uFF0Ewebp">'),
      '/tmp/cool.sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\photo\uFF0Ejfif">'),
      '\\\\fileserver\\art\\photo.jfif'
    );
  });

  it('normalizes ideographic full stops in absolute local image paths', () => {
    // Japanese/Chinese IME 。 (U+3002) / halfwidth ｡ (U+FF61) — left literal,
    // extension match fails (same mode as ．). Must normalize before embeddable.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/photo\u3002png">'),
      '/tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool\u3002sketch\u3002webp">'),
      '/tmp/cool.sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/photo\uFF61png">'),
      '/tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\photo\u3002jfif">'),
      '\\\\fileserver\\art\\photo.jfif'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool\u3002sketch\uFF0Epng">'),
      '/tmp/cool.sketch.png'
    );
  });

  it('normalizes one-dot leader in absolute local image paths', () => {
    // Typography / some IMEs emit ․ (U+2024 ONE DOT LEADER) — left literal,
    // extension match fails (same mode as ．). Must normalize before embeddable.
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/photo\u2024png">'),
      '/tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool\u2024sketch\u2024webp">'),
      '/tmp/cool.sketch.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\\\fileserver\\art\\photo\u2024jfif">'),
      '\\\\fileserver\\art\\photo.jfif'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="/tmp/cool\u2024sketch\u3002png">'),
      '/tmp/cool.sketch.png'
    );
  });

  it('unescapes JSON-style \\/ in file: and local image paths', () => {
    // Some exporters put JSON-escaped slashes into HTML attribute values.
    assert.equal(
      imageRefFromClipboardHtml('<img src="file:\\/\\/\\/tmp\\/a.png">'),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<img src="\\/tmp\\/clip.webp">'),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<div style="background-image:url(file:\\/\\/\\/tmp\\/bg.png)"></div>'
      ),
      'file:///tmp/bg.png'
    );
  });

  it('extracts embeddable urls from object/embed when img src is absent', () => {
    assert.equal(
      imageRefFromClipboardHtml('<object data="file:///tmp/a.png" type="image/png"></object>'),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml('<embed src="/tmp/clip.webp" type="image/webp">'),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><object data="data:image/png;base64,aaa="></object>'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only object/embed stay rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml('<embed src="https://example.com/a.png">'),
      null
    );
  });

  it('extracts embeddable urls from Office VML v:imagedata when img src is absent', () => {
    assert.equal(
      imageRefFromClipboardHtml('<v:imagedata src="file:///tmp/word.png"/>'),
      'file:///tmp/word.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<v:shape><v:imagedata o:href="/tmp/clip.webp"/></v:shape>'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><v:imagedata src="file:///tmp/a.png"/>'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<v:imagedata src="data:image/png;base64,aaa="/>'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only VML stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml('<v:imagedata src="https://example.com/a.png"/>'),
      null
    );
  });

  it('extracts embeddable urls from Office VML v:fill when img src is absent', () => {
    // Word shape fills often use <v:fill src> with no <v:imagedata>.
    assert.equal(
      imageRefFromClipboardHtml(
        '<v:shape><v:fill src="file:///tmp/fill.png" type="frame"/></v:shape>'
      ),
      'file:///tmp/fill.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><v:fill o:href="/tmp/clip.webp"/>'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml('<v:fill src="data:image/png;base64,aaa="/>'),
      'data:image/png;base64,aaa='
    );
    // Document order: first embeddable VML tag wins (same as <img> walk).
    assert.equal(
      imageRefFromClipboardHtml(
        '<v:fill src="file:///tmp/fill.png"/><v:imagedata src="file:///tmp/photo.png"/>'
      ),
      'file:///tmp/fill.png'
    );
    // Remote-only VML fill stays rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml('<v:fill src="https://example.com/a.png"/>'),
      null
    );
  });

  it('extracts embeddable urls from video/audio poster when img src is absent', () => {
    assert.equal(
      imageRefFromClipboardHtml('<video poster="file:///tmp/still.png" controls></video>'),
      'file:///tmp/still.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><video poster="/tmp/clip.webp"></video>'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<video poster="data:image/png;base64,aaa=" width="320"></video>'
      ),
      'data:image/png;base64,aaa='
    );
    // Podcast / music players copy <audio poster> without a usable <img>.
    assert.equal(
      imageRefFromClipboardHtml(
        '<audio poster="file:///tmp/cover.png" controls></audio>'
      ),
      'file:///tmp/cover.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><audio poster="/tmp/art.webp"></audio>'
      ),
      '/tmp/art.webp'
    );
    // Remote-only posters stay rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml('<video poster="https://example.com/a.png"></video>'),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml('<audio poster="https://example.com/a.png"></audio>'),
      null
    );
  });

  it('extracts embeddable urls from input type=image when img src is absent', () => {
    assert.equal(
      imageRefFromClipboardHtml('<input type="image" src="file:///tmp/btn.png" alt="Go">'),
      'file:///tmp/btn.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><input type="image" src="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<input type="IMAGE" src="data:image/png;base64,aaa=" width="32">'
      ),
      'data:image/png;base64,aaa='
    );
    // Non-image inputs and remote-only image inputs stay rejected.
    assert.equal(
      imageRefFromClipboardHtml('<input type="text" src="file:///tmp/a.png">'),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml('<input type="image" src="https://example.com/a.png">'),
      null
    );
  });

  it('extracts local/data urls from picture source when img src is remote', () => {
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source srcset="file:///tmp/a.png" type="image/png"><img src="https://example.com/x.png"></picture>'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source srcset="/tmp/clip.webp 1x, /tmp/clip@2x.webp 2x"><img alt=""></picture>'
      ),
      '/tmp/clip.webp'
    );
    // Remote-only sources stay rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source srcset="https://example.com/a.png"><img src="https://example.com/b.png"></picture>'
      ),
      null
    );
  });

  it('extracts lazy data-srcset / data-src from picture source when srcset is absent', () => {
    // Themes often leave <source> without srcset and stash the real file in data-*.
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source data-srcset="file:///tmp/a.png 1x" type="image/png"><img src="https://example.com/x.png"></picture>'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source data-lazy-srcset="/tmp/clip.webp 1x"><img src="https://example.com/x.png"></picture>'
      ),
      '/tmp/clip.webp'
    );
    // WP Rocket stashes responsive candidates on <source data-originalset> too.
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source data-originalset="file:///tmp/rocket.png 1x, file:///tmp/rocket@2x.png 2x"><img src="https://example.com/x.png"></picture>'
      ),
      'file:///tmp/rocket.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source data-src="file:///tmp/photo.png"><img alt=""></picture>'
      ),
      'file:///tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source data-lazy-src="/tmp/lazy.webp"><img src="https://example.com/x.png"></picture>'
      ),
      '/tmp/lazy.webp'
    );
    // Prefer plain srcset over a stale data-srcset when both are present.
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source srcset="file:///tmp/a.png 1x" data-srcset="file:///tmp/b.png 1x"><img alt=""></picture>'
      ),
      'file:///tmp/a.png'
    );
    // Remote-only lazy source attrs stay rejected.
    assert.equal(
      imageRefFromClipboardHtml(
        '<picture><source data-srcset="https://example.com/a.png 1x"><img src="https://example.com/b.png"></picture>'
      ),
      null
    );
  });

  it('extracts embeddable urls from CSS background-image when img src is absent', () => {
    assert.equal(
      imageRefFromClipboardHtml(
        '<div style="background-image:url(data:image/png;base64,aaa=)"></div>'
      ),
      'data:image/png;base64,aaa='
    );
    assert.equal(
      imageRefFromClipboardHtml(
        "<span style=\"background: url('file:///tmp/clip.webp') no-repeat\"></span>"
      ),
      'file:///tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<div style="background-image:url(&quot;/tmp/a.png&quot;)"></div>'
      ),
      '/tmp/a.png'
    );
    // Remote CSS urls stay rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<div style="background-image:url(https://example.com/a.png)"></div>'
      ),
      null
    );
  });

  it('extracts embeddable urls from og/twitter meta and link image_src/preload', () => {
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" content="file:///tmp/preview.png">'
      ),
      'file:///tmp/preview.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta name="twitter:image" content="/tmp/clip.webp">'
      ),
      '/tmp/clip.webp'
    );
    // Some sites only emit the secure_url / :url variants (no plain og:image).
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image:secure_url" content="file:///tmp/secure.png">'
      ),
      'file:///tmp/secure.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta name="twitter:image:url" content="/tmp/tweet.webp">'
      ),
      '/tmp/tweet.webp'
    );
    // IE/Edge pinned-site tile — some copies expose only this preview meta.
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta name="msapplication-TileImage" content="file:///tmp/tile.png">'
      ),
      'file:///tmp/tile.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta itemprop="image" content="data:image/png;base64,aaa=">'
      ),
      'data:image/png;base64,aaa='
    );
    // schema.org ImageObject often uses contentUrl / thumbnailUrl (no og:image).
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta itemprop="contentUrl" content="file:///tmp/object.png">'
      ),
      'file:///tmp/object.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta itemprop="thumbnailUrl" content="/tmp/thumb.webp">'
      ),
      '/tmp/thumb.webp'
    );
    // schema.org also allows the shorter itemprop="thumbnail".
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta itemprop="thumbnail" content="file:///tmp/thumb-short.png">'
      ),
      'file:///tmp/thumb-short.png'
    );
    // Some microdata exporters put the URL on href= instead of content=.
    assert.equal(
      imageRefFromClipboardHtml('<meta itemprop="image" href="file:///tmp/meta-href.png">'),
      'file:///tmp/meta-href.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" href="/tmp/og-href.webp">'
      ),
      '/tmp/og-href.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta name="twitter:image" href="data:image/png;base64,aaa=">'
      ),
      'data:image/png;base64,aaa='
    );
    // Prefer content= when both are present (content is the HTML meta standard).
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta itemprop="image" content="file:///tmp/from-content.png" href="file:///tmp/from-href.png">'
      ),
      'file:///tmp/from-content.png'
    );
    // Remote-only href stays rejected (same policy as content=).
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" href="https://example.com/a.png">'
      ),
      null
    );
    // schema.org microdata often uses <link itemprop="image"> (no rel).
    assert.equal(
      imageRefFromClipboardHtml('<link itemprop="image" href="file:///tmp/schema.png">'),
      'file:///tmp/schema.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<link itemprop="contentUrl" href="/tmp/object.webp">'
      ),
      '/tmp/object.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<link itemprop="thumbnailUrl" href="file:///tmp/thumb.png">'
      ),
      'file:///tmp/thumb.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<link itemprop="thumbnail" href="data:image/png;base64,aaa=">'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only schema <link> stays rejected (same policy as meta itemprop).
    assert.equal(
      imageRefFromClipboardHtml(
        '<link itemprop="image" href="https://example.com/a.png">'
      ),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml('<link rel="image_src" href="file:///tmp/a.png">'),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<link rel="thumbnail" href="file:///tmp/preview.png">'
      ),
      'file:///tmp/preview.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<link rel="preload" as="image" href="/tmp/hero.webp">'
      ),
      '/tmp/hero.webp'
    );
    // Responsive preload: imagesrcset holds the local file; href is remote-only.
    assert.equal(
      imageRefFromClipboardHtml(
        '<link rel="preload" as="image" href="https://cdn.example.com/hero.png" imagesrcset="file:///tmp/hero.png 1x, file:///tmp/hero@2x.png 2x">'
      ),
      'file:///tmp/hero.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<link rel="preload" as="image" imagesrcset="/tmp/hero.webp 1x">'
      ),
      '/tmp/hero.webp'
    );
    // Prefer a real <img> over preview meta in the same fragment.
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" content="file:///tmp/meta.png"><img src="file:///tmp/photo.png">'
      ),
      'file:///tmp/photo.png'
    );
    // Prefer preview meta over an incidental toolbar SVG in the same fragment.
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" content="file:///tmp/photo.png"><svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>'
      ),
      'file:///tmp/photo.png'
    );
    // Favicons / remote-only preview tags stay rejected.
    assert.equal(
      imageRefFromClipboardHtml(
        '<link rel="icon" href="file:///tmp/favicon.png">'
      ),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" content="https://example.com/a.png">'
      ),
      null
    );
  });

  it('extracts embeddable urls from application/ld+json ImageObject / Article.image', () => {
    // Rich-copy / “View Source” HTML often ships only JSON-LD, no usable <img>.
    assert.equal(
      imageRefFromClipboardHtml(
        '<script type="application/ld+json">{"@type":"ImageObject","contentUrl":"file:///tmp/photo.png"}</script>'
      ),
      'file:///tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        "<script type='application/ld+json'>{\"@type\":\"Article\",\"image\":\"/tmp/clip.webp\"}</script>"
      ),
      '/tmp/clip.webp'
    );
    // Nested ImageObject under Article.image.
    assert.equal(
      imageRefFromClipboardHtml(
        '<script type="application/ld+json">{"@type":"Article","image":{"@type":"ImageObject","url":"file:///tmp/nested.png"}}</script>'
      ),
      'file:///tmp/nested.png'
    );
    // @graph arrays (common schema.org dumps).
    assert.equal(
      imageRefFromClipboardHtml(
        '<script type="application/ld+json">{"@graph":[{"@type":"WebPage","url":"https://example.com/"},{"@type":"ImageObject","contentUrl":"data:image/png;base64,aaa="}]}</script>'
      ),
      'data:image/png;base64,aaa='
    );
    // Prefer a real <img> / og:image meta over incidental JSON-LD.
    assert.equal(
      imageRefFromClipboardHtml(
        '<script type="application/ld+json">{"@type":"ImageObject","contentUrl":"file:///tmp/ld.png"}</script><img src="file:///tmp/photo.png">'
      ),
      'file:///tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" content="file:///tmp/meta.png"><script type="application/ld+json">{"@type":"ImageObject","contentUrl":"file:///tmp/ld.png"}</script>'
      ),
      'file:///tmp/meta.png'
    );
    // Remote-only / invalid JSON stay rejected.
    assert.equal(
      imageRefFromClipboardHtml(
        '<script type="application/ld+json">{"@type":"ImageObject","contentUrl":"https://example.com/a.png"}</script>'
      ),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<script type="application/ld+json">{not json</script>'
      ),
      null
    );
  });

  it('extracts embeddable urls from <a href> when img src is absent or remote', () => {
    assert.equal(
      imageRefFromClipboardHtml('<a href="file:///tmp/a.png">photo</a>'),
      'file:///tmp/a.png'
    );
    // Image maps: usable target is often only on <area href>.
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/map.png" usemap="#m"><map name="m"><area shape="rect" coords="0,0,10,10" href="file:///tmp/a.png"></map>'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<map name="m"><area href="/tmp/clip.webp" coords="0,0,1,1"></map>'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<map><area href="data:image/png;base64,aaa=" shape="default"></map>'
      ),
      'data:image/png;base64,aaa='
    );
    // Remote-only area href stays rejected (same policy as <a href>).
    assert.equal(
      imageRefFromClipboardHtml(
        '<map><area href="https://example.com/a.png" coords="0,0,1,1"></map>'
      ),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml('<a href="data:image/png;base64,aaa=">x</a>'),
      'data:image/png;base64,aaa='
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<figure><a href="/tmp/a.png"><img src="https://example.com/x.png"></a></figure>'
      ),
      '/tmp/a.png'
    );
    // Prefer a real <img> over an incidental image-file link.
    assert.equal(
      imageRefFromClipboardHtml(
        '<a href="file:///tmp/meta.png"><img src="file:///tmp/photo.png"></a>'
      ),
      'file:///tmp/photo.png'
    );
    // Prefer preview meta over an incidental image-file link.
    assert.equal(
      imageRefFromClipboardHtml(
        '<meta property="og:image" content="file:///tmp/photo.png"><a href="file:///tmp/other.png">x</a>'
      ),
      'file:///tmp/photo.png'
    );
    // Non-image and remote-only hrefs stay rejected.
    assert.equal(
      imageRefFromClipboardHtml('<a href="/tmp/notes.txt">notes</a>'),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml('<a href="https://example.com/a.png">x</a>'),
      null
    );
  });

  it('extracts embeddable urls from lazysizes data-bg / data-bgset when img src is absent', () => {
    // lazysizes "Copy" HTML often puts the asset only on data-bg / data-bgset.
    assert.equal(
      imageRefFromClipboardHtml('<div class="lazyload" data-bg="file:///tmp/bg.png"></div>'),
      'file:///tmp/bg.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<section data-bgset="/tmp/clip.webp 1x, /tmp/clip@2x.webp 2x"></section>'
      ),
      '/tmp/clip.webp'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<img src="https://example.com/x.png"><div data-bg="data:image/png;base64,aaa="></div>'
      ),
      'data:image/png;base64,aaa='
    );
    // Prefer a real <img> over an incidental data-bg in the same fragment.
    assert.equal(
      imageRefFromClipboardHtml(
        '<div data-bg="file:///tmp/bg.png"><img src="file:///tmp/photo.png"></div>'
      ),
      'file:///tmp/photo.png'
    );
    // Prefer data-bg over data-bgset when both are present.
    assert.equal(
      imageRefFromClipboardHtml(
        '<div data-bg="file:///tmp/a.png" data-bgset="file:///tmp/b.png 1x"></div>'
      ),
      'file:///tmp/a.png'
    );
    // Prefer data-bg over an incidental toolbar SVG in the same fragment.
    assert.equal(
      imageRefFromClipboardHtml(
        '<div data-bg="file:///tmp/photo.png"></div><svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>'
      ),
      'file:///tmp/photo.png'
    );
    // Remote-only data-bg / data-bgset stay rejected (same policy as <img src>).
    assert.equal(
      imageRefFromClipboardHtml('<div data-bg="https://example.com/a.png"></div>'),
      null
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<div data-bgset="https://example.com/a.png 1x, https://example.com/b.png 2x"></div>'
      ),
      null
    );
  });

  it('extracts SVG <image href>/xlink:href and inline <svg> from HTML fragments', () => {
    assert.equal(
      imageRefFromClipboardHtml(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///tmp/a.png" width="10" height="10"/></svg>'
      ),
      'file:///tmp/a.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="/tmp/clip.webp"/></svg>'
      ),
      '/tmp/clip.webp'
    );
    // Designer / browser "Copy as SVG" often lands only in text/html.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>';
    assert.equal(
      imageRefFromClipboardHtml(`<!--StartFragment-->${svg}<!--EndFragment-->`),
      `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
    );
    // Prefer a real <img> over an incidental toolbar SVG icon in the same fragment.
    assert.equal(
      imageRefFromClipboardHtml(
        `<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg><img src="file:///tmp/photo.png">`
      ),
      'file:///tmp/photo.png'
    );
    assert.equal(
      imageRefFromClipboardHtml(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>'
      ),
      null
    );
  });
});
