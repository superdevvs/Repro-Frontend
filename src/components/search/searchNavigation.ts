import type { SearchResult, SearchScope } from './searchTypes';

const destinations = [
  ['accounts', 'Accounts', '/accounts'], ['shoots', 'Shoot History', '/shoot-history'],
  ['invoices', 'Accounting', '/accounting'], ['listings', 'Exclusive Listings', '/portal'],
  ['email', 'Email Inbox', '/messaging/email/inbox'], ['sms', 'SMS Inbox', '/messaging/sms'],
  ['support', 'Support Requests', '/messaging/email/inbox?tab=support'],
  ['calls', 'Calls Inbox', '/calls/inbox'], ['services', 'Services and Scheduling', '/scheduling-settings'],
  ['studio', 'Editing Studio', '/ai-editing'], ['templates', 'Email Templates', '/messaging/email/templates'],
  ['automations', 'Automations', '/messaging/email/automations'],
  ['availability', 'Availability', '/availability'], ['permissions', 'Permissions', '/permissions'],
  ['settings', 'Settings', '/settings'], ['reports', 'Reports', '/reports'], ['profile', 'Profile', '/profile'],
  ['integrations', 'Integrations', '/integrations'], ['booking', 'Book a new shoot', '/book-shoot'],
  ['chat-history', 'My AI chat history', '/chat-with-reproai?tab=history'],
];
export function searchNavigation(scopes: SearchScope[], query: string): SearchResult[] {
  const allowed = new Set(scopes.map(scope => scope.id));
  const term = query.trim().toLowerCase();
  return destinations.filter(([scope, title]) => allowed.has(scope) && (!term || title.toLowerCase().includes(term)))
    .map(([scope, title, destination]) => ({ type: 'navigation', id: scope, title, destination }));
}
