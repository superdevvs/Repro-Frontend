import { AccountFormView } from './AccountFormView';
import { useAccountFormController } from './useAccountFormController';
import type { AccountFormProps } from './accountFormModel';

export type { AccountFormValues } from './accountFormModel';

export function AccountForm(props: AccountFormProps) {
  const controller = useAccountFormController(props);
  return <AccountFormView controller={controller} />;
}
