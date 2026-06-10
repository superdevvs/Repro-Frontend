import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceAreaAssignmentTool } from '@/components/photographers/ServiceAreaAssignmentTool';
import { TestShootPanel } from '@/components/photographers/TestShootPanel';

/**
 * Admin page hosting the photographer service-area assignment tool (Req 10).
 *
 * The tool lets an admin filter, preview, and commit (kind, value) service-area
 * assignments to photographers without touching unrelated assignments. The
 * Test_Shoot simulator beneath it exercises the same region-based matching end to
 * end — create a scoped Test_Shoot, preview eligible photographers, and assign one
 * so it appears in that photographer's schedule (Req 10.7-10.11).
 */
const ServiceAreaAssignment = () => {
  return (
    <DashboardLayout>
      <div className="space-y-4 px-2 pt-3 pb-20 sm:space-y-6 sm:px-6 sm:pb-6 sm:pt-0">
        <PageHeader
          badge="Admin"
          title="Service Area Assignment"
          description="Assign region, state, or area service-area values to photographers. Preview matches before committing."
        />
        <ServiceAreaAssignmentTool />
        <TestShootPanel />
      </div>
    </DashboardLayout>
  );
};

export default ServiceAreaAssignment;
