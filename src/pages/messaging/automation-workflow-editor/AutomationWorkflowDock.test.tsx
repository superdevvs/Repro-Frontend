import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { WorkflowSummary } from './helpers';
import { AutomationWorkflowDock } from './AutomationWorkflowDock';

const summary = {
  trigger: undefined,
  totalNodes: 3,
  totalEdges: 2,
  actionCount: 1,
  waitCount: 0,
  conditionCount: 0,
  nodeCounts: {},
} as WorkflowSummary;

function renderDock(overrides: Partial<ComponentProps<typeof AutomationWorkflowDock>> = {}) {
  const onAddNode = vi.fn();
  const onRun = vi.fn();
  render(
    <AutomationWorkflowDock
      summary={summary}
      validationState={null}
      simulationResult={null}
      isReadOnlyMobile={false}
      isStructureLocked={false}
      canRun={false}
      hasSavedAutomation
      nodePalette={[{ type: 'action.email', label: 'Send Email' }]}
      validatePending={false}
      simulatePending={false}
      runPending={false}
      onAddNode={onAddNode}
      onValidate={vi.fn()}
      onSimulate={vi.fn()}
      onRun={onRun}
      {...overrides}
    />,
  );
  return { onAddNode, onRun };
}

describe('workflow dock', () => {
  afterEach(() => cleanup());

  it('adds a step and keeps run now off unless this is a system automation', async () => {
    const user = userEvent.setup();
    const { onAddNode } = renderDock();

    await user.click(screen.getByRole('button', { name: 'Send Email' }));
    expect(onAddNode).toHaveBeenCalledWith('action.email');
    expect(screen.getByRole('button', { name: 'Run now' })).toBeDisabled();
    expect(screen.getByText('3 nodes · 2 edges · 1 action')).toBeInTheDocument();
  });

  it('turns add-step off while the path is locked', () => {
    renderDock({ isStructureLocked: true, canRun: true });
    expect(screen.getByRole('button', { name: 'Send Email' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Run now' })).toBeEnabled();
  });
});
