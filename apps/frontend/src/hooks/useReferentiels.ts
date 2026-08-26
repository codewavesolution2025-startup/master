import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../services/api';

// ── Articles ──────────────────────────────────────────────────────────────────
export const useArticles = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)));

  return useQuery({
    queryKey: ['articles', filters],
    queryFn: () => api.get(`/articles?${params}`).then(r => r.data),
  });
};

export const useArticle = (id: string) =>
  useQuery({
    queryKey: ['articles', id],
    queryFn: () => api.get(`/articles/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useFamillesArticles = () =>
  useQuery({
    queryKey: ['familles-articles'],
    queryFn: () => api.get('/familles-articles').then(r => r.data),
  });

export const useCreateArticle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/articles', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
};

export const useUpdateArticle = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(`/articles/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
};

export const useDesactiverArticle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/articles/${id}/desactiver`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
};

// ── Fournisseurs ──────────────────────────────────────────────────────────────
export const useFournisseurs = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)));
  return useQuery({
    queryKey: ['fournisseurs', filters],
    queryFn: () => api.get(`/fournisseurs?${params}`).then(r => r.data),
  });
};

export const useFournisseur = (id: string) =>
  useQuery({
    queryKey: ['fournisseurs', id],
    queryFn: () => api.get(`/fournisseurs/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useScoreFournisseur = (id: string) =>
  useQuery({
    queryKey: ['fournisseurs', id, 'score'],
    queryFn: () => api.get(`/fournisseurs/${id}/score`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateFournisseur = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/fournisseurs', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fournisseurs'] }),
  });
};

export const useUpdateFournisseur = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(`/fournisseurs/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fournisseurs'] }),
  });
};

// ── Sites ─────────────────────────────────────────────────────────────────────
export const useSites = () =>
  useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  });

export const useSite = (id: string) =>
  useQuery({
    queryKey: ['sites', id],
    queryFn: () => api.get(`/sites/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateSite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/sites', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });
};

export const useCreateEmplacement = (siteId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/sites/${siteId}/emplacements`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });
};

// ── Clients ───────────────────────────────────────────────────────────────────
export const useClients = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== '' && params.set(k, String(v)));
  return useQuery({
    queryKey: ['clients', filters],
    queryFn: () => api.get(`/clients?${params}`).then(r => r.data),
  });
};

export const useCreateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/clients', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
};

export const useUpdateClient = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.put(`/clients/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
};

// ── Postes de charge ──────────────────────────────────────────────────────────
export const usePostesCharge = (siteId?: string) =>
  useQuery({
    queryKey: ['postes-charge', siteId],
    queryFn: () => api.get(`/postes-charge${siteId ? `?siteId=${siteId}` : ''}`).then(r => r.data),
  });

export const useCreatePosteCharge = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/postes-charge', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['postes-charge'] }),
  });
};

// ── Hook générique pagination ─────────────────────────────────────────────────
export const usePagination = (initial = 1) => {
  const [page, setPage] = useState(initial);
  return { page, setPage, reset: () => setPage(1) };
};
