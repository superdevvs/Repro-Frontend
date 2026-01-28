import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, LayoutGrid, LayoutList, Printer, Copy, FileDown } from "lucide-react";
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

  return (
    <div className="flex flex-wrap items-center gap-2">
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
  );
}
