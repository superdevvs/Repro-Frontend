import { z } from 'zod';

export const clientAccountPropertyFormSchema = z.object({
  propertyAddress: z.string().min(1, "Address is required"),
  aptSuite: z.string().optional(),
  propertyCity: z.string().min(1, "City is required"),
  propertyState: z.string()
    .min(1, "State is required")
    .max(2, "State must be a 2-letter abbreviation (e.g., CA, NY, DC)")
    .refine((val) => val.length === 2, "State must be exactly 2 characters"),
  propertyZip: z.string().min(1, "ZIP code is required"),
  bedRooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
  bathRooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
  sqft: z.number({ required_error: "Square footage is required" }).min(1, "Square footage is required"),
  propertyType: z.enum(["residential", "commercial"]),
  listingType: z.enum(["for_sale", "for_rent"]).optional(),
  propertyInfo: z.string().optional(),
  companyNotes: z.string().optional(),
  shootNotes: z.string().optional(),
  photographerNotes: z.string().optional(),
  editorNotes: z.string().optional(),
  selectedPackage: z.string().optional(),
  // Property access fields
  lockboxCode: z.string().optional(),
  lockboxLocation: z.string().optional(),
  accessContactName: z.string().optional(),
  accessContactPhone: z.string().optional(),
});

export const adminPropertyFormSchema = z.object({
  clientId: z.string().min(1, "Please select a client"),
  propertyAddress: z.string().min(1, "Address is required"),
  aptSuite: z.string().optional(),
  propertyCity: z.string().min(1, "City is required"),
  propertyState: z.string()
    .min(1, "State is required")
    .max(2, "State must be a 2-letter abbreviation (e.g., CA, NY, DC)")
    .refine((val) => val.length === 2, "State must be exactly 2 characters"),
  propertyZip: z.string().min(1, "ZIP code is required"),
  bedRooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
  bathRooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
  sqft: z.number({ required_error: "Square footage is required" }).min(1, "Square footage is required"),
  propertyType: z.enum(["residential", "commercial"]),
  listingType: z.enum(["for_sale", "for_rent"]).optional(),
  propertyInfo: z.string().optional(),
  companyNotes: z.string().optional(),
  shootNotes: z.string().optional(),
  photographerNotes: z.string().optional(),
  editorNotes: z.string().optional(),
  selectedPackage: z.string().optional(),
  // Property access fields
  lockboxCode: z.string().optional(),
  lockboxLocation: z.string().optional(),
  accessContactName: z.string().optional(),
  accessContactPhone: z.string().optional(),
});

