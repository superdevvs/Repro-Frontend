export interface EditingDialogRequest {
  shootId: string | number;
  fileIds?: number[];
  resolve: (sent: boolean) => void;
}

let openDialog: ((request: EditingDialogRequest) => void) | null = null;

export function registerEditingDialog(handler: (request: EditingDialogRequest) => void) {
  openDialog = handler;
  return () => { if (openDialog === handler) openDialog = null; };
}

/** Every shoot entry point shares the same service-aware dispatch and target selection. */
export function sendShootToEditing(shootId: string | number, fileIds?: number[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!openDialog) { reject(new Error('The editing dialog is not available. Reload and try again.')); return; }
    openDialog({ shootId, fileIds, resolve });
  });
}
