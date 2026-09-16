import { ClientPropertyFormView } from './ClientPropertyFormView';
import { useClientPropertyFormController, type ClientPropertyFormProps } from './useClientPropertyFormController';

export type { ClientPropertyFormSlide, InternalShootType } from './useClientPropertyFormController';

export const ClientPropertyForm = (props: ClientPropertyFormProps) => {
  const controller = useClientPropertyFormController(props);
  return <ClientPropertyFormView controller={controller} />;
};
