export const directoryRoles = [['all', 'All'], ['client', 'Clients'], ['salesRep', 'Reps'], ['photographer', 'Photographers'], ['staff', 'Team'], ['contact', 'Contacts']] as const;
export const directoryRoleLabel = (role: string) => ({ client: 'Client', salesRep: 'Rep', photographer: 'Photographer', admin: 'Admin', superadmin: 'Admin', editor: 'Editor', editing_manager: 'Editing manager', contact: 'Contact' }[role] || role);
export const nameInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
export const normalizeCallPhone = (phone: string) => phone.replace(/[\s().-]/g, '');
export const validCallPhone = (phone: string) => /^\+[1-9]\d{7,14}$/.test(normalizeCallPhone(phone));
