export interface SystemPageCatalog {
  id: string;
  label: string;
  route: string;
  pageKey: string;
  components: string[];
  apis: string[];
  services: string[];
  externals?: string[];
}

export interface SystemDomainCatalog {
  id: string;
  label: string;
  icon: string;
  description: string;
  pages: SystemPageCatalog[];
}

export const systemOverviewCatalog: SystemDomainCatalog[] = [
  {
    id: 'Auth',
    label: 'Auth',
    icon: 'shield',
    description: 'Identity, session bootstrap, login, reset, and permission hydration.',
    pages: [
      {
        id: 'auth-login',
        label: 'Login / Landing',
        route: '/',
        pageKey: 'auth-login',
        components: ['Index', 'LoginForm', 'RegisterForm'],
        apis: ['/api/login', '/api/register', '/api/user', '/api/me/permissions'],
        services: ['AuthController', 'PermissionController'],
      },
      {
        id: 'auth-reset',
        label: 'Reset Password',
        route: '/reset-password',
        pageKey: 'auth-reset',
        components: ['ResetPassword'],
        apis: ['/api/password/forgot', '/api/password/reset'],
        services: ['AuthController'],
      },
    ],
  },
  {
    id: 'Dashboard',
    label: 'Dashboard',
    icon: 'layout',
    description: 'Main operational dashboard, live activity, and role-aware summaries.',
    pages: [
      {
        id: 'dashboard-main',
        label: 'Dashboard',
        route: '/dashboard',
        pageKey: 'dashboard',
        components: ['Dashboard', 'ActivityMonitorCard', 'RealtimeBridge'],
        apis: ['/api/dashboard/overview', '/api/notifications', '/api/robbie/insights'],
        services: ['DashboardController'],
      },
    ],
  },
  {
    id: 'Shoots',
    label: 'Shoots',
    icon: 'route',
    description: 'Booking, shoot detail, workflow, files, and operational scheduling.',
    pages: [
      {
        id: 'shoot-book',
        label: 'Book Shoot',
        route: '/book-shoot',
        pageKey: 'book-shoot',
        components: ['BookShoot', 'ClientPropertyForm', 'SchedulingForm'],
        apis: ['/api/shoots', '/api/services', '/api/categories', '/api/photographer/availability/for-booking'],
        services: ['ShootController', 'PhotographerAvailabilityController'],
        externals: ['BridgeData', 'Address lookup'],
      },
      {
        id: 'shoot-history',
        label: 'Shoot History',
        route: '/shoot-history',
        pageKey: 'shoot-history',
        components: ['ShootHistory', 'ShootHistoryView', 'ShootHistoryMapView'],
        apis: ['/api/shoots', '/api/photographer/shoots'],
        services: ['ShootController', 'PhotographerShootController'],
      },
      {
        id: 'shoot-detail',
        label: 'Shoot Detail',
        route: '/shoots/:id',
        pageKey: 'shoot-detail',
        components: ['ShootDetails', 'ShootDetailTabs', 'ShootDetailsMediaTab'],
        apis: ['/api/shoots/{shoot}', '/api/editing-requests', '/api/images/{file}/status'],
        services: ['ShootController', 'EditingRequestController', 'ImageProcessingController'],
        externals: ['Dropbox'],
      },
    ],
  },
  {
    id: 'Accounts',
    label: 'Accounts',
    icon: 'users',
    description: 'Users, account linking, client ops, and shared account context.',
    pages: [
      {
        id: 'accounts-main',
        label: 'Accounts',
        route: '/accounts',
        pageKey: 'accounts',
        components: ['Accounts', 'AccountForm', 'AccountLinkingManager'],
        apis: ['/api/admin/users', '/api/admin/account-links', '/api/admin/clients', '/api/admin/photographers'],
        services: ['UserController', 'AccountLinkController'],
      },
      {
        id: 'availability-main',
        label: 'Availability',
        route: '/availability',
        pageKey: 'availability',
        components: ['Availability', 'CalendarSyncModal'],
        apis: ['/api/photographer/availability/{photographerId}', '/api/photographer/availability/bulk-index'],
        services: ['PhotographerAvailabilityController'],
      },
    ],
  },
  {
    id: 'Messaging',
    label: 'Messaging',
    icon: 'message',
    description: 'Email, SMS, templates, automations, and messaging settings.',
    pages: [
      {
        id: 'messaging-overview',
        label: 'Messaging Overview',
        route: '/messaging',
        pageKey: 'messaging-overview',
        components: ['MessagingOverview', 'EmailNavigation'],
        apis: ['/api/messaging/overview', '/api/messaging/email/threads'],
        services: ['MessagingOverviewController', 'EmailMessagingController'],
        externals: ['Cakemail'],
      },
      {
        id: 'messaging-automations',
        label: 'Automation Editor',
        route: '/messaging/email/automations',
        pageKey: 'messaging-automations',
        components: ['AutomationWorkflowEditor', 'AutomationWorkflowNode'],
        apis: ['/api/messaging/automations', '/api/messaging/automations/validate'],
        services: ['AutomationController'],
      },
      {
        id: 'messaging-sms',
        label: 'SMS Center',
        route: '/messaging/sms',
        pageKey: 'messaging-sms',
        components: ['SmsCenter'],
        apis: ['/api/messaging/sms/threads', '/api/messaging/settings/sms'],
        services: ['SmsMessagingController', 'MessagingSettingsController'],
        externals: ['Twilio'],
      },
      {
        id: 'messaging-settings',
        label: 'Messaging Settings',
        route: '/messaging/settings',
        pageKey: 'messaging-settings',
        components: ['MessagingSettings'],
        apis: ['/api/messaging/settings/email', '/api/messaging/settings/sms'],
        services: ['MessagingSettingsController'],
        externals: ['Twilio', 'Cakemail'],
      },
    ],
  },
  {
    id: 'Billing',
    label: 'Billing',
    icon: 'banknote',
    description: 'Invoices, client billing, accounting, and payment links.',
    pages: [
      {
        id: 'billing-invoices',
        label: 'Invoices',
        route: '/invoices',
        pageKey: 'invoices',
        components: ['Invoices', 'InvoiceList'],
        apis: ['/api/invoices', '/api/reports/invoices/summary'],
        services: ['InvoiceController', 'InvoiceReportController'],
      },
      {
        id: 'billing-accounting',
        label: 'Accounting',
        route: '/accounting',
        pageKey: 'accounting',
        components: ['Accounting', 'RevenueCharts', 'PendingInvoiceApprovals'],
        apis: ['/api/admin/invoices', '/api/client/billing'],
        services: ['InvoiceController', 'ClientBillingController'],
        externals: ['Stripe'],
      },
    ],
  },
  {
    id: 'Integrations',
    label: 'Integrations',
    icon: 'plug',
    description: 'MLS, Dropbox, publishing, third-party sync, and external delivery links.',
    pages: [
      {
        id: 'integrations-settings',
        label: 'Integrations',
        route: '/integrations',
        pageKey: 'integrations',
        components: ['Integrations', 'IntegrationsSettingsContent', 'ToursSection'],
        apis: ['/api/integrations/test-connection', '/api/integrations/dropbox/status', '/api/dropbox/connect'],
        services: ['IntegrationController', 'DropboxAuthController'],
        externals: ['Dropbox', 'Bright MLS', 'iGUIDE', 'MMM'],
      },
      {
        id: 'integrations-mls-queue',
        label: 'MLS Queue',
        route: '/mls-publishing-queue',
        pageKey: 'mls-queue',
        components: ['MlsPublishingQueue'],
        apis: ['/api/integrations/mls-queue', '/api/integrations/bright-mls/redirect/{manifestId}'],
        services: ['IntegrationController'],
        externals: ['Bright MLS'],
      },
    ],
  },
  {
    id: 'AI',
    label: 'AI',
    icon: 'sparkles',
    description: 'Robbie chat, AI editing, CubiCasa, and video generation flows.',
    pages: [
      {
        id: 'ai-robbie',
        label: 'Chat With Robbie',
        route: '/chat-with-reproai',
        pageKey: 'ai-robbie',
        components: ['ChatWithReproAi', 'RobbieInsightStrip'],
        apis: ['/api/ai/health', '/api/robbie/insights'],
        services: ['AiChatController', 'DashboardController'],
      },
      {
        id: 'ai-editing',
        label: 'AI Editing',
        route: '/ai-editing',
        pageKey: 'ai-editing',
        components: ['AiEditing', 'ShootAndImageSelector'],
        apis: ['/api/ai-editing/jobs', '/api/higgs/generate'],
        services: ['HiggsFieldController'],
        externals: ['Higgs'],
      },
      {
        id: 'ai-cubicasa',
        label: 'CubiCasa',
        route: '/cubicasa-scanning',
        pageKey: 'cubicasa',
        components: ['CubiCasaScanning'],
        apis: ['/api/cubicasa/orders', '/api/cubicasa/orders/{id}/status'],
        services: ['CubiCasaController'],
        externals: ['CubiCasa'],
      },
    ],
  },
  {
    id: 'Settings',
    label: 'Settings',
    icon: 'settings',
    description: 'Profile, permissions, integrations, and superadmin configuration.',
    pages: [
      {
        id: 'settings-main',
        label: 'Settings',
        route: '/settings',
        pageKey: 'settings',
        components: ['Settings', 'RobbieSettings', 'WatermarkEditor'],
        apis: ['/api/profile', '/api/users/{user}/branding', '/api/admin/robbie-settings', '/api/admin/watermark-settings'],
        services: ['AuthController', 'RobbieSettingsController', 'WatermarkSettingsController'],
      },
      {
        id: 'settings-permissions',
        label: 'Permission Settings',
        route: '/permission-settings',
        pageKey: 'permission-settings',
        components: ['PermissionSettings', 'PermissionsManager'],
        apis: ['/api/admin/permissions', '/api/me/permissions'],
        services: ['PermissionController'],
      },
      {
        id: 'settings-scheduling',
        label: 'Scheduling Settings',
        route: '/scheduling-settings',
        pageKey: 'scheduling-settings',
        components: ['SchedulingSettings'],
        apis: ['/api/admin/settings/{key}', '/api/admin/services', '/api/admin/service-groups'],
        services: ['SettingsController', 'ServiceController', 'ServiceGroupController'],
      },
    ],
  },
];

export const flattenCatalogPages = () => systemOverviewCatalog.flatMap((domain) => domain.pages.map((page) => ({ ...page, domain: domain.id })));

export const findCatalogPageByRoute = (pathname: string) => {
  const pages = flattenCatalogPages();

  const matchers = pages.map((page) => ({
    page,
    matches:
      pathname === page.route ||
      (page.route.includes('/:') && pathname.startsWith(page.route.split('/:')[0])) ||
      (page.route !== '/' && pathname.startsWith(page.route + '/')) ||
      pathname.startsWith(page.route.replace(/\/:\w+/, '')),
  }));

  return matchers.find((entry) => entry.matches)?.page ?? null;
};
