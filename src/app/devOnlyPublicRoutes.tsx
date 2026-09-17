import { lazy, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { PageTransition } from '@/components/layout/PageTransition';

const AddressLookupTest = import.meta.env.DEV
  ? lazy(() => import('../pages/AddressLookupTest'))
  : null;
const TestClientPropertyForm = import.meta.env.DEV
  ? lazy(() => import('../pages/TestClientPropertyForm'))
  : null;
const PaymentDemo = import.meta.env.DEV
  ? lazy(() => import('../pages/PaymentDemo'))
  : null;

export const DEV_ONLY_PUBLIC_PATHS = [
  '/test-address-lookup',
  '/test-client-form',
  '/payment-demo',
] as const;

export function renderDevOnlyPublicRoutes(): ReactNode {
  if (!import.meta.env.DEV || !AddressLookupTest || !TestClientPropertyForm || !PaymentDemo) {
    return null;
  }

  return (
    <>
      <Route path="/test-address-lookup" element={
        <PageTransition>
          <AddressLookupTest />
        </PageTransition>
      } />
      <Route path="/test-client-form" element={
        <PageTransition>
          <TestClientPropertyForm />
        </PageTransition>
      } />
      <Route path="/payment-demo" element={
        <PageTransition>
          <PaymentDemo />
        </PageTransition>
      } />
    </>
  );
}
