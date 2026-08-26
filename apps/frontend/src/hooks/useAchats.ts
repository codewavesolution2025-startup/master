import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// ── Demandes Achat ────────────────────────────────────────────────────────────
export const useDemandesAchat = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['demandes-achat', filters],
    queryFn: () => api.get(`/demandes-achat?${params}`).then(r => r.data),
  });
};

export const useCreateDemandeAchat = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/demandes-achat', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demandes-achat'] }),
  });
};

export const useValiderDA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/demandes-achat/${id}/valider`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demandes-achat'] }),
  });
};

export const useRefuserDA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, commentaire }: { id: string; commentaire: string }) =>
      api.put(`/demandes-achat/${id}/refuser`, { commentaire }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demandes-achat'] }),
  });
};

// ── Commandes Achat ───────────────────────────────────────────────────────────
export const useCommandesAchat = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['commandes-achat', filters],
    queryFn: () => api.get(`/commandes-achat?${params}`).then(r => r.data),
  });
};

export const useCommandeAchat = (id: string) =>
  useQuery({
    queryKey: ['commandes-achat', id],
    queryFn: () => api.get(`/commandes-achat/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useLignesCA = (id: string) =>
  useQuery({
    queryKey: ['commandes-achat', id, 'lignes'],
    queryFn: () => api.get(`/commandes-achat/${id}/lignes`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateCA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/commandes-achat', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-achat'] }),
  });
};

export const useAddLigneCA = (caId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/commandes-achat/${caId}/lignes`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-achat', caId] }),
  });
};

export const useValiderCA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/commandes-achat/${id}/valider`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-achat'] }),
  });
};

export const useEnvoyerCA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/commandes-achat/${id}/envoyer`, {}).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-achat'] }),
  });
};

export const useChangerStatutCA = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: string }) =>
      api.put(`/commandes-achat/${id}/statut/${statut}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-achat'] }),
  });
};

// ── Réceptions ────────────────────────────────────────────────────────────────
export const useReceptions = (commandeAchatId?: string) =>
  useQuery({
    queryKey: ['receptions', commandeAchatId],
    queryFn: () => api.get(`/receptions${commandeAchatId ? `?commandeAchatId=${commandeAchatId}` : ''}`).then(r => r.data),
  });

export const useCreateReception = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/receptions', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['receptions'] }),
  });
};

export const useAddLigneReception = (receptionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/receptions/${receptionId}/lignes`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receptions'] });
      qc.invalidateQueries({ queryKey: ['lots'] });
      qc.invalidateQueries({ queryKey: ['stock-actuel'] });
    },
  });
};

// ── MRP ───────────────────────────────────────────────────────────────────────
export const useMrpBesoinsNets = (horizon: number = 30) =>
  useQuery({
    queryKey: ['mrp-besoins-nets', horizon],
    queryFn: () => api.get(`/mrp/besoins-nets?horizon=${horizon}`).then(r => r.data),
  });