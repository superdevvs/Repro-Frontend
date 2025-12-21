import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard as CreditCardIcon } from 'lucide-react';
import { API_BASE_URL, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID } from '@/config/env';
import axios from 'axios';

// Declare Square types for TypeScript
declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => {
        card: () => {
          attach: (element: HTMLElement) => Promise<void>;
          tokenize: (verificationDetails?: any) => Promise<any>;
        };
      };
    };
  }
}

interface SquarePaymentFormProps {
  amount: number;
  currency?: string;
  shootId?: string;
  onPaymentSuccess?: (payment: any) => void;
  onPaymentError?: (error: any) => void;
  disabled?: boolean;
}

export function SquarePaymentForm({
  amount,
  currency = 'USD',
  shootId,
  onPaymentSuccess,
  onPaymentError,
  disabled = false,
}: SquarePaymentFormProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [squareConfig, setSquareConfig] = useState<{ applicationId: string; locationId: string } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const cardElementRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<any>(null);

  // Fetch Square configuration from backend
  useEffect(() => {
    const fetchConfig = async () => {
      // First, check if config is in env vars (and they're not empty)
      if (SQUARE_APPLICATION_ID && SQUARE_APPLICATION_ID.trim() !== '' && 
          SQUARE_LOCATION_ID && SQUARE_LOCATION_ID.trim() !== '') {
        setSquareConfig({
          applicationId: SQUARE_APPLICATION_ID,
          locationId: SQUARE_LOCATION_ID,
        });
        setConfigLoading(false);
        return;
      }

      // If not in env, fetch from backend
      try {
        const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/square/config`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.data.success && response.data.config) {
          const config = response.data.config;
          if (config.application_id && config.location_id) {
            setSquareConfig({
              applicationId: config.application_id,
              locationId: config.location_id,
            });
          } else {
            throw new Error('Square configuration is incomplete');
          }
        } else {
          throw new Error('Failed to fetch Square configuration');
        }
      } catch (error: any) {
        console.error('Error fetching Square config:', error);
        const errorMessage = error.response?.data?.message || 
                           error.message || 
                           'Unable to load Square payment configuration';
        
        // Don't show toast here - let the component show the error message
        // The error state will be handled by the validation checks below
        console.error('Square config fetch failed:', errorMessage);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Load Square Web Payments SDK after config is loaded
  useEffect(() => {
    if (!squareConfig || configLoading) return;

    // Check if SDK is already loaded
    if (window.Square) {
      initializeSquare();
      return;
    }

    // Determine SDK URL based on environment
    const environment = squareConfig.applicationId?.startsWith('sandbox-') ? 'sandbox' : 'production';
    const sdkUrl = environment === 'sandbox' 
      ? 'https://sandbox.web.squarecdn.com/v1/square.js'
      : 'https://web.squarecdn.com/v1/square.js';

    // Load the Square Web Payments SDK script
    const script = document.createElement('script');
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => {
      setIsSDKLoaded(true);
      initializeSquare();
    };
    script.onerror = () => {
      toast({
        title: 'Error',
        description: 'Failed to load Square Payment SDK. Please refresh the page.',
        variant: 'destructive',
      });
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts
      const existingScript = document.querySelector('script[src*="square.js"]');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, [squareConfig, configLoading]);

  // Initialize Square Payments
  const initializeSquare = async () => {
    if (!window.Square || !squareConfig) {
      return;
    }

    try {
      paymentsRef.current = window.Square.payments(
        squareConfig.applicationId,
        squareConfig.locationId
      );
      const cardInstance = await paymentsRef.current.card();
      
      if (cardElementRef.current) {
        await cardInstance.attach(cardElementRef.current);
        setCard(cardInstance);
      }
    } catch (error) {
      console.error('Error initializing Square:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize payment form. Please refresh the page.',
        variant: 'destructive',
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!card || isProcessing || disabled || amount <= 0) {
      return;
    }

    setIsProcessing(true);

    try {
      // Create verification details for 3D Secure
      const verificationDetails = {
        amount: amount.toFixed(2),
        billingContact: {
          givenName: '',
          familyName: '',
          email: '',
          countryCode: 'US',
        },
        currencyCode: currency,
        intent: 'CHARGE',
      };

      // Tokenize the card
      const tokenResult = await card.tokenize(verificationDetails);

      if (tokenResult.status === 'OK') {
        // Send token to backend
        const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        const response = await axios.post(
          `${API_BASE_URL}/api/payments/create`,
          {
            sourceId: tokenResult.token,
            amount: amount,
            currency: currency,
            shoot_id: shootId,
            buyer: tokenResult.details || undefined,
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.status === 'success') {
          toast({
            title: 'Payment Successful',
            description: `Payment of $${amount.toFixed(2)} has been processed successfully.`,
          });

          if (onPaymentSuccess) {
            onPaymentSuccess(response.data);
          }
        } else {
          throw new Error(response.data.message || 'Payment failed');
        }
      } else {
        throw new Error(tokenResult.errors?.[0]?.detail || 'Card tokenization failed');
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.detail ||
        error.errors?.[0]?.detail ||
        error.message ||
        'Payment processing failed. Please try again.';

      toast({
        title: 'Payment Error',
        description: errorMessage,
        variant: 'destructive',
      });

      if (onPaymentError) {
        onPaymentError(error);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading state while fetching config
  if (configLoading) {
    return (
      <div className="p-4 border rounded-md bg-muted/50">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading payment configuration...</p>
        </div>
      </div>
    );
  }

  // Validate configuration
  if (!squareConfig) {
    return (
      <div className="p-4 border border-destructive rounded-md bg-destructive/10 space-y-2">
        <p className="text-sm font-medium text-destructive">
          Square Payment Configuration Error
        </p>
        <p className="text-sm text-destructive">
          Unable to load Square payment configuration. Please ensure Square credentials are configured in the backend.
        </p>
        <div className="text-xs text-muted-foreground mt-2 space-y-1">
          <p>Required backend environment variables:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>SQUARE_ACCESS_TOKEN</li>
            <li>SQUARE_APPLICATION_ID</li>
            <li>SQUARE_LOCATION_ID</li>
          </ul>
          <p className="mt-2">
            Run <code className="bg-muted px-1 py-0.5 rounded">.\setup-square.ps1</code> in the backend directory to configure.
          </p>
        </div>
      </div>
    );
  }

  if (!squareConfig.applicationId) {
    return (
      <div className="p-4 border border-destructive rounded-md bg-destructive/10">
        <p className="text-sm font-medium text-destructive mb-2">
          Square Application ID Missing
        </p>
        <p className="text-sm text-destructive">
          Please set SQUARE_APPLICATION_ID in your backend .env file.
        </p>
      </div>
    );
  }

  if (!squareConfig.locationId) {
    return (
      <div className="p-4 border border-warning rounded-md bg-warning/10 space-y-3">
        <div>
          <p className="text-sm font-medium text-warning-foreground mb-1">
            Square Location ID Missing
          </p>
          <p className="text-sm text-warning-foreground">
            Please set SQUARE_LOCATION_ID in your backend .env file.
          </p>
        </div>
        <div className="text-xs text-muted-foreground space-y-2 bg-muted/50 p-3 rounded border">
          <p className="font-medium">Quick Setup Steps:</p>
          <ol className="list-decimal list-inside ml-2 space-y-1.5">
            <li>Open <code className="bg-background px-1 py-0.5 rounded text-xs">repro-backend/.env</code></li>
            <li>Add: <code className="bg-background px-1 py-0.5 rounded text-xs">SQUARE_ACCESS_TOKEN=EAAAlwwtMDNzksTtV1dpOEQNqECFUwv_7mAGTsK9VpCgqO5WfAgEN0s9zsyFiLfv</code></li>
            <li>Add: <code className="bg-background px-1 py-0.5 rounded text-xs">SQUARE_APPLICATION_ID=sandbox-sq0idb-KBncaaZuhXcaX42j5O7zdg</code></li>
            <li>
              Get Location ID:
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                <li>Run: <code className="bg-background px-1 py-0.5 rounded text-xs">.\setup-square.ps1</code> (option 1, then option 3)</li>
                <li>Or visit: <a href={`${API_BASE_URL}/api/test/square-locations`} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{API_BASE_URL}/api/test/square-locations</a></li>
              </ul>
            </li>
            <li>Add Location ID to .env: <code className="bg-background px-1 py-0.5 rounded text-xs">SQUARE_LOCATION_ID=your_location_id</code></li>
            <li>Run: <code className="bg-background px-1 py-0.5 rounded text-xs">php artisan config:clear</code></li>
            <li>Restart Laravel server and refresh this page</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
            <CreditCardIcon className="h-4 w-4" />
            Card Information
          </label>
          <div
            ref={cardElementRef}
            id="sq-card"
            className="min-h-[50px] border rounded-md p-3 bg-background"
          />
          {!isSDKLoaded && (
            <p className="text-xs text-muted-foreground mt-2">Loading payment form...</p>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">Total Amount</span>
          <span className="text-lg font-bold">${amount.toFixed(2)}</span>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={disabled || isProcessing || amount <= 0 || !card}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Payment...
            </>
          ) : (
            `Pay $${amount.toFixed(2)}`
          )}
        </Button>
      </div>

      {isProcessing && (
        <div className="text-center text-sm text-muted-foreground">
          Please wait while we process your payment...
        </div>
      )}
    </form>
  );
}


