import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SquarePaymentForm } from '@/components/payments/SquarePaymentForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, MapPin, Calendar, Camera } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

interface ShootDetails {
  id: number;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  scheduled_date?: string;
  time?: string;
  total_quote: number;
  base_quote: number;
  tax_amount: number;
  services: Array<{ name: string; pivot?: { price: number; quantity: number } }>;
  client?: { name: string; email: string };
  payments?: Array<{ amount: number; status: string }>;
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [shoot, setShoot] = useState<ShootDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const fetchShootDetails = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/shoots/${id}/payment-details`);
        setShoot(response.data.data || response.data);
      } catch (err: any) {
        console.error('Failed to fetch shoot details:', err);
        setError(err.response?.data?.message || 'Failed to load shoot details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchShootDetails();
    }
  }, [id]);

  const totalPaid = shoot?.payments
    ?.filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const amountDue = (shoot?.total_quote || 0) - totalPaid;

  const fullAddress = shoot
    ? [shoot.address, shoot.city, shoot.state, shoot.zip].filter(Boolean).join(', ')
    : '';

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030619] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#030619] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#0a0f1a] border-red-500/30">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Payment</h2>
            <p className="text-gray-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-[#030619] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#0a0f1a] border-green-500/30">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-400 mb-4">
              Your payment of ${amountDue.toFixed(2)} has been processed successfully.
            </p>
            <p className="text-sm text-gray-500">
              You will receive a confirmation email shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (amountDue <= 0) {
    return (
      <div className="min-h-screen bg-[#030619] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#0a0f1a] border-green-500/30">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">Already Paid</h2>
            <p className="text-gray-400">
              This shoot has already been paid in full. Thank you!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030619] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Payment</h1>
          <p className="text-gray-400">Secure payment powered by Square</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Shoot Details */}
          <Card className="bg-[#0a0f1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Shoot Details</CardTitle>
              <CardDescription>Review your booking information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fullAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Location</p>
                    <p className="text-white">{fullAddress}</p>
                  </div>
                </div>
              )}

              {shoot?.scheduled_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Scheduled Date</p>
                    <p className="text-white">
                      {new Date(shoot.scheduled_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {shoot.time && ` at ${shoot.time}`}
                    </p>
                  </div>
                </div>
              )}

              {shoot?.services && shoot.services.length > 0 && (
                <div className="flex items-start gap-3">
                  <Camera className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Services</p>
                    <ul className="text-white">
                      {shoot.services.map((service, idx) => (
                        <li key={idx}>{service.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-800 pt-4 mt-4">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span>${(shoot?.base_quote || 0).toFixed(2)}</span>
                </div>
                {(shoot?.tax_amount || 0) > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Tax</span>
                    <span>${(shoot?.tax_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Total</span>
                  <span>${(shoot?.total_quote || 0).toFixed(2)}</span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Paid</span>
                    <span>-${totalPaid.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-white mt-2 pt-2 border-t border-gray-800">
                  <span>Amount Due</span>
                  <span>${amountDue.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card className="bg-[#0a0f1a] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Payment Information</CardTitle>
              <CardDescription>Enter your card details below</CardDescription>
            </CardHeader>
            <CardContent>
              <SquarePaymentForm
                amount={amountDue}
                currency="USD"
                shootId={id}
                clientEmail={shoot?.client?.email}
                clientName={shoot?.client?.name}
                shootAddress={fullAddress}
                shootServices={shoot?.services?.map((s) => s.name)}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={(err) => console.error('Payment error:', err)}
              />
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Your payment is secured with industry-standard encryption.
        </p>
      </div>
    </div>
  );
}
