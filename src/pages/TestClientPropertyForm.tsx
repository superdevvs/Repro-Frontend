import React from 'react';
import { ClientPropertyForm } from '../components/booking/ClientPropertyForm';

const TestClientPropertyForm: React.FC = () => {
  const mockPackages = [
    {
      id: '1',
      name: 'Basic',
      description: 'Essential photography package with 15-20 high-quality photos',
      price: 199
    },
    {
      id: '2',
      name: 'Standard',
      description: 'Popular package with 25-30 photos plus virtual staging',
      price: 299
    },
    {
      id: '3',
      name: 'Premium',
      description: 'Complete package with 35+ photos, virtual staging, and floor plan',
      price: 399
    }
  ];

  const mockClients = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      phone: '(555) 123-4567',
      company: 'ABC Realty',
      status: 'active' as const,
      shootsCount: 12,
      lastActivity: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '(555) 987-6543',
      company: 'XYZ Properties',
      status: 'active' as const,
      shootsCount: 8,
      lastActivity: new Date().toISOString(),
    }
  ];

  const initialData = {
    clientId: '',
    clientName: 'Test Client',
    clientEmail: 'test@example.com',
    clientPhone: '(555) 123-4567',
    clientCompany: 'Test Company',
    propertyType: 'residential' as const,
    propertyAddress: '',
    propertyCity: '',
    propertyState: '',
    propertyZip: '',
    bedRooms: 0,
    bathRooms: 0,
    sqft: 0,
    propertyInfo: '',
    companyNotes: '',
    shootNotes: '',
    selectedPackage: ''
  };

  const [selectedServices, setSelectedServices] = React.useState<typeof mockPackages>([]);

  const handleComplete = (data: unknown) => {
    console.log('Form completed with data:', data);
    alert('Form submitted! Check console for data.');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Client Property Form Test
            </h1>
            <p className="text-gray-600">
              Test the address lookup functionality in the booking form
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <ClientPropertyForm
              onComplete={handleComplete}
              initialData={initialData}
              isClientAccount={false}
              packages={mockPackages}
              clients={mockClients}
              selectedServices={selectedServices}
              onSelectedServicesChange={setSelectedServices}
            />
          </div>
          
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Testing Instructions</h2>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-start">
                  <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs font-medium mr-3 mt-0.5">1</span>
                  <p>Start typing in the Address field (try "123 Main" or "456 Oak")</p>
                </div>
                <div className="flex items-start">
                  <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs font-medium mr-3 mt-0.5">2</span>
                  <p>Select an address from the dropdown suggestions</p>
                </div>
                <div className="flex items-start">
                  <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs font-medium mr-3 mt-0.5">3</span>
                  <p>Watch as City, State, and ZIP Code fields are automatically filled</p>
                </div>
                <div className="flex items-start">
                  <span className="bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs font-medium mr-3 mt-0.5">4</span>
                  <p>Complete the rest of the form and submit to see the data</p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> Currently using mock data for testing. The address lookup will work with real Google Places API when configured.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestClientPropertyForm;
