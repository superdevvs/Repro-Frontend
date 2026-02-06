import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard as CreditCardIcon, MapPin, Package, User, Calendar } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { API_BASE_URL, SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID } from '@/config/env';
import axios from 'axios';

// Declare Square types for TypeScript
declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => {
        card: (options?: any) => {
          attach: (element: HTMLElement) => Promise<void>;
          tokenize: (verificationDetails?: any) => Promise<any>;
          destroy?: () => void;
        };
      };
    };
  }
}

interface SquarePaymentFormProps {
  amount: number;
  paymentAmount?: number;
  currency?: string;
  shootId?: string;
  clientEmail?: string;
  clientName?: string;
  shootAddress?: string;
  shootServices?: string[];
  shootDate?: string;
  shootTime?: string;
  totalQuote?: number;
  totalPaid?: number;
  onPaymentSuccess?: (payment: any) => void;
  onPaymentError?: (error: any) => void;
  disabled?: boolean;
  showShootDetails?: boolean;
  showAmountControls?: boolean;
  showPartialToggle?: boolean;
  onTogglePartial?: () => void;
  isPartialOpen?: boolean;
}

export function SquarePaymentForm({
  amount,
  paymentAmount: paymentAmountOverride,
  currency = 'USD',
  shootId,
  clientEmail,
  clientName,
  shootAddress,
  shootServices = [],
  shootDate,
  shootTime,
  totalQuote,
  totalPaid,
  onPaymentSuccess,
  onPaymentError,
  disabled = false,
  showShootDetails = true,
  showAmountControls = true,
  showPartialToggle = false,
  onTogglePartial,
  isPartialOpen = false,
}: SquarePaymentFormProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [squareConfig, setSquareConfig] = useState<{ applicationId: string; locationId: string } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const cardElementRef = useRef<HTMLDivElement>(null);
  const paymentsRef = useRef<any>(null);
  
  // Form state
  const [email, setEmail] = useState(clientEmail || '');
  const [cardholderName, setCardholderName] = useState(clientName || '');
  
  // Partial payment state
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [paymentAmountInput, setPaymentAmountInput] = useState(amount.toFixed(2));
  const [isPartialPaymentMode, setIsPartialPaymentMode] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const paymentAmountInputRef = useRef<HTMLInputElement>(null);
  const outstandingAmount = amount;
  const effectivePaymentAmount = paymentAmountOverride ?? paymentAmount;

  // Detect dark mode - check class on html element
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize with current state immediately
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };
    
    // Check immediately in case it changed
    checkDarkMode();
    
    // Listen for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Update form fields when client data changes
  useEffect(() => {
    if (clientEmail) setEmail(clientEmail);
    if (clientName) setCardholderName(clientName);
    const nextAmount = paymentAmountOverride ?? amount;
    setPaymentAmount(nextAmount);
    setPaymentAmountInput(nextAmount.toFixed(2));
  }, [clientEmail, clientName, amount, paymentAmountOverride]);
  
  const remainingBalanceAfterPayment = outstandingAmount - effectivePaymentAmount;

  // Fetch Square configuration from backend
  useEffect(() => {
    const fetchConfig = async () => {
      if (SQUARE_APPLICATION_ID && SQUARE_APPLICATION_ID.trim() !== '' && 
          SQUARE_LOCATION_ID && SQUARE_LOCATION_ID.trim() !== '') {
        setSquareConfig({
          applicationId: SQUARE_APPLICATION_ID,
          locationId: SQUARE_LOCATION_ID,
        });
        setConfigLoading(false);
        return;
      }

      try {
        const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }
        const response = await axios.get(`${API_BASE_URL}/api/square/config`, {
          headers,
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
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Load Square Web Payments SDK after config is loaded
  useEffect(() => {
    if (!squareConfig || configLoading) return;

    if (window.Square) {
      setIsSDKLoaded(true);
      return;
    }

    const environment = squareConfig.applicationId?.startsWith('sandbox-') ? 'sandbox' : 'production';
    const sdkUrl = environment === 'sandbox' 
      ? 'https://sandbox.web.squarecdn.com/v1/square.js'
      : 'https://web.squarecdn.com/v1/square.js';

    const existingScript = document.querySelector(`script[src="${sdkUrl}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        setIsSDKLoaded(true);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => {
      setIsSDKLoaded(true);
    };
    script.onerror = () => {
      toast({
        title: 'Error',
        description: 'Failed to load Square Payment SDK. Please refresh the page.',
        variant: 'destructive',
      });
    };
    document.body.appendChild(script);
  }, [squareConfig, configLoading]);

  // Initialize card element after SDK is loaded
  useEffect(() => {
    if (isSDKLoaded && squareConfig && !card) {
      const checkAndInitialize = () => {
        if (cardElementRef.current) {
          cardElementRef.current.innerHTML = '';
          initializeSquare();
        } else {
          setTimeout(checkAndInitialize, 100);
        }
      };
      
      const timer = setTimeout(checkAndInitialize, 100);
      
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isSDKLoaded, squareConfig, card]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (card) {
        try {
          card.destroy?.();
        } catch (e) {
          // Ignore cleanup errors
        }
        setCard(null);
      }
    };
  }, []);

  // Monitor card element for error state
  useEffect(() => {
    if (!cardElementRef.current || !card) return;
    
    const checkForErrors = () => {
      const container = cardElementRef.current;
      if (!container) return;
      
      // Check if Square has added error styling (red border)
      const hasError = container.innerHTML.includes('is-error') || 
                       container.innerHTML.includes('sq-card-message-error') ||
                       container.querySelector('[class*="error"]') !== null;
      
      if (hasError) {
        // Try to determine which field has error
        const html = container.innerHTML.toLowerCase();
        if (html.includes('card number') || html.includes('cardnumber')) {
          setCardError('Please enter a valid card number');
        } else if (html.includes('expir')) {
          setCardError('Please enter a valid expiration date');
        } else if (html.includes('cvv') || html.includes('security')) {
          setCardError('Please enter a valid CVV');
        } else {
          setCardError('Please check your card details');
        }
      } else {
        setCardError(null);
      }
    };
    
    const observer = new MutationObserver(checkForErrors);
    observer.observe(cardElementRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    
    return () => observer.disconnect();
  }, [card]);

  // Initialize Square Payments with theme-aware styling
  const initializeSquare = async () => {
    if (!window.Square || !squareConfig || !cardElementRef.current) {
      return;
    }

    if (cardElementRef.current) {
      cardElementRef.current.innerHTML = '';
    }

    try {
      paymentsRef.current = window.Square.payments(
        squareConfig.applicationId,
        squareConfig.locationId
      );
      
      // Create card without custom styling first (Square SDK handles its own styling)
      const cardInstance = await paymentsRef.current.card();
      
      if (cardElementRef.current) {
        await cardInstance.attach(cardElementRef.current);
        setCard(cardInstance);
        
      }
    } catch (error) {
      console.error('Error initializing Square card element:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize payment form. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

      if (effectivePaymentAmount <= 0 || effectivePaymentAmount > outstandingAmount) {
        toast({
          title: 'Invalid Payment Amount',
          description: `Payment amount must be between $0.01 and $${outstandingAmount.toFixed(2)}`,
          variant: 'destructive',
        });
        return;
      }
    
    if (isProcessing || disabled) {
      return;
    }

    setShowConfirmationDialog(true);
  };

  // Process payment after confirmation
  const handleConfirmPayment = async () => {
    setShowConfirmationDialog(false);
    setIsProcessing(true);

    try {
      const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');

      if (!card) {
        toast({
          title: 'Payment Form Not Ready',
          description: 'Please wait for the payment form to load completely before submitting.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      if (!cardholderName || !cardholderName.trim()) {
        toast({
          title: 'Cardholder Name Required',
          description: 'Please enter the cardholder name.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      // Parse cardholder name
      const nameParts = cardholderName.trim().split(' ');
      const givenName = nameParts[0] || cardholderName;
      const familyName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : cardholderName;
      
      // Build billing contact
      const billingContact: any = {
        givenName: givenName.trim(),
        familyName: familyName.trim(),
      };
      if (email && email.trim()) {
        billingContact.email = email.trim();
      }
      
      const verificationDetails: any = {
        amount: effectivePaymentAmount.toFixed(2),
        currencyCode: currency,
        intent: 'CHARGE',
        customerInitiated: true,
        sellerKeyedIn: false,
      };
      
      verificationDetails.billingContact = billingContact;

      let tokenResult;
      try {
        tokenResult = await card.tokenize(verificationDetails);
      } catch (tokenizeError: any) {
        console.error('Tokenization error:', tokenizeError);
        throw new Error(tokenizeError.message || 'Card tokenization failed. Please check your card details.');
      }

      if (tokenResult.status === 'OK') {
        const response = await axios.post(
          `${API_BASE_URL}/api/payments/create`,
          {
            sourceId: tokenResult.token,
            amount: effectivePaymentAmount,
            currency: currency,
            shoot_id: shootId,
            payment_method: 'card',
            buyer: tokenResult.details || undefined,
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data && (response.data.status === 'success' || response.data.payment)) {
          toast({
            title: 'Payment Successful',
            description: `Payment of $${effectivePaymentAmount.toFixed(2)} has been processed.${remainingBalanceAfterPayment > 0 ? ` Remaining: $${remainingBalanceAfterPayment.toFixed(2)}` : ''}`,
          });

          if (onPaymentSuccess) {
            onPaymentSuccess(response.data);
          }
        } else {
          throw new Error(response.data?.message || 'Payment failed');
        }
      } else {
        const errors = tokenResult.errors || [];
        const firstError = errors[0] || {};
        let userMessage = firstError.detail || firstError.message || 'Card tokenization failed';
        
        if (firstError.type === 'VALIDATION_ERROR') {
          if (firstError.field === 'cardNumber') {
            userMessage = 'Please enter a valid credit card number.';
          } else if (firstError.field?.includes('expiration')) {
            userMessage = 'Please enter a valid expiration date.';
          } else if (firstError.field?.includes('cvv')) {
            userMessage = 'Please enter a valid CVV.';
          }
        }
        
        throw new Error(userMessage);
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
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

  // Loading state
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

  // Config validation
  if (!squareConfig || !squareConfig.applicationId || !squareConfig.locationId) {
    return (
      <div className="p-4 border border-destructive rounded-md bg-destructive/10">
        <p className="text-sm font-medium text-destructive mb-2">Square Configuration Error</p>
        <p className="text-sm text-destructive">
          Unable to load payment configuration. Please contact support.
        </p>
      </div>
    );
  }

  const hasShootDetails = showShootDetails
    && (shootAddress
      || (shootServices && shootServices.length > 0)
      || totalQuote !== undefined
      || clientName
      || shootDate);

  return (
    <div className={`grid gap-4 ${hasShootDetails ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
      {/* Left Column - Shoot Details */}
      {hasShootDetails && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Shoot Details</h3>
          <div className="space-y-2">
            {/* Location */}
            {shootAddress && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">{shootAddress}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Client Info */}
            {(clientName || clientEmail) && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Client</p>
                    {clientName && <p className="text-sm font-medium">{clientName}</p>}
                    {clientEmail && <p className="text-xs text-muted-foreground">{clientEmail}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Date & Time */}
            {(shootDate || shootTime) && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                    <p className="text-sm font-medium">
                      {(() => {
                        // Format the date nicely
                        let formattedDate = shootDate;
                        if (shootDate) {
                          try {
                            const parsed = typeof shootDate === 'string' && shootDate.includes('T') 
                              ? parseISO(shootDate) 
                              : new Date(shootDate);
                            if (isValid(parsed)) {
                              formattedDate = format(parsed, 'MMMM d, yyyy');
                            }
                          } catch (e) {
                            // Keep original if parsing fails
                          }
                        }
                        return formattedDate;
                      })()}
                      {shootTime && ` at ${shootTime}`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Services */}
            {shootServices && shootServices.length > 0 && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Services ({shootServices.length})</p>
                    <div className="text-sm font-medium">
                      {shootServices.map((service, idx) => (
                        <div key={idx} className="text-sm">• {service}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Summary */}
            {(totalQuote !== undefined || totalPaid !== undefined) && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Payment Summary</p>
                <div className="space-y-1 text-sm">
                  {totalQuote !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Quote</span>
                      <span className="font-semibold">${totalQuote.toFixed(2)}</span>
                    </div>
                  )}
                  {totalPaid !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Paid</span>
                      <span className="font-semibold text-green-600">${totalPaid.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="font-bold text-orange-600">${outstandingAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right Column - Payment Form (Compact) */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Payment Details</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Payment Amount - Compact */}
          {showAmountControls && (
            <div className="p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="paymentAmount" className="text-xs text-muted-foreground">Amount</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">$</span>
                    <Input
                      ref={paymentAmountInputRef}
                      id="paymentAmount"
                      type="text"
                      inputMode="decimal"
                      value={paymentAmountInput}
                      onChange={(e) => {
                        let inputValue = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = inputValue.split('.');
                        if (parts.length > 2) inputValue = parts[0] + '.' + parts.slice(1).join('');
                        if (parts.length === 2 && parts[1].length > 2) inputValue = parts[0] + '.' + parts[1].substring(0, 2);
                        setPaymentAmountInput(inputValue);
                        setIsPartialPaymentMode(true);
                        const numericValue = parseFloat(inputValue);
                        if (!isNaN(numericValue) && numericValue > 0) {
                          setPaymentAmount(Math.min(numericValue, outstandingAmount));
                        } else {
                          setPaymentAmount(0);
                        }
                      }}
                      onBlur={(e) => {
                        const numericValue = parseFloat(e.target.value);
                        if (isNaN(numericValue) || numericValue < 0.01) {
                          setPaymentAmountInput(outstandingAmount.toFixed(2));
                          setPaymentAmount(outstandingAmount);
                        } else if (numericValue > outstandingAmount) {
                          setPaymentAmountInput(outstandingAmount.toFixed(2));
                          setPaymentAmount(outstandingAmount);
                        } else {
                          setPaymentAmountInput(numericValue.toFixed(2));
                          setPaymentAmount(numericValue);
                        }
                        setIsPartialPaymentMode(false);
                      }}
                      className="text-lg font-bold h-9 w-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={!isPartialPaymentMode ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setPaymentAmount(outstandingAmount);
                      setPaymentAmountInput(outstandingAmount.toFixed(2));
                      setIsPartialPaymentMode(false);
                    }}
                  >
                    Full
                  </Button>
                  <Button
                    type="button"
                    variant={isPartialPaymentMode ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setIsPartialPaymentMode(true);
                      const half = Math.ceil(outstandingAmount * 0.5 * 100) / 100;
                      setPaymentAmount(half);
                      setPaymentAmountInput(half.toFixed(2));
                      paymentAmountInputRef.current?.focus();
                    }}
                  >
                    Partial
                  </Button>
                </div>
              </div>
              {remainingBalanceAfterPayment > 0 && effectivePaymentAmount > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Remaining after payment: <span className="text-orange-600 font-medium">${remainingBalanceAfterPayment.toFixed(2)}</span>
                </p>
              )}
            </div>
          )}
          
          {/* Email & Cardholder - Compact Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-9 text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="cardholderName" className="text-xs">Cardholder Name</Label>
              <Input
                id="cardholderName"
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="John Doe"
                className="h-9 text-sm"
                required
              />
            </div>
          </div>

          {/* Square Card Element */}
          <div className="relative">
            <Label className="text-xs flex items-center gap-1 mb-1">
              <CreditCardIcon className="h-3 w-3" />
              Card Details
            </Label>
            <div className="relative">
              {/* Skeleton loader overlay while SDK loads */}
              {!card && (
                <div 
                  className="absolute inset-0 rounded-md border overflow-hidden p-3 space-y-3 z-10"
                  style={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
                    borderColor: isDarkMode ? '#374151' : '#d1d5db',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-12 rounded" />
                    <Skeleton className="h-4 flex-1 rounded" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                  </div>
                </div>
              )}
              {/* Actual Square card element */}
              <div
                className="rounded-md border overflow-hidden"
                style={{
                  height: '90px',
                  backgroundColor: isDarkMode ? '#0a0a0a' : '#ffffff',
                  borderColor: isDarkMode ? '#374151' : '#d1d5db',
                }}
              >
                <div
                  ref={cardElementRef}
                  id="sq-card"
                  style={{
                    filter: isDarkMode ? 'invert(1) hue-rotate(180deg)' : 'none',
                  }}
                />
              </div>
            </div>
            {cardError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {cardError}
                </p>
              </div>
            )}
          </div>

          {showPartialToggle && onTogglePartial && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onTogglePartial}
            >
              {isPartialOpen ? 'Pay Full Amount' : 'Pay Partial'}
            </Button>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={disabled || isProcessing || effectivePaymentAmount <= 0 || !email || !cardholderName || !card || !isSDKLoaded}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay $${effectivePaymentAmount.toFixed(2)}`
            )}
          </Button>
        </form>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>Review before processing</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount:</span>
              <span className="text-xl font-bold">${effectivePaymentAmount.toFixed(2)}</span>
            </div>
            <Separator />
            {remainingBalanceAfterPayment > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="text-orange-600 font-medium">${remainingBalanceAfterPayment.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="text-green-600 font-medium">Full Payment</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmationDialog(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
