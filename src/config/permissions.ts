
import { PermissionsMap, Resource, Action } from '@/types/permissions';

// Define available resources
export const resources: Resource[] = [
  { id: 'dashboard', name: 'Dashboard', description: 'Main dashboard access' },
  { id: 'shoots', name: 'Shoots', description: 'Photo shoots management' },
  { id: 'book-shoot', name: 'Book Shoot', description: 'Book new photo shoots' },
  { id: 'invoices', name: 'Invoices', description: 'Invoice management' },
  { id: 'accounting', name: 'Accounting', description: 'Accounting and financial management' },
  { id: 'clients', name: 'Clients', description: 'Client management' },
  { id: 'photographers', name: 'Photographers', description: 'Photographer management' },
  { id: 'accounts', name: 'Accounts', description: 'User accounts' },
  { id: 'availability', name: 'Availability', description: 'Scheduling availability' },
  { id: 'reports', name: 'Reports', description: 'Reports and analytics' },
  { id: 'coupons', name: 'Coupons', description: 'Coupon and discount management' },
  { id: 'settings', name: 'Settings', description: 'System settings' },
  { id: 'scheduling-settings', name: 'Scheduling Settings', description: 'Scheduling configuration' },
  { id: 'profile', name: 'Profile', description: 'User profile management' },
  { id: 'integrations', name: 'Integrations', description: 'Third-party integrations' },
  { id: 'payments', name: 'Payments', description: 'Payment status and management' },
  { id: 'notes', name: 'Notes', description: 'Shoot notes management' },
  { id: 'company-notes', name: 'Company Notes', description: 'Company notes visibility' },
  { id: 'editing-notes', name: 'Editing Notes', description: 'Editing notes visibility' },
  { id: 'photographer-notes', name: 'Photographer Notes', description: 'Photographer notes visibility' },
  { id: 'branding', name: 'Branding', description: 'Branding information management' },
  { id: 'media', name: 'Media', description: 'Media upload and management' },
  { id: 'tours', name: 'Tours', description: 'Tour settings and management' },
  { id: 'history', name: 'History', description: 'Shoot history access' },
];

// Define available actions
export const actions: Action[] = [
  { id: 'view', name: 'View', description: 'Can view' },
  { id: 'create', name: 'Create', description: 'Can create' },
  { id: 'update', name: 'Update', description: 'Can update' },
  { id: 'delete', name: 'Delete', description: 'Can delete' },
  { id: 'approve', name: 'Approve', description: 'Can approve' },
  { id: 'assign', name: 'Assign', description: 'Can assign' },
  { id: 'book', name: 'Book', description: 'Can book' },
  { id: 'mark-paid', name: 'Mark as Paid', description: 'Can mark payments as paid' },
  { id: 'upload', name: 'Upload', description: 'Can upload files' },
  { id: 'download', name: 'Download', description: 'Can download files' },
];

