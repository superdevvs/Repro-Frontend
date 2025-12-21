// src/api/api.ts

import { API_BASE_URL } from '@/config/env';

const BASE_URL = API_BASE_URL;

export const API_ROUTES = {
  services: {
    all: `${BASE_URL}/api/services`,
    create: `${BASE_URL}/api/admin/services`,
    show: (id: number | string) => `${BASE_URL}/api/services/${id}`,
    update: (id: number | string) => `${BASE_URL}/api/admin/services/${id}`,
    delete: (id: number | string) => `${BASE_URL}/api/admin/services/${id}`,
  },
  clients: {
    adminList: `${BASE_URL}/api/admin/clients`,
    create: `${BASE_URL}/api/admin/users`, // create user with role=client
  },
  people: {
    photographers: `${BASE_URL}/api/photographers`,
    adminPhotographers: `${BASE_URL}/api/admin/photographers`,
  },
  photographerAvailability: {
    list: (photographerId: number | string) => `${BASE_URL}/api/photographer/availability/${photographerId}`,
    create: `${BASE_URL}/api/photographer/availability`,
    bulk: `${BASE_URL}/api/photographer/availability/bulk`,
    bulkIndex: `${BASE_URL}/api/photographer/availability/bulk-index`,
    bookedSlots: `${BASE_URL}/api/photographer/availability/booked-slots`,
    update: (id: number | string) => `${BASE_URL}/api/photographer/availability/${id}`,
    delete: (id: number | string) => `${BASE_URL}/api/photographer/availability/${id}`,
    clear: (photographerId: number | string) => `${BASE_URL}/api/photographer/availability/clear/${photographerId}`,
    check: `${BASE_URL}/api/photographer/availability/check`,
    availablePhotographers: `${BASE_URL}/api/photographer/availability/available-photographers`,
    forBooking: `${BASE_URL}/api/photographer/availability/for-booking`,
  },
  cubicasa: {
    createOrder: `${BASE_URL}/api/cubicasa/orders`,
    listOrders: `${BASE_URL}/api/cubicasa/orders`,
    getOrder: (id: number | string) => `${BASE_URL}/api/cubicasa/orders/${id}`,
    uploadPhotos: (id: number | string) => `${BASE_URL}/api/cubicasa/orders/${id}/photos`,
    getOrderStatus: (id: number | string) => `${BASE_URL}/api/cubicasa/orders/${id}/status`,
    linkToShoot: (id: number | string) => `${BASE_URL}/api/cubicasa/orders/${id}/link-shoot`,
  },
  integrations: {
    property: {
      lookup: `${BASE_URL}/api/integrations/property/lookup`,
      refresh: (shootId: number | string) => `${BASE_URL}/api/integrations/shoots/${shootId}/property/refresh`,
    },
    iguide: {
      sync: (shootId: number | string) => `${BASE_URL}/api/integrations/shoots/${shootId}/iguide/sync`,
    },
    brightMls: {
      publish: (shootId: number | string) => `${BASE_URL}/api/integrations/shoots/${shootId}/bright-mls/publish`,
      queue: `${BASE_URL}/api/integrations/mls-queue`,
    },
    testConnection: `${BASE_URL}/api/integrations/test-connection`,
  },
  categories: {
    all: `${BASE_URL}/api/categories`,
    create: `${BASE_URL}/api/categories`,
    update: (id: number | string) => `${BASE_URL}/api/categories/${id}`,
    delete: (id: number | string) => `${BASE_URL}/api/categories/${id}`,
  },
  admin: {
    settings: {
      get: (key: string) => `${BASE_URL}/api/admin/settings/${key}`,
      store: `${BASE_URL}/api/admin/settings`,
    },
  },
  
  // Add more groups as needed, for example:
  // users: {
  //   login: `${BASE_URL}/login`,
  //   profile: `${BASE_URL}/profile`,
  // }

};

export default API_ROUTES;
