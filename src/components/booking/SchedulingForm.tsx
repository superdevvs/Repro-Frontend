import { SchedulingFormView } from './SchedulingFormView';
import { useSchedulingFormController } from './useSchedulingFormController';
import type { SchedulingFormProps } from './schedulingModel';

export const SchedulingForm = (props: SchedulingFormProps) => {
  const controller = useSchedulingFormController(props);
  return <SchedulingFormView controller={controller} />;
};
