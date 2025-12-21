
import { useState, useEffect } from 'react';
import { Client } from '@/types/clients';
import { initialClientsData } from '@/data/clientsData';
import { useShoots } from '@/context/ShootsContext';
import API_ROUTES from '@/lib/api';
import { API_BASE_URL } from '@/config/env';

export const useClientsData = () => {
  const { shoots } = useShoots();
  
  const [clientsData, setClientsData] = useState<Client[]>(() => {
    const storedClients = localStorage.getItem('clientsData');
    return storedClients ? JSON.parse(storedClients) : initialClientsData;
  });

  // Load clients from backend (admin list) on mount
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;
        // Fetch clients list
        const res = await fetch(API_ROUTES.clients.adminList, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : (json.users || []);

        // Fetch shoots to compute per-client counts and last activity
        let counts: Record<string, number> = {};
        let last: Record<string, string> = {};
        try {
          const shootsRes = await fetch(`${API_BASE_URL}/api/shoots`, {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (shootsRes.ok) {
            const shootsJson = await shootsRes.json();
            const shootsArr = Array.isArray(shootsJson.data) ? shootsJson.data : [];
            for (const s of shootsArr) {
              const cid = String(s.client?.id ?? s.client_id ?? '');
              if (!cid) continue;
              counts[cid] = (counts[cid] || 0) + 1;
              const d = s.scheduled_date || s.scheduledDate || s.created_at || s.updated_at || '';
              if (d) {
                const prev = last[cid];
                if (!prev || new Date(d) > new Date(prev)) {
                  last[cid] = d;
                }
              }
            }
          }
        } catch (_) {}

        const mapped: Client[] = list.map((u: any) => {
          const id = String(u.id);
          return {
            id,
            name: u.name,
            company: u.company_name || '',
            email: u.email,
            phone: u.phonenumber || u.phone || '',
            address: '',
            status: 'active',
            shootsCount: counts[id] || 0,
            lastActivity: (last[id] ? new Date(last[id]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            avatar: u.avatar || undefined,
          };
        });
        setClientsData(mapped);
      } catch (_) {}
    };
    load();
  }, []);
  
  const totalClients = clientsData.length;
  const activeClients = clientsData.filter(client => client.status === 'active').length;
  // Sum the shootsCount across the visible clients list so it reflects
  // shoots associated with the clients we are showing
  const totalShoots = clientsData.reduce((sum, c) => sum + (c.shootsCount || 0), 0);
  const averageShootsPerClient = totalClients > 0
    ? Math.round((totalShoots / totalClients) * 10) / 10
    : 0;
  
  // Update shoots count for each client
  useEffect(() => {
    if (shoots.length > 0) {
      const clientShootCounts = new Map<string, { count: number, lastDate: string }>();
      
      shoots.forEach(shoot => {
        const clientName = shoot.client.name;
        if (!clientShootCounts.has(clientName)) {
          clientShootCounts.set(clientName, { count: 1, lastDate: shoot.scheduledDate });
        } else {
          const current = clientShootCounts.get(clientName)!;
          current.count++;
          const currentDate = new Date(current.lastDate);
          const shootDate = new Date(shoot.scheduledDate);
          if (shootDate > currentDate) {
            current.lastDate = shoot.scheduledDate;
          }
          clientShootCounts.set(clientName, current);
        }
      });
      
      const updatedClients = clientsData.map(client => {
        const shootData = clientShootCounts.get(client.name);
        if (shootData) {
          return {
            ...client,
            shootsCount: shootData.count,
            lastActivity: shootData.lastDate
          };
        }
        return client;
      });
      
      const existingClientNames = new Set(clientsData.map(c => c.name));
      clientShootCounts.forEach((data, clientName) => {
        if (!existingClientNames.has(clientName)) {
          const clientShoot = shoots.find(s => s.client.name === clientName);
          if (clientShoot) {
            const newClient: Client = {
              id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: clientName,
              company: clientShoot.client.company || '',
              email: clientShoot.client.email || '',
              phone: clientShoot.client.phone || '',
              address: '',
              status: 'active',
              shootsCount: data.count,
              lastActivity: data.lastDate
            };
            updatedClients.push(newClient);
          }
        }
      });
      
      setClientsData(updatedClients);
    }
  }, [shoots]);
  
  // Persist clients data to localStorage
  useEffect(() => {
    localStorage.setItem('clientsData', JSON.stringify(clientsData));
  }, [clientsData]);

  return {
    clientsData,
    setClientsData,
    totalClients,
    activeClients,
    totalShoots,
    averageShootsPerClient
  };
};
