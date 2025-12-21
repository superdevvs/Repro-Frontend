import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Search, LayoutGrid, LayoutList, Upload, Printer, Copy, FileDown } from "lucide-react";
import { Role } from "@/components/auth/AuthProvider";

interface AccountsHeaderProps {
  onExport: (format?: 'csv' | 'print' | 'copy') => void;
  onImport: (file: File) => void;
  onSearch: (query: string) => void;
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
  onFilterChange,
  selectedFilter,
  viewMode,
  onViewModeChange,
  repFilter,
  onRepFilterChange,
  repOptions,
}: AccountsHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  return (
    <div className="space-y-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="p-6 space-y-4">
        {/* Top Row: Search and Actions */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-9 h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 w-full"
            />
          </div>

          {/* Right Side Controls */}
          <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            <div className="flex items-center gap-2 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('grid')}
                className="h-8 w-8 p-0"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('list')}
                className="h-8 w-8 p-0"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
            <Select value={repFilter} onValueChange={onRepFilterChange}>
              <SelectTrigger className="w-[170px]">
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
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9">
              <Download className="mr-0 md:mr-2 h-4 w-4" />
              <span className="hidden md:inline">Import</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <FileDown className="mr-0 md:mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Export</span>
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
        </div>

        {/* Bottom Row: Role Filters */}
        <div className="flex overflow-x-auto pb-2 lg:pb-0 lg:flex-wrap gap-2 -mx-6 px-6 lg:mx-0 lg:px-0 no-scrollbar">
          <Button 
            variant={selectedFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('all')}
            className="h-9 whitespace-nowrap"
          >
            All Roles
          </Button>
          <Button 
            variant={selectedFilter === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('admin')}
            className="h-9 whitespace-nowrap"
          >
            Admins
          </Button>
          <Button 
            variant={selectedFilter === 'photographer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('photographer')}
            className="h-9 whitespace-nowrap"
          >
            Photographers
          </Button>
          <Button 
            variant={selectedFilter === 'client' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('client')}
            className="h-9 whitespace-nowrap"
          >
            Clients
          </Button>
          <Button 
            variant={selectedFilter === 'editor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('editor')}
            className="h-9 whitespace-nowrap"
          >
            Editors
          </Button>
          <Button 
            variant={selectedFilter === 'salesRep' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('salesRep')}
            className="h-9 whitespace-nowrap"
          >
            Sales Reps
          </Button>
        </div>
      </div>
    </div>
  );
}
