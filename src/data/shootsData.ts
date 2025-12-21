import { ShootData } from "@/types/shoots";

/**
 * This static array used to carry demo shoots that were no longer displayed.
 * We intentionally keep it empty so the dashboard relies solely on live data.
 */
export const shootsData: ShootData[] = [];

export const getShootById = (id: string): ShootData | undefined => {
  return shootsData.find(shoot => shoot.id === id);
};

export const getShootsByStatus = (status: ShootData['status']): ShootData[] => {
  return shootsData.filter(shoot => shoot.status === status);
};

export const getShootsByPhotographer = (photographerName: string): ShootData[] => {
  return shootsData.filter(shoot => shoot.photographer.name === photographerName);
};

export const getShootsByClient = (clientName: string): ShootData[] => {
  return shootsData.filter(shoot => shoot.client.name === clientName);
};

export const getShootsByDateRange = (startDate: Date, endDate: Date): ShootData[] => {
  return shootsData.filter(shoot => {
    const shootDate = new Date(shoot.scheduledDate);
    return shootDate >= startDate && shootDate <= endDate;
  });
};

export const getTotalRevenue = (): number => {
  return shootsData.reduce((total, shoot) => total + (shoot.payment.totalPaid || 0), 0);
};

export const getTotalShoots = (): number => {
  return shootsData.length;
};

export const getUniquePaidClients = (): number => {
  const paidClients = new Set(
    shootsData
      .filter(shoot => shoot.payment.totalPaid && shoot.payment.totalPaid > 0)
      .map(shoot => shoot.client.name)
  );
  return paidClients.size;
};

export const getUniquePhotographers = (): string[] => {
  const photographers = new Set(shootsData.map(shoot => shoot.photographer.name));
  return Array.from(photographers);
};

export const getUniqueClients = (): string[] => {
  const clients = new Set(shootsData.map(shoot => shoot.client.name));
  return Array.from(clients);
};
