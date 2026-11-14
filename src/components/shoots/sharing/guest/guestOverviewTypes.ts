export type GuestFile = {
  id: number;
  name: string;
  kind: string;
  preview_url: string;
  download_url: string;
};

export type GuestOverview = {
  property: {
    address: string; city: string; state: string; zip: string;
    beds: number | null; baths: number | null; sqft: number | null;
  };
  services: Array<{ name: string; components: Array<{ label: string; status: string }> }>;
  files: GuestFile[];
  tours: Array<{ label: string; url: string }>;
  expires_at: string;
};
