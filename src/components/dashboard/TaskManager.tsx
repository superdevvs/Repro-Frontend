
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListChecks, Plus } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Task, TaskAssignee, TaskPriority, TaskStatus } from './TaskTypes';
import { initialTasks } from './mockTasksData';
import { processTasksData } from './TaskUtils';
import { AnimatePresence } from 'framer-motion';
import { TaskItem } from './TaskItem';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskFilters } from './TaskFilters';
import { EmptyTaskList } from './EmptyTaskList';

interface TaskManagerProps {
  className?: string;
  showAllTasks?: boolean;
  relatedShootId?: string;
}

export function TaskManager({
  className,
  showAllTasks = true,
  relatedShootId
}: TaskManagerProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Task state
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority'>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // New task form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<TaskAssignee>('editor');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [relatedShoot, setRelatedShoot] = useState<string | null>(relatedShootId || null);

  // Process tasks (filter and sort)
  const processedTasks = processTasksData(
    tasks,
    filter,
    priorityFilter,
    sortBy,
    sortDirection,
    relatedShootId,
    role,
    user?.name
  );

  // Handle creating a new task
  const handleCreateTask = () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Task title is required",
        variant: "destructive"
      });
      return;
    }
    
    const newTask: Task = {
      id: (tasks.length + 1).toString(),
      title,
      description,
      assignedTo,
      status: 'pending',
      priority,
      createdBy: user?.name || 'Unknown',
      createdAt: new Date().toISOString(),
      relatedShoot,
      dueDate
    };
    
    setTasks([...tasks, newTask]);
    resetForm();
    setNewTaskOpen(false);
    
    toast({
      title: "Task created",
      description: "The task has been successfully created"
    });
  };

  // Handle editing a task
  const handleEditTask = () => {
    if (!editTaskId) return;
    
    const updatedTasks = tasks.map(task => {
      if (task.id === editTaskId) {
        return {
          ...task,
          title,
          description,
          assignedTo,
          priority,
          dueDate
        };
      }
      return task;
    });
    
    setTasks(updatedTasks);
    resetForm();
    setEditTaskId(null);
    setNewTaskOpen(false);
    
    toast({
      title: "Task updated",
      description: "The task has been successfully updated"
    });
  };

  // Delete a task
  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
    
    toast({
      title: "Task deleted",
      description: "The task has been successfully deleted"
    });
  };

  // Update task status
  const handleStatusChange = (id: string, newStatus: TaskStatus) => {
    const updatedTasks = tasks.map(task => {
      if (task.id === id) {
        return {
          ...task,
          status: newStatus
        };
      }
      return task;
    });
    
    setTasks(updatedTasks);
    
    toast({
      title: "Status updated",
      description: `Task marked as ${newStatus}`
    });
  };

  // Reset form fields
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('editor');
    setPriority('medium');
    setDueDate('');
    setRelatedShoot(relatedShootId || null);
  };

  // Handle refresh button click
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: "Refreshed",
        description: "Task list has been refreshed"
      });
    }, 800);
  };

  // Start editing a task
  const startEditTask = (task: Task) => {
    setTitle(task.title);
    setDescription(task.description);
    setAssignedTo(task.assignedTo);
    setPriority(task.priority);
    setDueDate(task.dueDate);
    setRelatedShoot(task.relatedShoot);
    setEditTaskId(task.id);
    setNewTaskOpen(true);
  };

  // Check if user can edit this task based on role
  const canEditTask = (task: Task) => {
    if (['admin', 'superadmin', 'editing_manager'].includes(role)) return true;
    if (role === 'photographer' && task.createdBy.includes(user?.name || '')) return true;
    if (role === 'editor' && task.assignedTo === 'editor') return true;
    return false;
  };

  // Check if user can create tasks
  const canCreateTasks = ['admin', 'superadmin', 'editing_manager', 'photographer', 'rep'].includes(role);

  return (
    <div className={className}>
      <Card className="shadow-sm border border-border/40 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-card border-b">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Tasks & To-Do</CardTitle>
          </div>
          
          <div className="flex items-center gap-2">
            {canCreateTasks && (
              <Button 
                variant="accent"
                size={isMobile ? "sm" : "default"} 
                onClick={() => {
                  resetForm();
                  setEditTaskId(null);
                  setNewTaskOpen(true);
                }} 
                className={`gap-1 font-medium ${isMobile ? 'px-2 py-1 h-8 text-sm' : ''}`}
              >
                <Plus className="h-4 w-4" />
                {!isMobile && "New Task"}
              </Button>
            )}
            
            {showAllTasks && (
              <TaskFilters
                isMobile={isMobile}
                filter={filter}
                priorityFilter={priorityFilter}
                sortBy={sortBy}
                sortDirection={sortDirection}
                isRefreshing={isRefreshing}
                setFilter={setFilter}
                setPriorityFilter={setPriorityFilter}
                setSortBy={setSortBy}
                setSortDirection={setSortDirection}
                handleRefresh={handleRefresh}
              />
            )}
          </div>
        </CardHeader>
        
        <CardContent className={`${isMobile ? 'p-3' : 'p-4'} bg-card/80`}>
          {processedTasks.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {processedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onEdit={startEditTask}
                    onDelete={handleDeleteTask}
                    canEdit={canEditTask(task)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyTaskList
              filter={filter}
              priorityFilter={priorityFilter}
              onCreateTask={() => setNewTaskOpen(true)}
              canCreateTask={canCreateTasks}
            />
          )}
        </CardContent>
      </Card>
      
      {/* Create/Edit Task Dialog */}
      <TaskFormDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        title={title}
        description={description}
        assignedTo={assignedTo}
        priority={priority}
        dueDate={dueDate}
        relatedShoot={relatedShoot}
        relatedShootId={relatedShootId}
        isEdit={!!editTaskId}
        isMobile={isMobile}
        onCancel={() => {
          resetForm();
          setNewTaskOpen(false);
          setEditTaskId(null);
        }}
        onSubmit={editTaskId ? handleEditTask : handleCreateTask}
        setTitle={setTitle}
        setDescription={setDescription}
        setAssignedTo={setAssignedTo}
        setPriority={setPriority}
        setDueDate={setDueDate}
        setRelatedShoot={setRelatedShoot}
      />
    </div>
  );
}
