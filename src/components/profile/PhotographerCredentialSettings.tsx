import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ExternalLink, Upload, X } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { FileUploadModal } from '@/components/accounts/FileUploadModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useSelfProfileSave } from '@/hooks/useSelfProfileSave';
import { useToast } from '@/hooks/use-toast';
import {
  photographerCredentialSchema,
  type PhotographerCredentialValues,
} from '@/pages/photographerAccountSchemas';

const readText = (value: unknown) => (typeof value === 'string' ? value : '');

const credentialValues = (user: ReturnType<typeof useAuth>['user']): PhotographerCredentialValues => {
  const metadata = user?.metadata && typeof user.metadata === 'object' ? user.metadata : {};
  return {
    licenseNumber: readText(user?.licenseNumber ?? user?.license_number),
    insuranceNumber: readText(metadata.insuranceNumber),
    insuranceFile: readText(metadata.insuranceFile),
    insuranceFileName: readText(metadata.insuranceFileName),
    pilotLicenseFile: readText(metadata.pilotLicenseFile),
    pilotLicenseFileName: readText(metadata.pilotLicenseFileName),
  };
};

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

function DocumentField({
  label,
  nameValue,
  fileValue,
  onNameChange,
  onUpload,
  onClear,
  nameError,
}: {
  label: string;
  nameValue: string;
  fileValue: string;
  onNameChange: (value: string) => void;
  onUpload: () => void;
  onClear: () => void;
  nameError?: string;
}) {
  const canView = /^https?:\/\//i.test(fileValue);
  return (
    <div className="space-y-2">
      <FormLabel>{label}</FormLabel>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={nameValue}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="No file uploaded"
          aria-label={`${label} name`}
        />
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onUpload} aria-label={fileValue ? `Change ${label}` : `Upload ${label}`}>
            <Upload className="mr-2 h-4 w-4" />
            {fileValue ? 'Change' : 'Upload'}
          </Button>
          {canView && (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={fileValue} target="_blank" rel="noreferrer" aria-label={`View ${label}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View
              </a>
            </Button>
          )}
          {fileValue && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} aria-label={`Remove ${label}`}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {nameError && <p className="text-sm font-medium text-destructive">{nameError}</p>}
    </div>
  );
}

export function PhotographerCredentialSettings() {
  const { user } = useAuth();
  const { saveProfile } = useSelfProfileSave();
  const { toast } = useToast();
  const [pilotOpen, setPilotOpen] = useState(false);
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const form = useForm<PhotographerCredentialValues>({
    resolver: zodResolver(photographerCredentialSchema),
    defaultValues: credentialValues(user),
  });
  const savedCredentials = JSON.stringify(credentialValues(user));
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!isDirty) {
      form.reset(JSON.parse(savedCredentials) as PhotographerCredentialValues);
    }
  }, [form, isDirty, savedCredentials]);

  const onSubmit = async (data: PhotographerCredentialValues) => {
    try {
      const result = await saveProfile({
        license_number: blankToNull(data.licenseNumber),
        insuranceNumber: blankToNull(data.insuranceNumber),
        insuranceFile: blankToNull(data.insuranceFile),
        insuranceFileName: blankToNull(data.insuranceFileName),
        pilotLicenseFile: blankToNull(data.pilotLicenseFile),
        pilotLicenseFileName: blankToNull(data.pilotLicenseFileName),
      });
      form.reset(data);
      if (!result.reauthRequired) {
        toast({
          title: 'Licenses updated',
          description: 'Your license number, insurance, and pilot license have been saved.',
        });
      }
    } catch (error) {
      toast({
        title: 'Unable to save licenses',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Insurance & pilot license</CardTitle>
              <CardDescription>
                Update the license number, insurance, and pilot license saved when your account was created.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License number</FormLabel>
                    <FormControl>
                      <Input placeholder="LI0123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="insuranceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter insurance number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DocumentField
                label="Insurance Document"
                nameValue={form.watch('insuranceFileName')}
                fileValue={form.watch('insuranceFile')}
                nameError={form.formState.errors.insuranceFile?.message || form.formState.errors.insuranceFileName?.message}
                onNameChange={(value) => form.setValue('insuranceFileName', value, { shouldDirty: true, shouldValidate: true })}
                onUpload={() => setInsuranceOpen(true)}
                onClear={() => {
                  form.setValue('insuranceFile', '', { shouldDirty: true, shouldValidate: true });
                  form.setValue('insuranceFileName', '', { shouldDirty: true, shouldValidate: true });
                }}
              />
              <DocumentField
                label="Pilot License"
                nameValue={form.watch('pilotLicenseFileName')}
                fileValue={form.watch('pilotLicenseFile')}
                nameError={form.formState.errors.pilotLicenseFile?.message || form.formState.errors.pilotLicenseFileName?.message}
                onNameChange={(value) => form.setValue('pilotLicenseFileName', value, { shouldDirty: true, shouldValidate: true })}
                onUpload={() => setPilotOpen(true)}
                onClear={() => {
                  form.setValue('pilotLicenseFile', '', { shouldDirty: true, shouldValidate: true });
                  form.setValue('pilotLicenseFileName', '', { shouldDirty: true, shouldValidate: true });
                }}
              />
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Licenses'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
      <FileUploadModal
        open={insuranceOpen}
        onOpenChange={setInsuranceOpen}
        onUploadComplete={(url, fileName) => {
          form.setValue('insuranceFile', url, { shouldDirty: true, shouldValidate: true });
          form.setValue('insuranceFileName', fileName || 'Insurance Document', { shouldDirty: true, shouldValidate: true });
        }}
        title="Upload Insurance Document"
        folder="insurance"
        accept="image/*,.pdf"
        initialValue={form.watch('insuranceFile')}
        initialFileName={form.watch('insuranceFileName')}
        showFileNameInput
        fileNameLabel="Document Name"
      />
      <FileUploadModal
        open={pilotOpen}
        onOpenChange={setPilotOpen}
        onUploadComplete={(url, fileName) => {
          form.setValue('pilotLicenseFile', url, { shouldDirty: true, shouldValidate: true });
          form.setValue('pilotLicenseFileName', fileName || 'Pilot License', { shouldDirty: true, shouldValidate: true });
        }}
        title="Upload Pilot License"
        folder="pilot-licenses"
        accept="image/*,.pdf"
        initialValue={form.watch('pilotLicenseFile')}
        initialFileName={form.watch('pilotLicenseFileName')}
        showFileNameInput
        fileNameLabel="License Number/Name"
      />
    </>
  );
}
