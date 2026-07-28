const { stripQueryHashFromLocalPath } = require('./local-path');

/**
 * Pull an embeddable image reference out of clipboard HTML.
 * Browsers often copy an <img> as text/html while readImage()/buffers stay empty.
 * Returns a data: URL, a file: URL / local path, or null.
 */

/** Decode the entities common in CF_HTML / browser clipboard fragments. */
function decodeBasicHtmlEntities(value) {
  // Named entities first (&amp; before numerics so &amp;#34; → &#34; → ").
  let out = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    // Word / mail CF_HTML often uses &nbsp; / &ensp; / &emsp; / &thinsp; /
    // &hairsp; in local paths; leaving them literal made existsSync fail and
    // Ctrl+V report "No image". Numeric &#160;/&#x2002;/&#x200A; already
    // decode below — named forms must match. localPathFromFileUrlOrPath then
    // maps these to ASCII space.
    .replace(/&nbsp;/gi, '\u00A0')
    .replace(/&ensp;/gi, '\u2002')
    .replace(/&emsp;/gi, '\u2003')
    .replace(/&thinsp;/gi, '\u2009')
    .replace(/&hairsp;/gi, '\u200A')
    // Word / HTML serializers also emit &numsp; (U+2007 figure space) and
    // &puncsp; (U+2008 punctuation space) in local paths. Numeric &#x2007;/
    // &#x2008; already decode below; named forms must match. localPath then
    // maps these (via U+2000–U+200A) to ASCII space — without decoding,
    // existsSync fails on the literal "&numsp;" / "&puncsp;" segment.
    .replace(/&numsp;/gi, '\u2007')
    .replace(/&puncsp;/gi, '\u2008')
    // HTML5 also names &emsp13; (U+2004 three-per-em space) and &emsp14;
    // (U+2005 four-per-em space). Numeric &#x2004;/&#x2005; already decode;
    // named forms must match or existsSync fails on the literal "&emsp13;" /
    // "&emsp14;" segment. localPath maps both (via U+2000–U+200A) to ASCII space.
    .replace(/&emsp13;/gi, '\u2004')
    .replace(/&emsp14;/gi, '\u2005')
    // Same class: &circ; (U+2006 six-per-em space), &mediumsp; (U+205F
    // medium mathematical space), and &nnbsp; (U+202F narrow no-break space).
    // Numeric &#x2006;/&#x205F;/&#x202F; already decode; named forms must match
    // or existsSync fails on the literal entity text. localPath maps all three
    // to ASCII space (U+2006 via U+2000–U+200A; U+205F / U+202F via their
    // explicit entries in that normalizer).
    .replace(/&circ;/gi, '\u2006')
    .replace(/&mediumsp;/gi, '\u205F')
    .replace(/&nnbsp;/gi, '\u202F')
    // Soft hyphen / zero-width joiners also appear in wrapped Word paths.
    // Decode so localPath can strip them (literal &shy; never exists on disk).
    .replace(/&shy;/gi, '\u00AD')
    .replace(/&zwnj;/gi, '\u200C')
    .replace(/&zwj;/gi, '\u200D')
    // Word / some HTML serializers insert &ZeroWidthSpace; (U+200B). Numeric
    // &#8203; already decoded below; the named form must match or existsSync
    // fails on the literal "&ZeroWidthSpace;" segment and Ctrl+V reports no image.
    .replace(/&ZeroWidthSpace;/gi, '\u200B')
    // HTML5 also names the word joiner as &WJ; / &NoBreak; (U+2060). Numeric
    // &#8288;/&#x2060; already decode below; named forms must match or
    // existsSync fails on the literal "&WJ;" / "&NoBreak;" segment. localPath
    // already strips U+2060 (same class as ZWSP / soft hyphen).
    .replace(/&WJ;/gi, '\u2060')
    .replace(/&NoBreak;/gi, '\u2060')
    // Bidirectional marks (&lrm; / &rlm;) appear in Word/Outlook CF_HTML paths.
    // Numeric &#8206;/&#8207; already decode below; named forms must match too —
    // localPath strips the decoded chars (they never exist on disk).
    .replace(/&lrm;/gi, '\u200E')
    .replace(/&rlm;/gi, '\u200F')
    // Word/Outlook often auto-formats hyphens in paths as &ndash; / &mdash; /
    // &minus; / &hyphen;. Left literal they break existsSync; numeric
    // &#8211;/&#8212;/&#8722;/&#8208; already decode below — named forms must
    // match. localPath then maps these to ASCII hyphen-minus (the character
    // almost always on disk).
    .replace(/&ndash;/gi, '\u2013')
    .replace(/&mdash;/gi, '\u2014')
    .replace(/&minus;/gi, '\u2212')
    .replace(/&hyphen;/gi, '\u2010')
    // HTML serializers / CF_HTML sometimes emit named punctuation in local
    // paths (&period; / &colon; / &sol; / &bsol; / &frasl;). Left literal,
    // the extension check rejects photo&period;png and existsSync fails on
    // C&colon;\… — numeric &#46;/&#58;/&#47;/&#92;/&#8260; already decode
    // below; named forms must match. &frasl; → U+2044; localPath maps that
    // (and companion slashes) to ASCII '/'.
    .replace(/&period;/gi, '.')
    .replace(/&colon;/gi, ':')
    .replace(/&sol;/gi, '/')
    .replace(/&bsol;/gi, '\\')
    .replace(/&frasl;/gi, '\u2044')
    // Named &quest; (?) / &num; (#) appear in CF_HTML for lazy-load
    // ?query / #hash after a local image path. Left literal, the extension
    // check rejects photo.png&quest;v=1 (and existsSync fails on the
    // &quest; / &num; segment). Numeric &#63;/&#35; already decode below;
    // named forms must match so stripQueryHashFromLocalPath / fileURLToPath
    // can drop the cache-buster.
    .replace(/&quest;/gi, '?')
    .replace(/&num;/gi, '#')
    // HTML5 &percnt; (%) shows up in CF_HTML for percent-encoded local paths
    // (photo&percnt;20x.png). Left literal, the extension check rejects the
    // path and existsSync fails on the "&percnt;" segment. Numeric &#37;
    // already decodes below; the named form must match so localPath can
    // decodeURIComponent %20 → space (same as a bare %20 exporter).
    .replace(/&percnt;/gi, '%')
    // HTML5 &equals; (=) appears in CF_HTML for filenames that contain '='
    // (a&equals;b.png) and in fully-named query tails (&quest;v&equals;1).
    // Left literal, existsSync fails on the "&equals;" segment. Numeric &#61;
    // already decodes below; the named form must match.
    .replace(/&equals;/gi, '=')
    // HTML5 &lowbar; (_) is common in CF_HTML for underscored filenames
    // (my&lowbar;photo.png). Left literal, existsSync fails on the "&lowbar;"
    // segment. Numeric &#95; already decodes below; the named form must match.
    .replace(/&lowbar;/gi, '_')
    // HTML5 &comma; (,) / &semi; (;) appear in CF_HTML for filenames that
    // contain those characters (a&comma;b.png, notes&semi;v2.webp). Left
    // literal, existsSync fails on the "&comma;" / "&semi;" segment. Numeric
    // &#44;/&#59; already decode below; named forms must match.
    .replace(/&comma;/gi, ',')
    .replace(/&semi;/gi, ';');
  // Decimal / hex character references (&#34; / &#x22; for quotes, &#38; for &).
  out = out.replace(/&#(x?[0-9a-fA-F]+);/g, (match, code) => {
    const n = /^x/i.test(code) ? parseInt(code.slice(1), 16) : parseInt(code, 10);
    if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return match;
    try {
      return String.fromCodePoint(n);
    } catch {
      return match;
    }
  });
  return out;
}

