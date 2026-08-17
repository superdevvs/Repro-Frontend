export function approvedAddressFromUser(user: Record<string, unknown> | undefined) {
  const zip = user?.zipcode ?? user?.zip;
  return {
    address: typeof user?.address === 'string' ? user.address : '',
    city: typeof user?.city === 'string' ? user.city : '',
    state: typeof user?.state === 'string' ? user.state : '',
    zip: typeof zip === 'string' ? zip : '',
    pending: Boolean(user?.pending_address_change),
  };
}