// Define role-based permissions
export const permissionsConfig: PermissionsMap = {
  superadmin: {
    role: 'superadmin',
    permissions: [
      // Superadmins have all permissions
      ...resources.flatMap(resource => 
        actions.map(action => ({
          id: `${resource.id}-${action.id}`,
          resource: resource.id,
          action: action.id,
        }))
      )
    ]
  },
  admin: {
    role: 'admin',
    permissions: [
      // Admins have most permissions EXCEPT payment visibility
      ...resources.flatMap(resource => 
        actions.map(action => ({
          id: `${resource.id}-${action.id}`,
          resource: resource.id,
          action: action.id,
        }))
      ).filter(p => 
        // Remove payment-related permissions for admin
        !(p.resource === 'payments' && (p.action === 'view' || p.action === 'mark-paid' || p.action === 'update')) &&
        !(p.resource === 'integrations' && p.action === 'delete')
      )
    ]
  },
  salesRep: {
    role: 'salesRep',
    permissions: [
      { id: 'dashboard-view', resource: 'dashboard', action: 'view' },
      { id: 'clients-view', resource: 'clients', action: 'view' },
      { id: 'clients-create', resource: 'clients', action: 'create' },
      { id: 'clients-update', resource: 'clients', action: 'update' },
      { id: 'shoots-view', resource: 'shoots', action: 'view' },
      { id: 'shoots-book', resource: 'shoots', action: 'book' },
      { id: 'book-shoot-create', resource: 'book-shoot', action: 'create' },
      { id: 'photographers-view', resource: 'photographers', action: 'view' },
      { id: 'availability-view', resource: 'availability', action: 'view' },
      { id: 'accounting-view', resource: 'accounting', action: 'view' },
    ]
  },
  client: {
    role: 'client',
    permissions: [
      // Dashboard access
      { id: 'dashboard-view', resource: 'dashboard', action: 'view' },
      
      // Shoot permissions - only their own shoots
      { id: 'shoots-view', resource: 'shoots', action: 'view', conditions: { selfOnly: true } },
      { id: 'shoots-book', resource: 'shoots', action: 'book' },
      
      // Invoice permissions - only their own
      { id: 'invoices-view', resource: 'invoices', action: 'view', conditions: { selfOnly: true } },
      
      // Media permissions - only their own shoots, completed shoots
      { id: 'media-view', resource: 'media', action: 'view', conditions: { selfOnly: true } },
      { id: 'media-download', resource: 'media', action: 'download', conditions: { selfOnly: true } },
      { id: 'media-upload', resource: 'media', action: 'upload', conditions: { selfOnly: true } },
      
      // Tour permissions - read only
      { id: 'tours-view', resource: 'tours', action: 'view', conditions: { selfOnly: true } },
      
      // Notes permissions - only shoot notes
      { id: 'notes-view', resource: 'notes', action: 'view', conditions: { selfOnly: true } },
      
      // Profile settings
      { id: 'settings-view', resource: 'settings', action: 'view' },
      { id: 'settings-update', resource: 'settings', action: 'update', conditions: { selfOnly: true } },
    ]
  },
  photographer: {
    role: 'photographer',
    permissions: [
      // Dashboard access
      { id: 'dashboard-view', resource: 'dashboard', action: 'view' },
      
      // Shoot permissions - only assigned shoots
      { id: 'shoots-view', resource: 'shoots', action: 'view', conditions: { assignedOnly: true } },
      { id: 'shoots-update', resource: 'shoots', action: 'update', conditions: { assignedOnly: true } },
      
      // Client permissions - view only
      { id: 'clients-view', resource: 'clients', action: 'view' },
      
      // Media permissions - upload RAW files only
      { id: 'media-view', resource: 'media', action: 'view', conditions: { assignedOnly: true } },
      { id: 'media-upload', resource: 'media', action: 'upload', conditions: { assignedOnly: true } },
      
      // Tour permissions
      { id: 'tours-view', resource: 'tours', action: 'view', conditions: { assignedOnly: true } },
      
      // Notes permissions - can see shoot notes and photographer notes, can edit photographer notes
      { id: 'notes-view', resource: 'notes', action: 'view', conditions: { assignedOnly: true } },
      { id: 'photographer-notes-view', resource: 'photographer-notes', action: 'view', conditions: { assignedOnly: true } },
      { id: 'photographer-notes-update', resource: 'photographer-notes', action: 'update', conditions: { assignedOnly: true } },
      
      // Availability permissions
      { id: 'availability-view', resource: 'availability', action: 'view' },
      { id: 'availability-update', resource: 'availability', action: 'update', conditions: { selfOnly: true } },
      
      // Profile settings
      { id: 'settings-view', resource: 'settings', action: 'view' },
      { id: 'settings-update', resource: 'settings', action: 'update', conditions: { selfOnly: true } },
    ]
  },
  editor: {
    role: 'editor',
    permissions: [
      // Dashboard access
      { id: 'dashboard-view', resource: 'dashboard', action: 'view' },
      
      // Shoot permissions - only assigned shoots
      { id: 'shoots-view', resource: 'shoots', action: 'view', conditions: { assignedOnly: true } },
      { id: 'shoots-update', resource: 'shoots', action: 'update', conditions: { assignedOnly: true } },
      
      // Media permissions
      { id: 'media-view', resource: 'media', action: 'view' },
      { id: 'media-upload', resource: 'media', action: 'upload' },
      { id: 'media-update', resource: 'media', action: 'update' },
      
      // Tour permissions
      { id: 'tours-view', resource: 'tours', action: 'view' },
      { id: 'tours-update', resource: 'tours', action: 'update' },
      
      // Notes permissions - can see shoot notes, editing notes, photographer notes
      { id: 'notes-view', resource: 'notes', action: 'view' },
      { id: 'editing-notes-view', resource: 'editing-notes', action: 'view' },
      { id: 'editing-notes-update', resource: 'editing-notes', action: 'update' },
      { id: 'photographer-notes-view', resource: 'photographer-notes', action: 'view' },
      
      // Profile settings
      { id: 'settings-view', resource: 'settings', action: 'view' },
      { id: 'settings-update', resource: 'settings', action: 'update', conditions: { selfOnly: true } },
    ]
  }
};
