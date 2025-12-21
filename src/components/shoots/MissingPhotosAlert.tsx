import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MissingPhotosAlertProps {
  type: 'raw' | 'edited';
  uploaded: number;
  expected: number;
  missing: number;
  bracketMode?: number | null;
}

export const MissingPhotosAlert: React.FC<MissingPhotosAlertProps> = ({
  type,
  uploaded,
  expected,
  missing,
  bracketMode,
}) => {
  const isComplete = missing === 0 && uploaded === expected;
  const isOverage = uploaded > expected;
  const typeLabel = type === 'raw' ? 'RAW' : 'Edited';

  if (isComplete) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">
          {typeLabel} Upload Complete
        </AlertTitle>
        <AlertDescription className="text-green-700">
          All {expected} {typeLabel.toLowerCase()} photos have been uploaded successfully.
        </AlertDescription>
      </Alert>
    );
  }

  if (isOverage) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">
          Extra {typeLabel} Photos
        </AlertTitle>
        <AlertDescription className="text-blue-700">
          You've uploaded {uploaded} photos, which is {uploaded - expected} more than expected.
        </AlertDescription>
      </Alert>
    );
  }

  if (missing > 0) {
    return (
      <Alert variant="destructive" className="bg-red-50 border-red-200">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-900 flex items-center gap-2">
          Missing {typeLabel} Photos
          <Badge variant="destructive">{missing} Missing</Badge>
        </AlertTitle>
        <AlertDescription className="text-red-700 space-y-2">
          <div>
            {uploaded} of {expected} {typeLabel.toLowerCase()} photos uploaded.
            <span className="font-semibold ml-1">
              Please upload {missing} more photo{missing !== 1 ? 's' : ''}.
            </span>
          </div>
          {type === 'raw' && bracketMode && (
            <div className="text-xs mt-2 p-2 bg-red-100 rounded">
              <strong>Bracket Mode: {bracketMode}</strong>
              <br />
              You're using {bracketMode} brackets. Make sure you've uploaded all
              bracketed exposures for each scene.
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

interface PhotoCountsSummaryProps {
  rawUploaded?: number;
  rawExpected?: number;
  editedUploaded?: number;
  editedExpected?: number;
  extraUploaded?: number;
}

export const PhotoCountsSummary: React.FC<PhotoCountsSummaryProps> = ({
  rawUploaded = 0,
  rawExpected = 0,
  editedUploaded = 0,
  editedExpected = 0,
  extraUploaded = 0,
}) => {
  const rawMissing = Math.max(0, rawExpected - rawUploaded);
  const editedMissing = Math.max(0, editedExpected - editedUploaded);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 border rounded-lg">
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          RAW Photos
        </div>
        <div className="text-2xl font-bold">
          {rawUploaded}
          {rawExpected > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {rawExpected}
            </span>
          )}
        </div>
        {rawMissing > 0 && (
          <Badge variant="destructive" className="mt-2">
            {rawMissing} Missing
          </Badge>
        )}
        {rawMissing === 0 && rawExpected > 0 && (
          <Badge variant="default" className="mt-2 bg-green-600">
            Complete
          </Badge>
        )}
      </div>

      <div className="p-4 border rounded-lg">
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          Edited Photos
        </div>
        <div className="text-2xl font-bold">
          {editedUploaded}
          {editedExpected > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {editedExpected}
            </span>
          )}
        </div>
        {editedMissing > 0 && (
          <Badge variant="destructive" className="mt-2">
            {editedMissing} Missing
          </Badge>
        )}
        {editedMissing === 0 && editedExpected > 0 && (
          <Badge variant="default" className="mt-2 bg-green-600">
            Complete
          </Badge>
        )}
      </div>

      {extraUploaded > 0 && (
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Extra Photos
          </div>
          <div className="text-2xl font-bold">{extraUploaded}</div>
          <Badge variant="secondary" className="mt-2">
            Supplementary
          </Badge>
        </div>
      )}
    </div>
  );
};

