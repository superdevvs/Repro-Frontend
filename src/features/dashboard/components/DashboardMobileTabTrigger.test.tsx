import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Camera } from 'lucide-react';
import { Tabs, TabsList } from '@/components/ui/tabs';
import { DashboardMobileTabTrigger } from './DashboardMobileTabTrigger';

afterEach(() => cleanup());

describe('DashboardMobileTabTrigger counts', () => {
  it('shows the count badge on inactive icon-only tabs and includes it in aria-label', () => {
    render(
      <Tabs value="other">
        <TabsList>
          <DashboardMobileTabTrigger value="completed" label="Completed" icon={Camera} count={6} />
          <DashboardMobileTabTrigger value="other" label="Other" icon={Camera} count={2} />
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByLabelText('Completed, 6')).toBeInTheDocument();
    // Label stays in the DOM but is visually hidden until active.
    expect(screen.getByText('Completed')).toHaveClass('hidden');
  });

  it('keeps the count badge beside the active label', () => {
    render(
      <Tabs value="completed">
        <TabsList>
          <DashboardMobileTabTrigger value="completed" label="Completed" icon={Camera} count={6} />
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toHaveClass('group-data-[state=active]:inline');
  });

  it('hides the badge when count is zero', () => {
    render(
      <Tabs value="completed">
        <TabsList>
          <DashboardMobileTabTrigger value="completed" label="Completed" icon={Camera} count={0} />
        </TabsList>
      </Tabs>,
    );

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Completed')).toBeInTheDocument();
  });
});
