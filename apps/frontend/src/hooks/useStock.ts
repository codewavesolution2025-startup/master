import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../services/api';

// ── Stock actuel ──────────────────────────────────────────────────────────────
export const useStockActuel = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['stock-actuel', filters],
    queryFn: () => api.get(`/stock/actuel?${params}`).then(r => r.data),
    refetchInterval: 30_000,
  });
};

export const useStockAlertes = () =>
  useQuery({
    queryKey: ['stock-alertes'],
    queryFn: () => api.get('/stock/alertes').then(r => r.data),
    refetchInterval: 60_000,
  });

// ── Lots ──────────────────────────────────────────────────────────────────────
export const useLots = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['lots', filters],
    queryFn: () => api.get(`/lots?${params}`).then(r => r.data),
  });
};

export const useAlertesDluo = () =>
  useQuery({
    queryKey: ['lots-alertes-dluo'],
    queryFn: () => api.get('/lots/alertes-dluo').then(r => r.data),
  });

export const useLotsDisponibles = (articleId: string, siteId: string, mode: 'FIFO' | 'FEFO' = 'FIFO') =>
  useQuery({
    queryKey: ['lots-disponibles', articleId, siteId, mode],
    queryFn: () => api.get(`/lots/disponibles?articleId=${articleId}&siteId=${siteId}&mode=${mode}`).then(r => r.data),
    enabled: !!articleId && !!siteId,
  });

export const useCreateLot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/lots', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lots'] });
      qc.invalidateQueries({ queryKey: ['stock-actuel'] });
    },
  });
};

export const useUpdateStatutLot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut, commentaire }: { id: string; statut: string; commentaire?: string }) =>
      api.put(`/lots/${id}/statut`, { statut, commentaire }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lots'] });
      qc.invalidateQueries({ queryKey: ['stock-actuel'] });
    },
  });
};

// ── Mouvements ────────────────────────────────────────────────────────────────
export const useMouvements = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['mouvements', filters],
    queryFn: () => api.get(`/mouvements?${params}`).then(r => r.data),
  });
};

export const useCreateMouvement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/mouvements', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mouvements'] });
      qc.invalidateQueries({ queryKey: ['stock-actuel'] });
      qc.invalidateQueries({ queryKey: ['lots'] });
    },
  });
};

// ── Inventaires ───────────────────────────────────────────────────────────────
export const useInventaires = () =>
  useQuery({
    queryKey: ['inventaires'],
    queryFn: () => api.get('/inventaires').then(r => r.data),
  });

export const useEcartsInventaire = (id: string) =>
  useQuery({
    queryKey: ['inventaires', id, 'ecarts'],
    queryFn: () => api.get(`/inventaires/${id}/ecarts`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateInventaire = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/inventaires', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventaires'] }),
  });
};

export const useAddLigneInventaire = (inventaireId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/inventaires/${inventaireId}/lignes`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventaires', inventaireId] }),
  });
};

export const useValiderInventaire = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, commentaire }: { id: string; commentaire?: string }) =>
      api.put(`/inventaires/${id}/valider`, { commentaire }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventaires'] });
      qc.invalidateQueries({ queryKey: ['stock-actuel'] });
    },
  });
};