/** Accept only refs the main process can paste without fetching the network. */
function embeddableImageRef(src) {
  if (!src) return null;
  // Some clipboard serializers (JSON-in-HTML, escaped CF_HTML) write \/ for /.
  // Leaving those escapes yields file:\/\/\/tmp\/a.png → ////tmp//a.png, which
  // fails existsSync and makes Ctrl+V report "No image in clipboard".
  src = String(src).replace(/\\\//g, '/');
  if (/^data:image\/[a-z0-9.+-]+[;,]/i.test(src)) return src;
  if (/^file:/i.test(src)) return src;
  // Absolute local paths occasionally appear without a file: scheme.
  // Strip ?query / #hash so lazy-load cache busters still match extensions.
  // Must preserve Windows `\\?\` extended-length prefixes (literal `?`).
  // CJK IME fullwidth ． (U+FF0E), ideographic 。 (U+3002), and halfwidth ｡
  // (U+FF61) must become ASCII '.' before the extension check — otherwise
  // photo。png / photo．png is rejected here and never reaches localPath.
  // Typography / some IMEs also emit ․ (U+2024 ONE DOT LEADER) as a lookalike
  // period — same failure mode if left literal.
  const pathOnly = stripQueryHashFromLocalPath(src).replace(
    /[\uFF0E\u3002\uFF61\u2024]/g,
    '.'
  );
  if (
    // Drive paths, POSIX absolutes, and Windows UNC shares (\\server\share\…).
    // Without UNC, Explorer "Copy as path" HTML from a network share made
    // Ctrl+V report "No image in clipboard".
    /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(pathOnly) &&
    // Include .jpe / .jfif / .pjpeg / .pjp (JPEG aliases), .avif (Chromium),
    // .ico (Windows icon / Chromium), and .tif / .tiff (scanner / photo apps;
    // Electron nativeImage / platform decoders). Omitting them made Ctrl+V
    // report "No image" for otherwise valid local paths. Note: jpe?g matches
    // jpg/jpeg only — .jpe / .pjp need their own alternatives (.pjp is
    // Chromium's short progressive-JPEG alias, distinct from .pjpeg).
    /\.(png|jpe?g|jpe|jfif|pjpeg|pjp|gif|webp|bmp|svg|avif|ico|tiff?)$/i.test(pathOnly)
  ) {
    return pathOnly;
  }
  return null;
}

/**
 * Tiny data: URLs used as lazy-load spacers (1×1 GIF / stub SVG). Prefer
 * data-src / data-original when those hold the real local or data image.
 */
function isTinyPlaceholderDataUrl(src) {
  if (!/^data:image\//i.test(src)) return false;
  const payload = src.split(',', 2)[1] || '';
  return payload.length > 0 && payload.length < 80;
}

/** First embeddable URL from a srcset list (`url 1x, url2 2x`). */
function imageRefFromSrcset(srcset) {
  const raw = String(srcset).trim();
  // data: URLs contain commas (`data:image/png;base64,...`) — match those
  // before splitting candidates on comma.
  const dataMatch = raw.match(/data:image\/[a-z0-9.+-]+[;,]\S*/i);
  if (dataMatch) {
    const ref = embeddableImageRef(dataMatch[0]);
    if (ref) return ref;
  }
  for (const part of raw.split(',')) {
    const url = part.trim().split(/\s+/)[0];
    if (!url || /^data:/i.test(url)) continue;
    const ref = embeddableImageRef(url);
    if (ref) return ref;
  }
  return null;
}

function attrValue(tag, name) {
  // Attribute names must not match as suffixes of longer names: `\bsrc`
  // would hit `data-src` (word boundary between `-` and `s`), so a remote
  // data-src listed before a local src would steal the match and break paste.
  const re = new RegExp(
    `(?<![\\w-])${name}(?![\\w-])\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  );
  const match = tag.match(re);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? '').trim();
}

/**
 * Some editors / mail clients / Office HTML put the image on
 * <object data="..."> or <embed src="..."> with no usable <img>.
 */
function imageRefFromObjectEmbedTags(html) {
  const re = /<(?:object|embed)\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[0];
    const isObject = /^<object\b/i.test(tag);
    const ref = embeddableImageRef(
      attrValue(tag, isObject ? 'data' : 'src') ||
        // Odd exporters swap the usual attributes.
        attrValue(tag, isObject ? 'src' : 'data')
    );
    if (ref) return ref;
  }
  return null;
}

/**
 * Word / Outlook / Office "Copy" HTML often embeds pictures as VML
 * `<v:imagedata src="...">` / `o:href`, or as a shape fill via
 * `<v:fill src="...">`, with no usable <img>.
 */
function imageRefFromVmlImageData(html) {
  const re = /<v:(?:imagedata|fill)\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[0];
    const ref = embeddableImageRef(
      attrValue(tag, 'src') || attrValue(tag, 'o:href')
    );
    if (ref) return ref;
  }
  return null;
}

/**
 * Browser / player "Copy" HTML sometimes wraps a still as
 * <video poster="..."> or <audio poster="..."> with no usable <img src>.
 */
function imageRefFromVideoPoster(html) {
  const re = /<(?:video|audio)\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const ref = embeddableImageRef(attrValue(match[0], 'poster'));
    if (ref) return ref;
  }
  return null;
}

/**
 * Form / CMS "Copy" HTML sometimes uses <input type="image" src="...">
 * (image submit buttons) with no usable <img>.
 */
function imageRefFromInputImageTags(html) {
  const re = /<input\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[0];
    const type = (attrValue(tag, 'type') || '').toLowerCase();
    if (type !== 'image') continue;
    const ref = embeddableImageRef(attrValue(tag, 'src'));
    if (ref) return ref;
  }
  return null;
}

/**
 * Responsive <picture> copies often put the real local/data URL on
 * <source srcset> while <img src> is a remote fallback the main process
 * refuses to fetch.
 */
function imageRefFromSourceTags(html) {
  const re = /<source\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[0];
    // Match <img>: lazy-loaders often put the real candidates on data-srcset /
    // data-lazy-srcset / data-originalset while srcset is absent or a remote stub.
    const srcset =
      attrValue(tag, 'srcset') ||
      attrValue(tag, 'data-srcset') ||
      attrValue(tag, 'data-lazy-srcset') ||
      // WP Rocket / similar themes use data-originalset on <source> just like <img>.
      attrValue(tag, 'data-originalset');
    if (srcset) {
      const fromSrcset = imageRefFromSrcset(srcset);
      if (fromSrcset) return fromSrcset;
    }
    const fromSrc = embeddableImageRef(
      attrValue(tag, 'src') ||
        attrValue(tag, 'data-src') ||
        attrValue(tag, 'data-lazy-src')
    );
    if (fromSrc) return fromSrc;
  }
  return null;
}

/**
 * Walk JSON-LD values for an embeddable image ref. Handles ImageObject,
 * Article/WebPage `image`, @graph arrays, and nested objects.
 */
function imageRefFromJsonLdValue(data) {
  if (data == null) return null;
  if (typeof data === 'string') return embeddableImageRef(data);
  if (Array.isArray(data)) {
    for (const item of data) {
      const ref = imageRefFromJsonLdValue(item);
      if (ref) return ref;
    }
    return null;
  }
  if (typeof data !== 'object') return null;

  const types = []
    .concat(data['@type'] || [])
    .map((t) => String(t).toLowerCase());
  const isImageObject = types.some(
    (t) => t === 'imageobject' || t.endsWith('/imageobject')
  );

  // ImageObject: contentUrl / url hold the asset. Article.url is often the
  // page — only accept it when embeddableImageRef recognizes an image path.
  const preferred = isImageObject
    ? ['contentUrl', 'url', 'thumbnailUrl', 'thumbnail', 'image']
    : ['image', 'thumbnailUrl', 'thumbnail', 'contentUrl', 'logo', 'photo'];
  for (const key of preferred) {
    if (!(key in data)) continue;
    const ref = imageRefFromJsonLdValue(data[key]);
    if (ref) return ref;
  }

  if (data['@graph']) {
    const ref = imageRefFromJsonLdValue(data['@graph']);
    if (ref) return ref;
  }
  return null;
}

/**
 * “View Source” / rich-copy HTML often ships only
 * <script type="application/ld+json"> with ImageObject / Article.image and
 * no usable <img> or og:image meta.
 */
function imageRefFromJsonLd(html) {
  const re =
    /<script\b[^>]*\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const raw = (match[1] || '').trim();
    if (!raw) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const ref = imageRefFromJsonLdValue(data);
    if (ref) return ref;
  }
  return null;
}

/**
 * Link-preview / “Copy” HTML from browsers and messengers often ships only
 * Open Graph / Twitter / msapplication tile meta (or link rel=image_src /
 * preload) with no usable <img>. Prefer these over CSS background urls
 * (less incidental).
 */
function imageRefFromMetaAndLinkTags(html) {
  const metaRe = /<meta\b[^>]*>/gi;
  let match;
  while ((match = metaRe.exec(html))) {
    const tag = match[0];
    const prop = (
      attrValue(tag, 'property') ||
      attrValue(tag, 'name') ||
      attrValue(tag, 'itemprop') ||
      ''
    ).toLowerCase();
    if (
      prop !== 'og:image' &&
      prop !== 'og:image:url' &&
      prop !== 'og:image:secure_url' &&
      prop !== 'twitter:image' &&
      prop !== 'twitter:image:src' &&
      prop !== 'twitter:image:url' &&
      // IE / Edge pinned-site tile; some "Copy" HTML exposes only this preview.
      prop !== 'msapplication-tileimage' &&
      prop !== 'image' &&
      // schema.org ImageObject / CreativeWork preview fields
      prop !== 'contenturl' &&
      prop !== 'thumbnailurl' &&
      // Some exporters use the shorter itemprop="thumbnail" (not thumbnailUrl).
      prop !== 'thumbnail'
    ) {
      continue;
    }
    // Most meta tags use content=; some microdata / exporters put the URL in
    // href= (same as <link itemprop>) and leave content empty — without this
    // Ctrl+V reports "No image in clipboard".
    const ref = embeddableImageRef(
      attrValue(tag, 'content') || attrValue(tag, 'href')
    );
    if (ref) return ref;
  }

  const linkRe = /<link\b[^>]*>/gi;
  while ((match = linkRe.exec(html))) {
    const tag = match[0];
    const relTokens = (attrValue(tag, 'rel') || '').toLowerCase().split(/\s+/);
    const as = (attrValue(tag, 'as') || '').toLowerCase();
    // schema.org often emits <link itemprop="image" href="..."> (no rel).
    const itemprop = (attrValue(tag, 'itemprop') || '').toLowerCase();
    const isSchemaImageLink =
      itemprop === 'image' ||
      itemprop === 'contenturl' ||
      itemprop === 'thumbnailurl' ||
      itemprop === 'thumbnail';
    // Skip favicon / apple-touch-icon — those are chrome, not the content image.
    // rel=thumbnail is a common preview link (older browsers / messengers).
    const isImageLink =
      relTokens.includes('image_src') ||
      relTokens.includes('thumbnail') ||
      (relTokens.includes('preload') && as === 'image') ||
      isSchemaImageLink;
    if (!isImageLink) continue;
    // Responsive <link rel=preload as=image> often puts candidates in
    // imagesrcset while href is a remote fallback we refuse to fetch.
    const imagesrcset = attrValue(tag, 'imagesrcset');
    if (imagesrcset) {
      const fromSrcset = imageRefFromSrcset(imagesrcset);
      if (fromSrcset) return fromSrcset;
    }
    const ref = embeddableImageRef(attrValue(tag, 'href'));
    if (ref) return ref;
  }
  return null;
}

/**
 * Gallery / file-manager "Copy" HTML often wraps a remote <img> (or no img)
 * in <a href="file://...|data:image/...|/local/path.png">. Image-map copies
 * use the same href on <area>. The main process will not fetch a remote
 * <img usemap> src, so the anchor/area href is the pasteable ref.
 */
function imageRefFromAnchorTags(html) {
  // Include <area href> — image-map "Copy" HTML often has only <map>/<area>
  // with a local/data target while <img usemap> src stays remote (or absent).
  const re = /<(?:a|area)\b[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const ref = embeddableImageRef(attrValue(match[0], 'href'));
    if (ref) return ref;
  }
  return null;
}

/**
 * lazysizes / similar "Copy" HTML often stash a background image in
 * `data-bg` / `data-bgset` with no usable <img> or inline style url().
 * Without this, Ctrl+V reports "No image in clipboard".
 */
function imageRefFromDataBgAttrs(html) {
  const re = /<[a-zA-Z][^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[0];
    // data-bg is the single-URL form; data-bgset holds responsive candidates.
    const fromBg = embeddableImageRef(attrValue(tag, 'data-bg'));
    if (fromBg) return fromBg;
    const bgset = attrValue(tag, 'data-bgset');
    if (bgset) {
      const fromBgset = imageRefFromSrcset(bgset);
      if (fromBgset) return fromBgset;
    }
  }
  return null;
}

/**
 * Some apps (Slack, mail clients, rich editors) copy an image as
 * `background-image: url(...)` with no usable <img src>.
 */
function imageRefFromStyleUrls(html) {
  const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|((?:\\.|[^'")\\])+))\s*\)/gi;
  let match;
  while ((match = re.exec(html))) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!raw) continue;
    const ref = embeddableImageRef(raw);
    if (ref) return ref;
  }
  return null;
}

/**
 * SVG copies often use <image href> / xlink:href for a local raster, or put
 * the whole drawing in an <svg> fragment with no <img>. Main-process paste
 * already handles SVG in plain text; this covers text/html-only clipboards.
 */
function imageRefFromSvg(html) {
  const imageRe = /<image\b[^>]*>/gi;
  let imageMatch;
  let sawImageTag = false;
  while ((imageMatch = imageRe.exec(html))) {
    sawImageTag = true;
    const tag = imageMatch[0];
    for (const name of ['href', 'xlink:href']) {
      const ref = embeddableImageRef(attrValue(tag, name));
      if (ref) return ref;
    }
  }

  const svgMatch = html.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/i);
  if (!svgMatch) return null;
  const svg = svgMatch[0].trim();
  // Ignore tiny empty shells; real drawings are larger.
  if (svg.length < 32) return null;
  // Remote-only <image> shells have nothing the main process can embed —
  // same reject policy as <img src="https://...">.
  if (
    sawImageTag &&
    !/<(?:path|circle|rect|ellipse|polygon|polyline|line|text|g)\b/i.test(svg)
  ) {
    return null;
  }
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/** Resolve one <img> tag to an embeddable ref, or null if none. */
function imageRefFromImgTag(tag) {
  const src = attrValue(tag, 'src');
  const fromSrc = embeddableImageRef(src);
  // Lazy-loaders put a 1×1 spacer in src and the real file in data-*.
  // Gallery / lightbox exporters often stash the full asset in hi-res /
  // zoom / full-src attrs while src stays a remote thumb or blank.
  const lazyAttrs = [
    'data-src',
    'data-original',
    'data-lazy-src',
    'data-url',
    'data-hi-res-src',
    'data-full-src',
    'data-zoom-image',
    // Elevate Zoom / similar lightbox "Copy" HTML often uses data-zoom-src
    // (distinct from data-zoom-image) while src stays a remote thumb.
    'data-zoom-src',
    'data-large',
    // Pinterest "Copy" HTML often puts the pin image here while src is a
    // remote CDN thumb the main process refuses to fetch.
    'data-pin-media',
    // WordPress attachment markup stashes the full / large / medium file here
    // while src stays a remote (or sized) thumb we refuse to fetch.
    'data-orig-file',
    'data-large-file',
    'data-medium-file',
    // Some WP / CDN lazy-loaders use the compact data-origsrc form (no hyphen)
    // while src stays a remote thumb or spacer. Distinct from data-orig-file /
    // data-original / data-original-src — without this, Ctrl+V reports no image.
    'data-origsrc',
    // BJ Lazy Load / a3 Lazy Load / similar WP plugins use hyphenated
    // data-orig-src (distinct from compact data-origsrc and from
    // data-original-src / data-orig-file). Without this, Ctrl+V reports no image.
    'data-orig-src',
    // Angular templates bind images with ng-src (often no plain src, or a
    // remote placeholder) — without this, Ctrl+V reports no clipboard image.
    'ng-src',
    // echo.js / WP "Echo Lazy Load" stashes the real URL in data-echo while
    // src stays a spacer or remote thumb we refuse to fetch.
    'data-echo',
    // Many East-Asian / CDN "Copy" fragments stash the real asset in
    // data-real-src while src is a remote thumb or spacer we refuse to fetch.
    'data-real-src',
    // Some CDN / theme lazy-loaders use data-true-src (distinct from
    // data-real-src / data-actualsrc) for the full asset while src stays a
    // remote thumb or spacer. Without this, Ctrl+V reports no image.
    'data-true-src',
    // Baidu image search / similar East-Asian lazy-loaders put the full asset
    // in data-actualsrc while src stays a remote thumb we refuse to fetch.
    'data-actualsrc',
    // Cloudflare Mirage / Rocket Loader (and some CF-cached themes) move the
    // real URL into data-cfsrc while src stays a spacer or remote thumb.
    'data-cfsrc',
    // Classic HTML / older exporters put a progressive preview in lowsrc while
    // src is a remote thumb we refuse to fetch (or a 1×1 spacer).
    'lowsrc',
    // retina.js / HiDPI plugins stash the @2x asset in data-src-retina while
    // src stays a remote 1x thumb we refuse to fetch (or a 1×1 spacer).
    'data-src-retina',
    // WP Smush / Smush.it lazy-load markup puts the real file in data-smush-src
    // while src stays a remote CDN thumb or 1×1 spacer we refuse to fetch.
    'data-smush-src',
    // Some gallery / CDN "Copy" HTML stashes the full asset in data-bigsrc while
    // src stays a remote thumb or 1×1 spacer we refuse to fetch.
    'data-bigsrc',
    // WooCommerce product gallery "Copy" HTML puts the full asset in
    // data-large_image while src stays a remote CDN thumb we refuse to fetch.
    'data-large_image',
    // a3/a9 Lazy Load and similar WP plugins stash the real file in
    // data-lazyload-src while src stays a spacer or remote thumb.
    'data-lazyload-src',
    // Many theme / CDN lazy-loaders (and some WP copies) put the full asset in
    // data-original-src while src stays a spacer or remote thumb we refuse to fetch.
    // Distinct from data-original (already handled above).
    'data-original-src',
    // Some themes / older lazy-load scripts stash the real URL in data-lazy
    // (not data-lazy-src) while src stays a spacer or remote thumb. Boolean
    // flags like data-lazy="true" are rejected by embeddableImageRef.
    'data-lazy',
    // lazysizes (and forks) often stash the real asset in data-ll-src while
    // src stays a spacer or remote thumb we refuse to fetch. Distinct from
    // data-lazy-src / data-src — without this, Ctrl+V reports no image.
    'data-ll-src',
    // Themes / galleries often stash the full asset in data-highres (no
    // hyphens) while src stays a remote thumb or spacer. Distinct from
    // data-hi-res-src — without this, Ctrl+V reports no image.
    'data-highres',
    // Google PageSpeed / mod_pagespeed lazy-load rewrites stash the real URL
    // in data-pagespeed-lazy-src while src stays a spacer or remote thumb.
    // Without this, Ctrl+V reports no image for those "Copy" fragments.
    'data-pagespeed-lazy-src',
    // LiteSpeed Cache lazy-load rewrites stash the real URL in data-litespeed-src
    // while src stays a spacer or remote thumb. Without this, Ctrl+V reports
    // no image for those "Copy" fragments.
    'data-litespeed-src',
  ];
  let fromLazy = null;
  for (const name of lazyAttrs) {
    fromLazy = embeddableImageRef(attrValue(tag, name));
    if (fromLazy) break;
  }
  if (fromLazy && (!fromSrc || isTinyPlaceholderDataUrl(fromSrc))) {
    return fromLazy;
  }

  // Browsers / lazy-loaders omit src, leave it remote, or put a 1×1 spacer
  // in src and the real file in srcset / data-srcset / data-lazy-srcset /
  // data-originalset (WP Rocket and similar themes use the latter).
  const srcset =
    attrValue(tag, 'srcset') ||
    attrValue(tag, 'data-srcset') ||
    attrValue(tag, 'data-lazy-srcset') ||
    attrValue(tag, 'data-originalset');
  if (srcset) {
    const fromSrcset = imageRefFromSrcset(srcset);
    if (fromSrcset && (!fromSrc || isTinyPlaceholderDataUrl(fromSrc))) {
      return fromSrcset;
    }
  }

  if (fromSrc) return fromSrc;
  if (fromLazy) return fromLazy;
  return null;
}

function imageRefFromClipboardHtml(html) {
  if (!html) return null;
  // Some apps emit src=&quot;...&quot; or paths with &amp; — decode before matching.
  const decoded = decodeBasicHtmlEntities(String(html));
  // Walk every <img> / <amp-img> — copy fragments often lead with a remote
  // favicon / tracking pixel before the local (or data:) image we can paste.
  // AMP pages copy <amp-img> (same src / data-src attrs) with no plain <img>.
  const imgRe = /<(?:img|amp-img)\b[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRe.exec(decoded))) {
    const fromImg = imageRefFromImgTag(imgMatch[0]);
    if (fromImg) return fromImg;
  }

  // <object>/<embed> before <picture> — common in mail / Office HTML exports.
  const fromObjectEmbed = imageRefFromObjectEmbedTags(decoded);
  if (fromObjectEmbed) return fromObjectEmbed;

  // Word/Outlook VML <v:imagedata> — Office copies often omit a usable <img>.
  const fromVml = imageRefFromVmlImageData(decoded);
  if (fromVml) return fromVml;

  // <video>/<audio poster> before <picture> — copy fragments from players / pages.
  const fromPoster = imageRefFromVideoPoster(decoded);
  if (fromPoster) return fromPoster;

  // <input type="image"> before <picture> — form/CMS image submit buttons.
  const fromInputImage = imageRefFromInputImageTags(decoded);
  if (fromInputImage) return fromInputImage;

  // <picture>/<source> before CSS backgrounds — common for Copy Image HTML.
  const fromSource = imageRefFromSourceTags(decoded);
  if (fromSource) return fromSource;

  // Meta/link preview tags before SVG/CSS — og:image / image_src name the
  // content image; toolbar SVGs and decorative backgrounds are often chrome.
  const fromMetaLink = imageRefFromMetaAndLinkTags(decoded);
  if (fromMetaLink) return fromMetaLink;

  // JSON-LD after meta — structured ImageObject / Article.image when no
  // og:image meta or usable <img> is present.
  const fromJsonLd = imageRefFromJsonLd(decoded);
  if (fromJsonLd) return fromJsonLd;

  // <a href> after meta — gallery copies link a local/data image while <img>
  // stays remote; prefer named preview meta when both appear.
  const fromAnchor = imageRefFromAnchorTags(decoded);
  if (fromAnchor) return fromAnchor;

  // lazysizes data-bg / data-bgset before incidental toolbar SVG / CSS urls.
  const fromDataBg = imageRefFromDataBgAttrs(decoded);
  if (fromDataBg) return fromDataBg;

  const fromSvg = imageRefFromSvg(decoded);
  if (fromSvg) return fromSvg;

  return imageRefFromStyleUrls(decoded);
}

module.exports = { imageRefFromClipboardHtml };
