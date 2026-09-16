
export const stepContent = {
  1: {
    title: "Property Details",
    description: "Enter details about the property"
  },
  2: {
    title: "Services & Access",
    description: "Select your package, access details, and notes"
  },
  3: {
    title: "Schedule Your Shoot",
    description: "Choose a date and time that works for you"
  },
  4: {
    title: "Review & Confirm",
    description: "Review all details and confirm your booking"
  }
};

export const packages = [
  { id: '1', name: 'Basic', description: 'Photos only', price: 150 },
  { id: '2', name: 'Standard', description: 'Photos + Floor Plans', price: 250 },
  { id: '3', name: 'Premium', description: 'Photos + Video + Floor Plans', price: 350 },
  { id: '4', name: 'Luxury', description: 'Photos + Video + 3D Tour + Floor Plans', price: 500 },
];

export const photographers = [
  { id: '1', name: 'John Doe', avatar: 'https://ui.shadcn.com/avatars/01.png', rate: 150, availability: true },
  { id: '2', name: 'Jane Smith', avatar: 'https://ui.shadcn.com/avatars/02.png', rate: 175, availability: true },
  { id: '3', name: 'Mike Brown', avatar: 'https://ui.shadcn.com/avatars/03.png', rate: 200, availability: false },
];
