import { describe, expect, it } from 'vitest';

import { escapeHtml, renderBrandedEmailHtml } from '@/lib/messaging/email-template';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert('x') & "y"</script>`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;) &amp; &quot;y&quot;&lt;/script&gt;',
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('Reset your password')).toBe('Reset your password');
  });
});

describe('renderBrandedEmailHtml', () => {
  const base = {
    heading: 'Reset your password',
    bodyText: 'We received a request.\n\nIgnore this if it was not you.',
    appOrigin: 'https://crm.terranextglobal.com',
  };

  it('includes the escaped heading and paragraphs split on blank lines', () => {
    const html = renderBrandedEmailHtml(base);
    expect(html).toContain('<h1 style="margin:0;font-family:Georgia');
    expect(html).toContain('Reset your password</h1>');
    expect(html).toContain('<p style="margin:0 0 16px;">We received a request.</p>');
    expect(html).toContain('<p style="margin:0 0 16px;">Ignore this if it was not you.</p>');
  });

  it('points the logo at the given app origin', () => {
    const html = renderBrandedEmailHtml(base);
    expect(html).toContain('src="https://crm.terranextglobal.com/brand/logo.png"');
  });

  it('renders a CTA button when provided and omits it otherwise', () => {
    const withCta = renderBrandedEmailHtml({
      ...base,
      cta: {
        label: 'Reset your password',
        url: 'https://crm.terranextglobal.com/reset-password?oobCode=abc',
      },
    });
    expect(withCta).toContain('href="https://crm.terranextglobal.com/reset-password?oobCode=abc"');
    expect(withCta).toContain('>Reset your password</a>');

    const withoutCta = renderBrandedEmailHtml(base);
    expect(withoutCta).not.toContain('<a href=');
  });

  it('renders the footer note only when provided', () => {
    const withNote = renderBrandedEmailHtml({ ...base, footerNote: 'Expires in 1 hour.' });
    expect(withNote).toContain('Expires in 1 hour.');
  });

  it('HTML-escapes attacker-controlled body text instead of injecting markup', () => {
    const html = renderBrandedEmailHtml({
      ...base,
      bodyText: '<img src=x onerror=alert(1)>',
    });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('HTML-escapes a malicious CTA label and URL', () => {
    const html = renderBrandedEmailHtml({
      ...base,
      cta: { label: '"><script>alert(1)</script>', url: 'javascript:alert(1)"><script>' },
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
