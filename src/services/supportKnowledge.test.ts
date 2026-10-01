import { describe, expect, it } from 'vitest';
import { isRobbieHelpOnlyRole, isSafeSupportLink, isSupportQuestion, roleHelpPrompts, supportArticleUrl } from './supportKnowledge';

describe('Robbie support routing', () => {
  it('allows dashboard and contact actions while excluding unsafe link schemes', () => {
    for (const url of ['/shoot-history', 'tel:+12028681663', 'mailto:contact@reprophotos.com']) expect(isSafeSupportLink(url)).toBe(true);
    for (const url of ['javascript:alert(1)', '//example.com', '/\\example.com', 'mailto:test%0aBcc:other@example.com', 'data:text/html,test']) expect(isSafeSupportLink(url)).toBe(false);
  });
  it('keeps how-to questions separate from transactional requests', () => {
    expect(isSupportQuestion('How do I book a shoot?')).toBe(true);
    expect(isSupportQuestion('Where can I check availability?')).toBe(true);
    expect(isSupportQuestion('Book a shoot for tomorrow')).toBe(false);
    expect(isSupportQuestion('Check availability')).toBe(false);
  });
  it('gives support-only roles relevant questions while preserving existing operator roles', () => {
    for (const role of ['salesRep', 'sales_rep', 'photographer', 'editor']) expect(isRobbieHelpOnlyRole(role)).toBe(true);
    for (const role of ['client', 'admin', 'superadmin', 'editing_manager']) expect(isRobbieHelpOnlyRole(role)).toBe(false);
    expect(roleHelpPrompts('photographer')).toContain('How do I upload shoot photos?');
    expect(roleHelpPrompts('salesRep')).toContain('How do I find my assigned clients?');
    expect(supportArticleUrl('upload raw')).toBe('/chat-with-reproai?tab=help&article=upload%20raw');
  });
});
