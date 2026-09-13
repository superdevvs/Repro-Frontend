import { InlineSpinner } from '@/components/ui/inline-spinner';
import React, { useState } from 'react';
import AddressLookup from './AddressLookup';
import { MapPin, Clock, DollarSign, CheckCircle } from 'lucide-react';

interface AddressDetails {
  formatted_address: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

const AddressLookupDemo: React.FC = () => {
  const [selectedAddress, setSelectedAddress] = useState<AddressDetails | null>(null);
  const [serviceAreaInfo, setServiceAreaInfo] = useState<any>(null);
  const [isCheckingServiceArea, setIsCheckingServiceArea] = useState(false);

  const handleAddressSelect = async (address: AddressDetails) => {
    setSelectedAddress(address);
    
    // Check service area
    setIsCheckingServiceArea(true);
    try {
      const response = await fetch(
        `/api/address/service-area?address=${encodeURIComponent(address.address)}&city=${encodeURIComponent(address.city)}&state=${encodeURIComponent(address.state)}&zip=${encodeURIComponent(address.zip)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setServiceAreaInfo(data.data);
      }
    } catch (error) {
      console.error('Failed to check service area:', error);
    } finally {
      setIsCheckingServiceArea(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Address Lookup Demo
        </h2>
        <p className="text-gray-600">
          Try searching for an address to see the autocomplete functionality
        </p>
      </div>

      {/* Address Lookup Component */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Property Address *
        </label>
        <AddressLookup
          onAddressSelect={handleAddressSelect}
          placeholder="Start typing an address..."
          required
        />
      </div>

      {/* Selected Address Display */}
      {selectedAddress && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-blue-500" />
            Selected Address
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Street Address</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAddress.address}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAddress.city}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">State</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAddress.state}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">ZIP Code</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAddress.zip}</p>
            </div>
            
            {selectedAddress.latitude && selectedAddress.longitude && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Coordinates</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedAddress.latitude.toFixed(6)}, {selectedAddress.longitude.toFixed(6)}
                </p>
              </div>
            )}
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Full Address</label>
              <p className="mt-1 text-sm text-gray-900">{selectedAddress.formatted_address}</p>
            </div>
          </div>
        </div>
      )}

      {/* Service Area Information */}
      {serviceAreaInfo && (
        <div className={`p-6 rounded-lg border ${
          serviceAreaInfo.in_service_area 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            {serviceAreaInfo.in_service_area ? (
              <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            ) : (
              <Clock className="w-5 h-5 mr-2 text-yellow-500" />
            )}
            Service Area Status
          </h3>
          
          <div className={`text-sm ${
            serviceAreaInfo.in_service_area ? 'text-green-800' : 'text-yellow-800'
          }`}>
            <p className="font-medium mb-2">{serviceAreaInfo.message}</p>
            
            {serviceAreaInfo.in_service_area ? (
              <div className="space-y-2">
                <p>✅ We provide photography services in {serviceAreaInfo.state}</p>
                <p>✅ You can book a shoot for this location</p>
                <p>✅ Estimated response time: 24-48 hours</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p>⚠️ This location is outside our current service area</p>
                <p>📧 Contact us for special arrangements</p>
                <p>🗺️ Current service areas: {serviceAreaInfo.service_areas.join(', ')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isCheckingServiceArea && (
        <div className="text-center py-4">
          <div className="inline-flex items-center text-gray-600">
            <InlineSpinner className="h-4 w-4 mr-2" />
            Checking service area...
          </div>
        </div>
      )}

      {/* Mock Booking Form */}
      {selectedAddress && serviceAreaInfo?.in_service_area && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-500" />
            Ready to Book
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option>Photography Package</option>
                  <option>iGuide Virtual Tour</option>
                  <option>Video Package</option>
                  <option>Photography + Video</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Any special requirements or notes for the photographer..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium">
              Continue to Booking Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressLookupDemo;