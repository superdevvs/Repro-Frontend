import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, LayoutGrid, LayoutList, Printer, Copy, FileDown, MoreVertical, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { Role } from "@/components/auth/AuthProvider";

interface AccountsHeaderProps {
  onExport: (format?: 'csv' | 'print' | 'copy') => void;
  onImport: (file: File) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  onFilterChange: (role: Role | 'all') => void;
  selectedFilter: Role | 'all';
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  repFilter: string;
  onRepFilterChange: (value: string) => void;
  repOptions: { value: string; label: string }[];
}

export function AccountsHeader({
  onExport,
  onImport,
  onSearch,
  searchQuery,
  onFilterChange,
  selectedFilter,
  viewMode,
  onViewModeChange,
  repFilter,
  onRepFilterChange,
  repOptions,
}: AccountsHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileRepMenuOpen, setMobileRepMenuOpen] = useState(false);
  const repFilterLabel =
    repFilter === "all"
      ? "All reps"
      : repFilter === "unassigned"
        ? "Unassigned"
        : repOptions.find((rep) => rep.value === repFilter)?.label || "Rep filter";

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex flex-wrap items-center gap-2">
        {/* View Toggle */}
        <div className="flex items-center border rounded-lg p-0.5">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className="h-7 w-7 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="h-7 w-7 p-0"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>

        {/* Rep Filter */}
        <Select value={repFilter} onValueChange={onRepFilterChange}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="All reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reps</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {repOptions.map((rep) => (
              <SelectItem key={rep.value} value={rep.value}>
                {rep.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Import */}
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9">
          <Download className="mr-1.5 h-4 w-4" />
          Import
        </Button>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <FileDown className="mr-1.5 h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport('csv')}>
              <Download className="mr-2 h-4 w-4" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('print')}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('copy')}>
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile overflow */}
      <DropdownMenu onOpenChange={(open) => !open && setMobileRepMenuOpen(false)}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9 sm:hidden" title="Account controls">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 sm:hidden max-h-[70dvh] overflow-y-auto overscroll-contain">
          {!mobileRepMenuOpen ? (
            <>
              <DropdownMenuItem onClick={() => onViewModeChange('grid')}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Grid view
                {viewMode === 'grid' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewModeChange('list')}>
                <LayoutList className="mr-2 h-4 w-4" />
                List view
                {viewMode === 'list' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setMobileRepMenuOpen(true);
                }}
              >
                <span className="truncate">Rep: {repFilterLabel}</span>
                <ChevronRight className="ml-auto h-4 w-4" />
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Download className="mr-2 h-4 w-4" />
                Import
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('csv')}>
                <FileDown className="mr-2 h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('print')}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('copy')}>
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setMobileRepMenuOpen(false);
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem disabled className="text-xs font-medium text-muted-foreground">
                <span className="truncate">Rep filter: {repFilterLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRepFilterChange('all')}>
                <span className="truncate">All reps</span>
                {repFilter === 'all' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRepFilterChange('unassigned')}>
                <span className="truncate">Unassigned</span>
                {repFilter === 'unassigned' && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              {repOptions.map((rep) => (
                <DropdownMenuItem key={rep.value} onClick={() => onRepFilterChange(rep.value)}>
                  <span className="truncate">{rep.label}</span>
                  {repFilter === rep.value && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onImport(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
