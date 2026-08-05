import React, { useState } from 'react';
import AddressLookup from './AddressLookup';
import { Calendar, Clock, Camera, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { BRAND_PHONE } from '@/config/brand';

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

interface BookShootFormData {
    address: AddressDetails | null;
    serviceType: string;
    scheduledDate: string;
    scheduledTime: string;
    notes: string;
}

const BookShootWithAddressLookup: React.FC = () => {
    const [formData, setFormData] = useState<BookShootFormData>({
        address: null,
        serviceType: '',
        scheduledDate: '',
        scheduledTime: '',
        notes: ''
    });

    const [serviceAreaInfo, setServiceAreaInfo] = useState<any>(null);
    const [isCheckingServiceArea, setIsCheckingServiceArea] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleAddressSelect = async (address: AddressDetails) => {
        setFormData(prev => ({ ...prev, address }));
        setErrors(prev => ({ ...prev, address: '' }));

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

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.address) {
            newErrors.address = 'Property address is required';
        }

        if (!formData.serviceType) {
            newErrors.serviceType = 'Service type is required';
        }

        if (!formData.scheduledDate) {
            newErrors.scheduledDate = 'Scheduled date is required';
        }

        if (!formData.scheduledTime) {
            newErrors.scheduledTime = 'Scheduled time is required';
        }

        if (serviceAreaInfo && !serviceAreaInfo.in_service_area) {
            newErrors.serviceArea = 'This address is outside our service area';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const shootData = {
                address: formData.address?.address,
                city: formData.address?.city,
                state: formData.address?.state,
                zip: formData.address?.zip,
                service_category: formData.serviceType,
                scheduled_date: formData.scheduledDate,
                time: formData.scheduledTime,
                notes: formData.notes,
                // Add other required fields based on your API
                client_id: 1, // This should come from authenticated user
                service_id: 1, // This should be determined by service type
                base_quote: 299, // This should be calculated based on service type
                tax_amount: 23.92,
                total_quote: 322.92,
                payment_status: 'unpaid',
                status: 'booked'
            };

            const response = await fetch('/api/shoots', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(shootData)
            });

            if (response.ok) {
                const result = await response.json();
                alert('Shoot booked successfully!');
                // Reset form or redirect
                setFormData({
                    address: null,
                    serviceType: '',
                    scheduledDate: '',
                    scheduledTime: '',
                    notes: ''
                });
                setServiceAreaInfo(null);
            } else {
                const error = await response.json();
                alert(`Failed to book shoot: ${error.message}`);
            }
        } catch (error) {
            console.error('Booking failed:', error);
            alert('Failed to book shoot. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Camera className="w-6 h-6 mr-2 text-blue-600" />
                        Book a Photo Shoot
                    </h2>
                    <p className="text-gray-600 mt-1">
                        Schedule professional real estate photography
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Address Lookup */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Property Address *
                        </label>
                        <AddressLookup
                            onAddressSelect={handleAddressSelect}
                            placeholder="Start typing the property address..."
                            required
                            className={errors.address ? 'border-red-500' : ''}
                        />
                        {errors.address && (
                            <p className="mt-1 text-sm text-red-600 flex items-center">
                                <AlertCircle className="w-4 h-4 mr-1" />
                                {errors.address}
                            </p>
                        )}
                    </div>

                    {/* Service Area Status */}
                    {isCheckingServiceArea && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center text-blue-800">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                Checking service area...
                            </div>
                        </div>
                    )}

                    {serviceAreaInfo && (
                        <div className={`p-4 rounded-lg border ${serviceAreaInfo.in_service_area
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                            }`}>
                            <div className={`flex items-center ${serviceAreaInfo.in_service_area ? 'text-green-800' : 'text-red-800'
                                }`}>
                                {serviceAreaInfo.in_service_area ? (
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 mr-2" />
                                )}
                                <span className="font-medium">{serviceAreaInfo.message}</span>
                            </div>
                            {!serviceAreaInfo.in_service_area && (
                                <p className="mt-2 text-sm text-red-700">
                                    Please contact us at {BRAND_PHONE} for service in this area.
                                </p>
                            )}
                        </div>
                    )}

                    {errors.serviceArea && (
                        <p className="text-sm text-red-600 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            {errors.serviceArea}
                        </p>
                    )}

                    {/* Service Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Service Type *
                        </label>
                        <select
                            value={formData.serviceType}
                            onChange={(e) => handleInputChange('serviceType', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.serviceType ? 'border-red-500' : 'border-gray-300'
                                }`}
                            required
                        >
                            <option value="">Select a service...</option>
                            <option value="P">Photography Package</option>
                            <option value="iGuide">iGuide Virtual Tour</option>
                            <option value="Video">Video Package</option>
                        </select>
                        {errors.serviceType && (
                            <p className="mt-1 text-sm text-red-600 flex items-center">
                                <AlertCircle className="w-4 h-4 mr-1" />
                                {errors.serviceType}
                            </p>
                        )}
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Preferred Date *
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={formData.scheduledDate}
                                    onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    className={`w-full px-3 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.scheduledDate ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    required
                                />
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                            {errors.scheduledDate && (
                                <p className="mt-1 text-sm text-red-600 flex items-center">
                                    <AlertCircle className="w-4 h-4 mr-1" />
                                    {errors.scheduledDate}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Preferred Time *
                            </label>
                            <div className="relative">
                                <select
                                    value={formData.scheduledTime}
                                    onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                                    className={`w-full px-3 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.scheduledTime ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    required
                                >
                                    <option value="">Select time...</option>
                                    <option value="09:00">9:00 AM</option>
                                    <option value="10:00">10:00 AM</option>
                                    <option value="11:00">11:00 AM</option>
                                    <option value="12:00">12:00 PM</option>
                                    <option value="13:00">1:00 PM</option>
                                    <option value="14:00">2:00 PM</option>
                                    <option value="15:00">3:00 PM</option>
                                    <option value="16:00">4:00 PM</option>
                                </select>
                                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            </div>
                            {errors.scheduledTime && (
                                <p className="mt-1 text-sm text-red-600 flex items-center">
                                    <AlertCircle className="w-4 h-4 mr-1" />
                                    {errors.scheduledTime}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Special Instructions */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Special Instructions
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => handleInputChange('notes', e.target.value)}
                            rows={4}
                            placeholder="Any special requirements, access instructions, or notes for the photographer..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end space-x-4">
                        <button
                            type="button"
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (serviceAreaInfo && !serviceAreaInfo.in_service_area)}
                            className={`px-6 py-2 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isSubmitting || (serviceAreaInfo && !serviceAreaInfo.in_service_area)
                                ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            {isSubmitting ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Booking...
                                </div>
                            ) : (
                                'Book Shoot'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BookShootWithAddressLookup;