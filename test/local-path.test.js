const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { localPathFromFileUrlOrPath } = require('../lib/local-path');

describe('localPathFromFileUrlOrPath', () => {
  it('returns plain paths unchanged', () => {
    assert.equal(localPathFromFileUrlOrPath('/tmp/sketch.png'), '/tmp/sketch.png');
  });

  it('strips Windows Copy-as-path double quotes', () => {
    assert.equal(
      localPathFromFileUrlOrPath('"/home/hypt/Pictures/sketch.png"'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips nested Copy-as-path / chat wrappers', () => {
    // Re-quoting an already-quoted path (Explorer → chat → markdown) leaves
    // two layers; a single peel kept the inner quotes and existsSync failed.
    assert.equal(
      localPathFromFileUrlOrPath('""/tmp/a.png""'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('`"/tmp/a.png"`'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u300C"/tmp/a.png"\u300D'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('[\u201Cfile:///tmp/cool%20sketch.webp\u201D]'),
      path.normalize('/tmp/cool sketch.webp')
    );
  });

  it('strips single quotes around paths', () => {
    assert.equal(
      localPathFromFileUrlOrPath("'/home/hypt/Pictures/sketch.png'"),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips backticks and curly/smart quotes around paths', () => {
    // Shell/markdown copies often wrap paths in backticks; Word/Slack use “ ” / ‘ ’.
    assert.equal(
      localPathFromFileUrlOrPath('`/home/hypt/Pictures/sketch.png`'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u201C/home/hypt/Pictures/sketch.png\u201D'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2018file:///tmp/cool%20sketch.webp\u2019'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u300C/tmp/a.png\u300D'),
      '/tmp/a.png'
    );
  });

  it('strips ornamental heavy quotation marks around paths', () => {
    // Word/typography ❛ ❜ / ❝ ❞ wrappers — companion to curly “ ” / ‘ ’;
    // left literal they break existsSync and Ctrl+V reports "No image".
    assert.equal(
      localPathFromFileUrlOrPath('\u275B/tmp/a.png\u275C'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u275D/home/hypt/Pictures/sketch.png\u275E'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u275Bfile:///tmp/cool%20sketch.webp\u275C'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u275Dfile:///tmp/cool%20sketch.webp\u275E'),
      path.normalize('/tmp/cool sketch.webp')
    );
  });

  it('strips guillemets and German low-high quotes around paths', () => {
    // FR/CH « » / DE » « and „ “ / ‚ ‘ — Word/LibreOffice "Copy as path" wrappers.
    assert.equal(
      localPathFromFileUrlOrPath('\u00AB/tmp/a.png\u00BB'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u00BB/tmp/a.png\u00AB'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u201E/home/hypt/Pictures/sketch.png\u201C'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u201Afile:///tmp/cool%20sketch.webp\u2018'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2039/tmp/a.png\u203A'),
      '/tmp/a.png'
    );
  });

  it('strips white corner brackets and fullwidth quotes around paths', () => {
    // CJK 『 』 / IME fullwidth ＂ ＂ / ＇ ＇ wrappers left literal break existsSync.
    assert.equal(
      localPathFromFileUrlOrPath('\u300E/tmp/a.png\u300F'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF02/home/hypt/Pictures/sketch.png\uFF02'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF07file:///tmp/cool%20sketch.webp\uFF07'),
      path.normalize('/tmp/cool sketch.webp')
    );
  });

  it('strips CJK vertical presentation corner brackets around paths', () => {
    // Vertical-text forms ﹁ ﹂ / ﹃ ﹄ — companions to 「」/『』; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\uFE41/tmp/a.png\uFE42'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFE43/tmp/a.png\uFE44'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFE41file:///tmp/cool%20sketch.webp\uFE42'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFE43file:///tmp/cool%20sketch.webp\uFE44'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFE41/home/hypt/Pictures/sketch.png\uFE42'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFE43/home/hypt/Pictures/sketch.png\uFE44'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK vertical presentation square brackets around paths', () => {
    // Vertical-text forms ﹇ ﹈ — companions to ﹁﹂/﹃﹄ and to [］ wrappers;
    // left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\uFE47/tmp/a.png\uFE48'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFE47file:///tmp/cool%20sketch.webp\uFE48'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFE47/home/hypt/Pictures/sketch.png\uFE48'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK double-prime quotation marks around paths', () => {
    // East-Asian typography 〝 〞 / 〝 〟 — companions to 「」/『』; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u301D/tmp/a.png\u301E'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u301D/tmp/a.png\u301F'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u301Dfile:///tmp/cool%20sketch.webp\u301E'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u301Dfile:///tmp/cool%20sketch.webp\u301F'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u301D/home/hypt/Pictures/sketch.png\u301E'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u301D/home/hypt/Pictures/sketch.png\u301F'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips fullwidth square brackets around paths', () => {
    // CJK IME fullwidth mode wraps Copy-as-path in ［ ］; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\uFF3B/tmp/a.png\uFF3D'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF3Bfile:///tmp/cool%20sketch.webp\uFF3D'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF3B/home/hypt/Pictures/sketch.png\uFF3D'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK tortoise shell brackets around paths', () => {
    // Word/IME sometimes wraps Copy-as-path in 〔 〕; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u3014/tmp/a.png\u3015'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3014file:///tmp/cool%20sketch.webp\u3015'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3014/home/hypt/Pictures/sketch.png\u3015'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK white tortoise shell brackets around paths', () => {
    // IME / messenger Copy-as-path often wraps in 〘 〙; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u3018/tmp/a.png\u3019'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3018file:///tmp/cool%20sketch.webp\u3019'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3018/home/hypt/Pictures/sketch.png\u3019'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips dingbat light tortoise shell brackets around paths', () => {
    // Ornamental ❲ ❳ (U+2772/U+2773) — companion to 〔〕/〘〙; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u2772/tmp/a.png\u2773'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2772file:///tmp/cool%20sketch.webp\u2773'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2772/home/hypt/Pictures/sketch.png\u2773'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips dingbat medium parenthesis ornaments around paths', () => {
    // Ornamental ❨ ❩ (U+2768/U+2769) — companion to ❲❳ / （）; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u2768/tmp/a.png\u2769'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2768file:///tmp/cool%20sketch.webp\u2769'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2768/home/hypt/Pictures/sketch.png\u2769'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips dingbat medium flattened parenthesis ornaments around paths', () => {
    // Ornamental ❪ ❫ (U+276A/U+276B) — companion to ❨❩; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u276A/tmp/a.png\u276B'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u276Afile:///tmp/cool%20sketch.webp\u276B'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u276A/home/hypt/Pictures/sketch.png\u276B'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips dingbat medium angle bracket ornaments around paths', () => {
    // Ornamental ❬ ❭ (U+276C/U+276D) — companion to ❪❫ / ❨❩; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u276C/tmp/a.png\u276D'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u276Cfile:///tmp/cool%20sketch.webp\u276D'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u276C/home/hypt/Pictures/sketch.png\u276D'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips dingbat medium double angle bracket ornaments around paths', () => {
    // Ornamental ❮ ❯ (U+276E/U+276F) — companion to ❬ ❭; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u276E/tmp/a.png\u276F'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u276Efile:///tmp/cool%20sketch.webp\u276F'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u276E/home/hypt/Pictures/sketch.png\u276F'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips dingbat heavy angle bracket ornaments around paths', () => {
    // Ornamental ❰ ❱ (U+2770/U+2771) — companion to ❮ ❯; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u2770/tmp/a.png\u2771'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2770file:///tmp/cool%20sketch.webp\u2771'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2770/home/hypt/Pictures/sketch.png\u2771'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips dingbat medium curly brace ornaments around paths', () => {
    // Ornamental ❴ ❵ (U+2774/U+2775) — companion to ❰❱ / ❨❩; left literal,
    // existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u2774/tmp/a.png\u2775'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2774file:///tmp/cool%20sketch.webp\u2775'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2774/home/hypt/Pictures/sketch.png\u2775'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK black lenticular brackets around paths', () => {
    // IME / messenger Copy-as-path often wraps in 【 】; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u3010/tmp/a.png\u3011'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3010file:///tmp/cool%20sketch.webp\u3011'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3010/home/hypt/Pictures/sketch.png\u3011'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK white lenticular brackets around paths', () => {
    // IME / messenger Copy-as-path often wraps in 〖 〗; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u3016/tmp/a.png\u3017'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3016file:///tmp/cool%20sketch.webp\u3017'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3016/home/hypt/Pictures/sketch.png\u3017'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK presentation form brackets around paths', () => {
    // IME / messenger Copy-as-path often wraps in 〚 〛; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u301A/tmp/a.png\u301B'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u301Afile:///tmp/cool%20sketch.webp\u301B'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u301A/home/hypt/Pictures/sketch.png\u301B'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips mathematical white square brackets around paths', () => {
    // Typography / math-mode IME wraps Copy-as-path in ⟦ ⟧; left literal, existsSync fails.
    // Companion to CJK presentation 〚 〛 already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\u27E6/tmp/a.png\u27E7'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27E6file:///tmp/cool%20sketch.webp\u27E7'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27E6/home/hypt/Pictures/sketch.png\u27E7'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips mathematical angle brackets around paths', () => {
    // Typography / math-mode IME wraps Copy-as-path in ⟨ ⟩; left literal, existsSync fails.
    // Companion to mathematical white square ⟦ ⟧ already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\u27E8/tmp/a.png\u27E9'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27E8file:///tmp/cool%20sketch.webp\u27E9'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27E8/home/hypt/Pictures/sketch.png\u27E9'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips mathematical double angle brackets around paths', () => {
    // Typography / math-mode IME wraps Copy-as-path in ⟪ ⟫; left literal, existsSync fails.
    // Companion to mathematical angle ⟨ ⟩ already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\u27EA/tmp/a.png\u27EB'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27EAfile:///tmp/cool%20sketch.webp\u27EB'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27EA/home/hypt/Pictures/sketch.png\u27EB'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips mathematical white tortoise shell brackets around paths', () => {
    // Typography / math-mode IME wraps Copy-as-path in ⟬ ⟭; left literal, existsSync fails.
    // Companion to mathematical double angle ⟪ ⟫ / CJK 〔 〕 already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\u27EC/tmp/a.png\u27ED'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27ECfile:///tmp/cool%20sketch.webp\u27ED'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27EC/home/hypt/Pictures/sketch.png\u27ED'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips mathematical flattened parenthesis ornaments around paths', () => {
    // Typography / math-mode IME wraps Copy-as-path in ⟮ ⟯; left literal, existsSync fails.
    // Companion to mathematical white tortoise ⟬ ⟭ / （） already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\u27EE/tmp/a.png\u27EF'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27EEfile:///tmp/cool%20sketch.webp\u27EF'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u27EE/home/hypt/Pictures/sketch.png\u27EF'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips mathematical ceiling and floor brackets around paths', () => {
    // Typography / math-mode IME wraps Copy-as-path in ⌈ ⌉ / ⌊ ⌋; left literal,
    // existsSync fails. Companions to ⟨⟩ / ⟦⟧ already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\u2308/tmp/a.png\u2309'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u230A/tmp/a.png\u230B'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2308file:///tmp/cool%20sketch.webp\u2309'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u230Afile:///tmp/cool%20sketch.webp\u230B'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2308/home/hypt/Pictures/sketch.png\u2309'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u230A/home/hypt/Pictures/sketch.png\u230B'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips halfwidth corner brackets around paths', () => {
    // Japanese IME halfwidth mode wraps Copy-as-path in ｢ ｣; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\uFF62/tmp/a.png\uFF63'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF62file:///tmp/cool%20sketch.webp\uFF63'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF62/home/hypt/Pictures/sketch.png\uFF63'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK double angle brackets around paths', () => {
    // Chinese IME / messenger Copy-as-path often wraps in 《 》; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u300A/tmp/a.png\u300B'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u300Afile:///tmp/cool%20sketch.webp\u300B'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u300A/home/hypt/Pictures/sketch.png\u300B'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips CJK single angle brackets around paths', () => {
    // Chinese IME / messenger Copy-as-path often wraps in 〈 〉; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\u3008/tmp/a.png\u3009'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3008file:///tmp/cool%20sketch.webp\u3009'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u3008/home/hypt/Pictures/sketch.png\u3009'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips fullwidth parentheses around paths', () => {
    // CJK IME fullwidth mode wraps Copy-as-path in （ ）; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\uFF08/tmp/a.png\uFF09'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF08file:///tmp/cool%20sketch.webp\uFF09'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF08/home/hypt/Pictures/sketch.png\uFF09'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips fullwidth white parentheses around paths', () => {
    // CJK IME / typography wraps Copy-as-path in ｟ ｠; left literal, existsSync fails.
    // Companion to fullwidth （） already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5F/tmp/a.png\uFF60'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5Ffile:///tmp/cool%20sketch.webp\uFF60'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5F/home/hypt/Pictures/sketch.png\uFF60'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips ASCII parentheses around paths', () => {
    // Chat/docs/markdown and some Copy-as-path helpers wrap in ( ); left literal, existsSync fails.
    assert.equal(localPathFromFileUrlOrPath('(/tmp/a.png)'), '/tmp/a.png');
    assert.equal(
      localPathFromFileUrlOrPath('(file:///tmp/cool%20sketch.webp)'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('(/home/hypt/Pictures/sketch.png)'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips ASCII square brackets around paths', () => {
    // Chat/docs/markdown and some Copy-as-path helpers wrap in [ ]; left literal, existsSync fails.
    // Companion to fullwidth ［］ already handled above.
    assert.equal(localPathFromFileUrlOrPath('[/tmp/a.png]'), '/tmp/a.png');
    assert.equal(
      localPathFromFileUrlOrPath('[file:///tmp/cool%20sketch.webp]'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('[/home/hypt/Pictures/sketch.png]'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips fullwidth curly braces around paths', () => {
    // CJK IME fullwidth mode wraps Copy-as-path in ｛ ｝; left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5B/tmp/a.png\uFF5D'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5Bfile:///tmp/cool%20sketch.webp\uFF5D'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5B/home/hypt/Pictures/sketch.png\uFF5D'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips ASCII curly braces around paths', () => {
    // Chat/docs/markdown and some Copy-as-path helpers wrap in { }; left literal, existsSync fails.
    // Companion to fullwidth ｛｝ already handled above.
    assert.equal(localPathFromFileUrlOrPath('{/tmp/a.png}'), '/tmp/a.png');
    assert.equal(
      localPathFromFileUrlOrPath('{file:///tmp/cool%20sketch.webp}'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('{/home/hypt/Pictures/sketch.png}'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips fullwidth angle brackets around paths', () => {
    // CJK IME fullwidth mode wraps Copy-as-path in ＜ ＞; left literal, existsSync fails.
    // Distinct from 《》/〈〉 already handled above.
    assert.equal(
      localPathFromFileUrlOrPath('\uFF1C/tmp/a.png\uFF1E'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF1Cfile:///tmp/cool%20sketch.webp\uFF1E'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF1C/home/hypt/Pictures/sketch.png\uFF1E'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips ASCII angle brackets around paths', () => {
    // Chat/docs/markdown and some Copy-as-path helpers wrap in < >; left literal, existsSync fails.
    // Companion to fullwidth ＜＞ already handled above.
    assert.equal(localPathFromFileUrlOrPath('</tmp/a.png>'), '/tmp/a.png');
    assert.equal(
      localPathFromFileUrlOrPath('<file:///tmp/cool%20sketch.webp>'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('</home/hypt/Pictures/sketch.png>'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('strips ASCII / fullwidth / double vertical pipes around paths', () => {
    // Chat/docs/markdown and some Copy-as-path helpers wrap in | |; CJK IME
    // fullwidth ｜｜ and typography ‖‖ are the same existsSync failure mode.
    assert.equal(localPathFromFileUrlOrPath('|/tmp/a.png|'), '/tmp/a.png');
    assert.equal(
      localPathFromFileUrlOrPath('|file:///tmp/cool%20sketch.webp|'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('|/home/hypt/Pictures/sketch.png|'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5C/tmp/a.png\uFF5C'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\uFF5Cfile:///tmp/cool%20sketch.webp\uFF5C'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2016/tmp/a.png\u2016'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2016file:///tmp/cool%20sketch.webp\u2016'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('\u2016/home/hypt/Pictures/sketch.png\u2016'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('resolves file: URLs via fileURLToPath', () => {
    const fileUrl = 'file:///home/hypt/Pictures/sketch.png';
    assert.equal(localPathFromFileUrlOrPath(fileUrl), path.normalize('/home/hypt/Pictures/sketch.png'));
  });

  it('strips quotes then resolves file: URLs', () => {
    const quoted = '"file:///home/hypt/Pictures/sketch.png"';
    assert.equal(localPathFromFileUrlOrPath(quoted), path.normalize('/home/hypt/Pictures/sketch.png'));
  });

  it('passes through empty/nullish values', () => {
    assert.equal(localPathFromFileUrlOrPath(''), '');
    assert.equal(localPathFromFileUrlOrPath(null), null);
    assert.equal(localPathFromFileUrlOrPath(undefined), undefined);
  });

  it('normalizes NBSP from HTML &nbsp; to ASCII space in paths', () => {
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/a\u00A0b.png'),
      '/tmp/a b.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u00A0sketch.webp'),
      path.normalize('/tmp/cool sketch.webp')
    );
  });

  it('normalizes en/em/thin/hair and other Unicode spaces to ASCII space in paths', () => {
    // &ensp; / &emsp; / &thinsp; / &hairsp; / &#x2009; decode to these; disk uses ' '.
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2002b.png'), '/tmp/a b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2003b.png'), '/tmp/a b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2009b.png'), '/tmp/a b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u200Ab.png'), '/tmp/a b.png');
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u2009sketch.webp'),
      path.normalize('/tmp/cool sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u200Asketch.webp'),
      path.normalize('/tmp/cool sketch.webp')
    );
  });

  it('strips soft hyphen and zero-width format chars from paths', () => {
    // &shy; / &#xAD; / &#8203; / &zwnj; / &zwj; / &lrm; / &rlm; — not present on disk.
    assert.equal(localPathFromFileUrlOrPath('/tmp/cool\u00ADsketch.png'), '/tmp/coolsketch.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/cool\u200Bsketch.png'), '/tmp/coolsketch.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/cool\u200Csketch.png'), '/tmp/coolsketch.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/cool\u200Dsketch.png'), '/tmp/coolsketch.png');
    // LRM/RLM (U+200E/U+200F) from Word/Outlook bidi markup — never on disk.
    assert.equal(localPathFromFileUrlOrPath('/tmp/cool\u200Esketch.png'), '/tmp/coolsketch.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/cool\u200Fsketch.png'), '/tmp/coolsketch.png');
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u00ADsketch.webp'),
      path.normalize('/tmp/coolsketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/cool\uFEFF\u2060sketch.png'),
      '/tmp/coolsketch.png'
    );
  });

  it('normalizes en/em/minus dashes to ASCII hyphen in paths', () => {
    // &ndash; / &mdash; / &minus; / &#8211; decode to these; disk uses '-'.
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2013b.png'), '/tmp/a-b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2014b.png'), '/tmp/a-b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2212b.png'), '/tmp/a-b.png');
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u2013sketch.webp'),
      path.normalize('/tmp/cool-sketch.webp')
    );
  });

  it('normalizes figure dash and horizontal bar to ASCII hyphen in paths', () => {
    // &#8210; / &#8213; (and some Word/locale typography) — same existsSync gap
    // as en/em/minus; disk almost always uses ASCII '-'.
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2012b.png'), '/tmp/a-b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2015b.png'), '/tmp/a-b.png');
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u2012sketch.webp'),
      path.normalize('/tmp/cool-sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u2015sketch.webp'),
      path.normalize('/tmp/cool-sketch.webp')
    );
  });

  it('normalizes hyphen / non-breaking hyphen / fullwidth hyphen to ASCII hyphen', () => {
    // &hyphen; / &#8208; / &#8209; and CJK IME fullwidth － (U+FF0D) — same
    // existsSync gap as en/em/minus; disk almost always uses ASCII '-'.
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2010b.png'), '/tmp/a-b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\u2011b.png'), '/tmp/a-b.png');
    assert.equal(localPathFromFileUrlOrPath('/tmp/a\uFF0Db.png'), '/tmp/a-b.png');
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\u2010sketch.webp'),
      path.normalize('/tmp/cool-sketch.webp')
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool\uFF0Dsketch.webp'),
      path.normalize('/tmp/cool-sketch.webp')
    );
  });

  it('normalizes fullwidth solidus / reverse solidus to ASCII path separators', () => {
    // CJK IME fullwidth ／ ＼ — left literal, existsSync fails on an otherwise
    // valid local image path and Ctrl+V reports "No image".
    assert.equal(
      localPathFromFileUrlOrPath('\uFF0Ftmp\uFF0Fa.png'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp\uFF0Fcool\uFF0Fsketch.png'),
      '/tmp/cool/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('C:\uFF3CUsers\uFF3Cx\uFF3Cphoto.png'),
      'C:\\Users\\x\\photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"\uFF0Fhome\uFF0Fhypt\uFF0FPictures\uFF0Fsketch.png"'),
      '/home/hypt/Pictures/sketch.png'
    );
  });

  it('normalizes division / fraction slash to ASCII path separators', () => {
    // Word / math / locale typography uses ∕ (U+2215) or ⁄ (U+2044) for "/".
    // Left literal, existsSync fails — same failure mode as fullwidth ／.
    assert.equal(
      localPathFromFileUrlOrPath('/tmp\u2215a.png'),
      '/tmp/a.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp\u2044cool\u2044sketch.webp'),
      '/tmp/cool/sketch.webp'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"\u2215home\u2215hypt\u2215Pictures\u2215sketch.png"'),
      '/home/hypt/Pictures/sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp\u2215cool%20sketch.png'),
      path.normalize('/tmp/cool sketch.png')
    );
  });

  it('normalizes fullwidth drive-letter colon to ASCII colon in paths', () => {
    // CJK IME fullwidth ： (U+FF1A) — C：\Users\… left literal, existsSync fails.
    assert.equal(
      localPathFromFileUrlOrPath('C\uFF1A\\Users\\x\\photo.png'),
      'C:\\Users\\x\\photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('D\uFF1A/tmp/cool/sketch.webp'),
      'D:/tmp/cool/sketch.webp'
    );
    // Combined with fullwidth separators from the same IME mode.
    assert.equal(
      localPathFromFileUrlOrPath('C\uFF1A\uFF3CUsers\uFF3Cx\uFF3Cphoto.png'),
      'C:\\Users\\x\\photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"E\uFF1A/home/hypt/Pictures/sketch.png"'),
      'E:/home/hypt/Pictures/sketch.png'
    );
  });

  it('normalizes fullwidth full stop to ASCII period in paths', () => {
    // CJK IME fullwidth ． (U+FF0E) — photo．png left literal, existsSync fails
    // (and the image-extension check rejects it). Disk uses ASCII '.'.
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/photo\uFF0Epng'),
      '/tmp/photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/cool\uFF0Esketch\uFF0Ewebp'),
      '/tmp/cool.sketch.webp'
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool%20sketch\uFF0Ewebp'),
      path.normalize('/tmp/cool sketch.webp')
    );
    // Combined with fullwidth separators / colon from the same IME mode.
    assert.equal(
      localPathFromFileUrlOrPath('C\uFF1A\uFF3CUsers\uFF3Cx\uFF3Cphoto\uFF0Epng'),
      'C:\\Users\\x\\photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"\uFF0Ftmp\uFF0Fcool\uFF0Esketch\uFF0Epng"'),
      '/tmp/cool.sketch.png'
    );
  });

  it('normalizes ideographic full stops to ASCII period in paths', () => {
    // Japanese/Chinese IME sentence punctuation 。 (U+3002) / halfwidth ｡
    // (U+FF61) — photo。png left literal, existsSync fails (same mode as ．).
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/photo\u3002png'),
      '/tmp/photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/cool\u3002sketch\u3002webp'),
      '/tmp/cool.sketch.webp'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/photo\uFF61png'),
      '/tmp/photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool%20sketch\u3002webp'),
      path.normalize('/tmp/cool sketch.webp')
    );
    // Mixed with fullwidth ． from alphanumeric IME mode.
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/cool\u3002sketch\uFF0Epng'),
      '/tmp/cool.sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"\uFF0Ftmp\uFF0Fphoto\u3002png"'),
      '/tmp/photo.png'
    );
  });

  it('normalizes one-dot leader to ASCII period in paths', () => {
    // Typography / some IMEs emit ․ (U+2024 ONE DOT LEADER) as a period
    // lookalike — photo․png left literal, existsSync fails (same mode as ．).
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/photo\u2024png'),
      '/tmp/photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/cool\u2024sketch\u2024webp'),
      '/tmp/cool.sketch.webp'
    );
    assert.equal(
      localPathFromFileUrlOrPath('file:///tmp/cool%20sketch\u2024webp'),
      path.normalize('/tmp/cool sketch.webp')
    );
    // Mixed with ideographic / fullwidth stops from IME modes.
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/cool\u2024sketch\u3002png'),
      '/tmp/cool.sketch.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"\uFF0Ftmp\uFF0Fphoto\u2024png"'),
      '/tmp/photo.png'
    );
  });

  it('decodes percent-encoded plain absolute paths', () => {
    // Clipboard HTML exporters sometimes omit file: but keep %20 / %2F escapes.
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/my%20photo.png'),
      '/tmp/my photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"/home/hypt/Pictures/cool%20sketch.webp"'),
      '/home/hypt/Pictures/cool sketch.webp'
    );
    // Malformed sequences stay unchanged (decodeURIComponent would throw).
    assert.equal(localPathFromFileUrlOrPath('/tmp/bad%2photo.png'), '/tmp/bad%2photo.png');
  });

  it('strips query/hash from plain absolute paths', () => {
    // Text/HTML exporters leave cache-busters; file: already strips via fileURLToPath.
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/clip.webp?cache=1'),
      '/tmp/clip.webp'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/clip.webp#frag'),
      '/tmp/clip.webp'
    );
    assert.equal(
      localPathFromFileUrlOrPath('/tmp/my%20photo.png?v=2#x'),
      '/tmp/my photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"C:/Users/x/a.png?dl=1"'),
      'C:/Users/x/a.png'
    );
    // Relative / non-path strings keep ? (not treated as filesystem paths).
    assert.equal(localPathFromFileUrlOrPath('notes?draft=1'), 'notes?draft=1');
  });

  it('preserves Windows extended-length \\\\?\\ prefixes when stripping query/hash', () => {
    // Naive split on "?" used to truncate \\\\?\\C:\\… to "\\\\".
    assert.equal(
      localPathFromFileUrlOrPath('\\\\?\\C:\\Users\\x\\photo.png'),
      '\\\\?\\C:\\Users\\x\\photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\\\\?\\C:\\Users\\x\\photo.png?v=1'),
      '\\\\?\\C:\\Users\\x\\photo.png'
    );
    assert.equal(
      localPathFromFileUrlOrPath('\\\\?\\UNC\\fileserver\\art\\sketch.webp#frag'),
      '\\\\?\\UNC\\fileserver\\art\\sketch.webp'
    );
    assert.equal(
      localPathFromFileUrlOrPath('"\\\\?\\C:\\Users\\x\\cool%20sketch.png"'),
      '\\\\?\\C:\\Users\\x\\cool sketch.png'
    );
  });
});
