import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UploadIcon, FileTextIcon, CheckCircleIcon, AlertCircleIcon, DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/env';

interface ImportAccountsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface ImportResult {
  success: number;
  updated: number;
  failed: number;
  errors?: string[];
}

export function ImportAccountsDialog({ isOpen, onClose, onImportComplete }: ImportAccountsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImport = () => {
    setFile(null);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setImportResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/import/accounts/template`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'accounts_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const processImport = async () => {
    if (!file) return;
    
    setImporting(true);
    
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in to import accounts');
        setImporting(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('dry_run', dryRun ? '1' : '0');

      const response = await fetch(`${API_BASE_URL}/api/import/accounts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Import failed');
      }

      const result = await response.json();
      
      setImportResult({
        success: result.summary?.imported || 0,
        updated: result.summary?.updated || 0,
        failed: result.summary?.skipped || 0,
        errors: result.errors || [],
      });
      
      const totalProcessed = (result.summary?.imported || 0) + (result.summary?.updated || 0);
      if (totalProcessed > 0) {
        toast.success(`Successfully ${dryRun ? 'validated' : 'processed'} ${totalProcessed} accounts`);
        if (!dryRun && onImportComplete) {
          onImportComplete();
        }
      }
      
      if (result.summary?.skipped > 0) {
        toast.error(`${result.summary.skipped} accounts were skipped`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleClose = () => {
    resetImport();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Accounts</DialogTitle>
          <DialogDescription>
            Upload a CSV file with account data to import users into the system.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <DownloadIcon className="h-4 w-4 mr-2" /> Download Template
          </Button>
        </div>
        
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center ${file ? 'border-primary' : 'border-muted'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept=".csv,.txt,.tsv" 
          />
          
          {!file && !importResult && (
            <div className="flex flex-col items-center gap-2">
              <FileTextIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop your file here, or click to browse
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2" 
                onClick={handleImportClick}
              >
                <UploadIcon className="h-4 w-4 mr-2" /> Select File
              </Button>
            </div>
          )}
          
          {file && !importResult && (
            <div className="flex flex-col items-center gap-2">
              <FileTextIcon className="h-10 w-10 text-primary" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          )}
          
          {importResult && (
            <div className="flex flex-col items-center gap-2">
              {importResult.success > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  <p className="text-sm">
                    {dryRun ? 'Would create' : 'Created'} {importResult.success} accounts
                  </p>
                </div>
              )}

              {importResult.updated > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-blue-500" />
                  <p className="text-sm">
                    {dryRun ? 'Would update' : 'Updated'} {importResult.updated} accounts
                  </p>
                </div>
              )}
              
              {importResult.failed > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircleIcon className="h-5 w-5 text-destructive" />
                  <p className="text-sm">Skipped {importResult.failed} accounts</p>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-2 text-left w-full max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium text-destructive mb-1">Errors:</p>
                  {importResult.errors.slice(0, 5).map((error, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{error}</p>
                  ))}
                  {importResult.errors.length > 5 && (
                    <p className="text-xs text-muted-foreground">...and {importResult.errors.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {file && !importResult && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dryRunAccounts"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="dryRunAccounts" className="text-sm text-muted-foreground">
              Dry run (validate without importing)
            </label>
          </div>
        )}
        
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          {file && !importResult && (
            <Button onClick={resetImport} variant="outline" size="sm">
              Change File
            </Button>
          )}
          
          {importResult && (
            <Button onClick={resetImport} variant="outline" size="sm">
              Import Another File
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
            
            {file && !importResult && (
              <Button onClick={processImport} disabled={importing}>
                {importing ? "Processing..." : dryRun ? "Validate" : "Import Accounts"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
