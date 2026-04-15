export type CheckoutLaunchMode = 'same-tab' | 'new-tab';

const MOBILE_CHECKOUT_QUERY = '(max-width: 1023px)';

const shouldOpenCheckoutInSameTab = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(MOBILE_CHECKOUT_QUERY).matches;
  }

  return window.innerWidth <= 1023;
};

export const openCheckoutLink = (url: string): CheckoutLaunchMode => {
  if (typeof window === 'undefined') {
    return 'same-tab';
  }

  if (shouldOpenCheckoutInSameTab()) {
    window.location.assign(url);
    return 'same-tab';
  }

  const openedWindow = window.open(url, '_blank');

  if (openedWindow) {
    return 'new-tab';
  }

  window.location.assign(url);
  return 'same-tab';
};

export const getCheckoutLaunchToastCopy = (mode: CheckoutLaunchMode) => {
  if (mode === 'same-tab') {
    return {
      title: 'Redirecting to payment',
      description: 'Opening secure checkout in this tab for a smoother mobile experience.',
    };
  }

  return {
    title: 'Payment window opened',
    description: 'Complete payment in the new tab.',
  };
};
