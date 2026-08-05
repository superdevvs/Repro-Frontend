import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Upload, X } from 'lucide-react';
import type { AccountFormController } from './useAccountFormController';

export function AccountInsuranceFields({ controller }: { controller: AccountFormController }) {
  const {
    form,
    currentRole,
    isSalesRep,
    setInsuranceModalOpen,
    setPilotLicenseModalOpen,
  } = controller;
  return (
    <>
            {currentRole === "photographer" && !isSalesRep && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Insurance & Pilot License</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload insurance documents and pilot license
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-2">
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
                  <FormField
                    control={form.control}
                    name="insuranceFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance Document</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              placeholder="No file uploaded"
                              value={form.watch("insuranceFileName") || ""}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setInsuranceModalOpen(true)}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {form.watch("insuranceFile") ? "Change" : "Upload"}
                            </Button>
                            {form.watch("insuranceFile") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  form.setValue("insuranceFile", "");
                                  form.setValue("insuranceFileName", "");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pilotLicenseFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pilot License</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              placeholder="No file uploaded"
                              value={form.watch("pilotLicenseFileName") || ""}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPilotLicenseModalOpen(true)}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {form.watch("pilotLicenseFile") ? "Change" : "Upload"}
                            </Button>
                            {form.watch("pilotLicenseFile") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  form.setValue("pilotLicenseFile", "");
                                  form.setValue("pilotLicenseFileName", "");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
    </>
  );
}
