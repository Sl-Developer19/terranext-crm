import { describe, expect, it } from 'vitest';

import { emailSignature, ORGANISATION, senderAddress, smsSignature } from './organisation';

describe('ORGANISATION defaults', () => {
  it('uses the business sender identity', () => {
    expect(ORGANISATION.senderName).toBe('TerraNext Global Ventures');
    expect(ORGANISATION.senderEmail).toBe('pp@terranextglobal.com');
  });

  it('defaults Reply-To to the sender so replies are never dropped', () => {
    expect(ORGANISATION.replyTo).toBe('pp@terranextglobal.com');
  });

  it('stores the contact number in E.164 and a display form', () => {
    // E.164 is what a provider needs; the display form is what a human reads.
    expect(ORGANISATION.contactPhone).toBe('+918124360360');
    expect(ORGANISATION.contactPhone).toMatch(/^\+[1-9]\d{7,14}$/);
    expect(ORGANISATION.contactPhoneDisplay).toBe('+91 81243 60360');
  });

  it('keeps both phone forms as the same number', () => {
    expect(ORGANISATION.contactPhoneDisplay.replace(/\s/g, '')).toBe(ORGANISATION.contactPhone);
  });
});

describe('senderAddress', () => {
  it('renders an RFC 5322 From value', () => {
    expect(senderAddress()).toBe('TerraNext Global Ventures <pp@terranextglobal.com>');
  });
});

describe('emailSignature', () => {
  it('carries the business name, phone and email', () => {
    const signature = emailSignature();
    expect(signature).toContain('TerraNext Global Ventures');
    expect(signature).toContain('+91 81243 60360');
    expect(signature).toContain('pp@terranextglobal.com');
  });

  it('starts with a separator so it reads as a footer, not body text', () => {
    expect(emailSignature().startsWith('\n—')).toBe(true);
  });
});

describe('smsSignature', () => {
  it('attributes the sender inline, since SMS has no From display name', () => {
    expect(smsSignature()).toContain('TerraNext Global Ventures');
    expect(smsSignature()).toContain('+91 81243 60360');
  });

  it('stays short enough not to cost an extra segment on its own', () => {
    // A GSM-7 segment is 160 characters; the signature must leave room for
    // the actual message.
    expect(smsSignature().length).toBeLessThan(60);
  });
});
