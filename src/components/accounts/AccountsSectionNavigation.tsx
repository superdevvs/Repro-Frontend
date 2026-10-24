import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AccountsSectionVisibility {
  showPermissions: boolean;
  showLinking: boolean;
  showInactive: boolean;
}

const getSections = ({
  showPermissions,
  showLinking,
  showInactive,
}: AccountsSectionVisibility) => [
    { value: 'accounts', label: 'Accounts', visible: true },
    { value: 'permissions', label: 'Permissions', visible: showPermissions },
    { value: 'linking', label: 'Linking', visible: showLinking },
    { value: 'inactive', label: 'Inactive', visible: showInactive },
].filter((section) => section.visible);

interface AccountsSectionSelectProps extends AccountsSectionVisibility {
  value: string;
  onValueChange: (value: string) => void;
}

export function AccountsSectionSelect({ value, onValueChange, ...visibility }: AccountsSectionSelectProps) {
  const sections = getSections(visibility);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label="Account section"
        className="h-11 min-w-0 flex-1 gap-1.5 rounded-xl border-border/70 bg-muted/40 px-3 !text-sm font-semibold shadow-sm sm:hidden [&>span]:truncate [&>svg]:shrink-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[210px] rounded-xl p-1 shadow-lg">
        {sections.map((section) => (
          <SelectItem key={section.value} value={section.value} className="min-h-11 rounded-lg py-2.5 pr-4 font-medium">
            {section.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AccountsSectionTabs(visibility: AccountsSectionVisibility) {
  const sections = getSections(visibility);
  const gridCols = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][sections.length - 1];

  return (
    <TabsList className={`grid w-fit ${gridCols}`}>
      {sections.map((section) => (
        <TabsTrigger key={section.value} value={section.value}>{section.label}</TabsTrigger>
      ))}
    </TabsList>
  );
}
