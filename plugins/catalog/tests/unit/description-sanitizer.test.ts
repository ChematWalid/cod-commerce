import { describe, expect, it } from 'vitest';
import { HtmlDescriptionSanitizer } from '../../infrastructure/description-sanitizer';

const sanitizer = new HtmlDescriptionSanitizer();

describe('HtmlDescriptionSanitizer (D2122)', () => {
  it('drops event handlers, scripts and images', () => {
    // Act
    const clean = sanitizer.sanitize('<p onclick="x">a</p><script>b</script><img src=x onerror=y>');

    // Assert
    expect(clean).toBe('<p>a</p>');
  });

  it('keeps an http link and marks it noopener noreferrer', () => {
    // Act
    const clean = sanitizer.sanitize('<a href="https://example.test/x" target="_blank">x</a>');

    // Assert
    expect(clean).toBe('<a href="https://example.test/x" rel="noopener noreferrer">x</a>');
  });

  it.each([
    ['javascript', '<a href="javascript:alert(1)">x</a>'],
    ['data', '<a href="data:text/html,x">x</a>'],
    ['root-relative', '<a href="/admin">x</a>'],
    ['relative', '<a href="evil">x</a>'],
    ['protocol-relative', '<a href="//evil.test/x">x</a>'],
  ])('drops the href of a %s link', (_scheme, html) => {
    // Act
    const clean = sanitizer.sanitize(html);

    // Assert
    expect(clean).toBe('<a rel="noopener noreferrer">x</a>');
  });

  it('keeps a mailto link and the allowed formatting', () => {
    // Arrange
    const html =
      '<h2>T</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s><br /></p><ul><li>a</li></ul><ol><li>b</li></ol><blockquote>q</blockquote><h3>t</h3>';

    // Act
    const clean = sanitizer.sanitize(`${html}<a href="mailto:a@example.test">m</a>`);

    // Assert
    expect(clean).toBe(
      `${html.replace('<br />', '<br />')}<a href="mailto:a@example.test" rel="noopener noreferrer">m</a>`,
    );
  });

  it('drops style and class attributes and unknown tags but keeps their text', () => {
    // Act
    const clean = sanitizer.sanitize('<div class="x"><span style="color:red">t</span></div><iframe src="x"></iframe>');

    // Assert
    expect(clean).toBe('t');
  });
});
