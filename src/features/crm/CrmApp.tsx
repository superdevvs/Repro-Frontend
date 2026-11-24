import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/components/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useIsXLarge } from '@/hooks/use-media-query';
import { CRM_ENABLED } from './featureFlag';
import { CrmSidebar } from './layout/CrmSidebar';
import { CrmMobileNav } from './layout/CrmMobileNav';
import { CrmRobbieProvider } from './robbie/CrmRobbieContext';
import { useCrmRobbie } from './robbie/useCrmRobbie';
import { CrmRobbiePanel } from './robbie/CrmRobbiePanel';
import { CrmPage, Empty, Loading } from './ui/primitives';
import './crm.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const PipelinePage = lazy(() => import('./pages/PipelinePage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const ContactPage = lazy(() => import('./pages/contact/ContactPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const CompanyPage = lazy(() => import('./pages/CompanyPage'));
const ClientPoolPage = lazy(() => import('./pages/ClientPoolPage'));
const FollowUpsPage = lazy(() => import('./pages/FollowUpsPage'));
const QuotesPage = lazy(() => import('./pages/quotes/QuotesPage'));
const QuoteEditorPage = lazy(() => import('./pages/quotes/QuoteEditorPage'));
const EmailPage = lazy(() => import('./pages/email/EmailPage'));
const TemplateEditorPage = lazy(() => import('./pages/email/TemplateEditorPage'));
const DripBuilderPage = lazy(() => import('./pages/email/DripBuilderPage'));
const CampaignPage = lazy(() => import('./pages/email/CampaignPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UnassignedPage = lazy(() => import('./pages/UnassignedPage'));
const RecruitingPage = lazy(() => import('./pages/recruiting/RecruitingPage'));
const ApplicantPage = lazy(() => import('./pages/recruiting/ApplicantPage'));

function CrmBody() {
  const robbie = useCrmRobbie();
  const inlinePanel = useIsXLarge();
  const panelOpen = Boolean(robbie?.open);

  return (
    <div className="flex min-h-full min-w-0 gap-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route index element={<HomePage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="contacts/:id" element={<ContactPage />} />
            <Route path="contacts/:contactId/quotes/new" element={<QuoteEditorPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/:id" element={<CompanyPage />} />
            <Route path="client-pool" element={<ClientPoolPage />} />
            <Route path="follow-ups" element={<FollowUpsPage />} />
            <Route path="quotes" element={<QuotesPage />} />
            <Route path="quotes/:id" element={<QuoteEditorPage />} />
            <Route path="email" element={<EmailPage />} />
            <Route path="email/templates/:id" element={<TemplateEditorPage />} />
            <Route path="email/drips/:id" element={<DripBuilderPage />} />
            <Route path="email/campaigns/:id" element={<CampaignPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="unassigned" element={<UnassignedPage />} />
            <Route path="recruiting" element={<RecruitingPage />} />
            <Route path="recruiting/applicants/:id" element={<ApplicantPage />} />
            <Route path="*" element={<CrmPage title="Not found"><Empty title="This CRM page does not exist." /></CrmPage>} />
          </Routes>
        </Suspense>
      </div>
      {panelOpen && inlinePanel && (
        <CrmRobbiePanel className="sticky top-0 hidden h-[calc(100dvh-84px)] w-[380px] shrink-0 lg:flex" />
      )}
      {!inlinePanel && (
        <Sheet open={panelOpen} onOpenChange={(o) => robbie?.setOpen(o)}>
          <SheetContent side="bottom" className="crm-root mx-auto h-[85dvh] max-w-2xl rounded-t-2xl p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Robbie</SheetTitle>
            <CrmRobbiePanel className="h-full rounded-none border-0 shadow-none" />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/**
 * The Sales CRM: the Dashboard shell (top bar, search, Robbie strip) with the
 * CRM sidebar and pages. Lazy-loaded; dark until VITE_CRM_ENABLED is on.
 */
export default function CrmApp() {
  const { user, role, isImpersonating, originalUser } = useAuth();
  const identity = `${user?.id}:${role}:${isImpersonating}:${originalUser?.id}`;
  if (!CRM_ENABLED) return <Navigate to="/dashboard" replace />;

  return (
    <CrmRobbieProvider key={identity}>
      <DashboardLayout
        hideFooter
        sidebar={<CrmSidebar />}
        renderMobileNav={(report) => <CrmMobileNav onHeightChange={report} />}
        className="crm-root !bg-secondary dark:!bg-background lg:!pl-0 lg:!pt-0 lg:!pr-2 lg:!pb-2 max-md:!px-0 max-md:!pt-0"
      >
        <CrmBody />
      </DashboardLayout>
    </CrmRobbieProvider>
  );
}
