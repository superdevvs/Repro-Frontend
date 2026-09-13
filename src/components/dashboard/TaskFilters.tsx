import { InlineSpinner } from '@/components/ui/inline-spinner';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Filter, AlertCircle, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { TaskPriority, TaskStatus } from './TaskTypes';

interface TaskFiltersProps {
  isMobile: boolean;
  filter: 'all' | TaskStatus;
  priorityFilter: 'all' | TaskPriority;
  sortBy: 'dueDate' | 'priority';
  sortDirection: 'asc' | 'desc';
  isRefreshing: boolean;
  setFilter: (filter: 'all' | TaskStatus) => void;
  setPriorityFilter: (filter: 'all' | TaskPriority) => void;
  setSortBy: (sortBy: 'dueDate' | 'priority') => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  handleRefresh: () => void;
}

export function TaskFilters({
  isMobile,
  filter,
  priorityFilter,
  sortBy,
  sortDirection,
  isRefreshing,
  setFilter,
  setPriorityFilter,
  setSortBy,
  setSortDirection,
  handleRefresh
}: TaskFiltersProps) {
  return (
    <div className="flex items-center gap-1">
      {!isMobile && (
        <ToggleGroup 
          type="single" 
          value={sortBy} 
          onValueChange={(value) => {
            if (value) setSortBy(value as 'dueDate' | 'priority');
          }}
          className="bg-muted/20 p-1 rounded-lg"
        >
          <ToggleGroupItem value="dueDate" size="sm" className="text-xs h-7 px-2">
            Date {sortBy === 'dueDate' && (sortDirection === 'asc' ? '↑' : '↓')}
          </ToggleGroupItem>
          <ToggleGroupItem value="priority" size="sm" className="text-xs h-7 px-2">
            Priority {sortBy === 'priority' && (sortDirection === 'asc' ? '↑' : '↓')}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      
      <Button 
        variant="ghost" 
        size="sm"
        className="h-8 w-8 p-0" 
        onClick={() => {
          // Fix: Instead of using a function, directly set the new value
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        }}
      >
        {sortDirection === 'asc' ? 
          <ArrowDown className="h-4 w-4" /> : 
          <ArrowUp className="h-4 w-4" />
        }
      </Button>
      
      <Select 
        value={filter} 
        onValueChange={(value: any) => setFilter(value)}
      >
        <SelectTrigger className={isMobile ? "w-[90px] h-8 text-xs" : "w-[120px]"}>
          <Filter className="h-3.5 w-3.5 mr-1.5 opacity-70" />
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tasks</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in-progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      
      {!isMobile && (
        <Select 
          value={priorityFilter} 
          onValueChange={(value: any) => setPriorityFilter(value)}
        >
          <SelectTrigger className="w-[120px]">
            <AlertCircle className="h-3.5 w-3.5 mr-1.5 opacity-70" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      )}
      
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? <InlineSpinner className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
      </Button>
    </div>
  );
}
