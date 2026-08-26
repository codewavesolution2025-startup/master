import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// ── Plans de contrôle ──────────────────────────────────────────────────────
export const usePlansControle = (articleId?: string) =>
  useQuery({
    queryKey: ['plans-controle', articleId],
    queryFn: () => api.get(`/plans-controle${articleId ? `?articleId=${articleId}` : ''}`).then(r => r.data),
  });

export const useCreatePlanControle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/plans-controle', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans-controle'] }),
  });
};

export const useAddCritere = (planId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/plans-controle/${planId}/criteres`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans-controle'] }),
  });
};

// ── Contrôles réception ────────────────────────────────────────────────────
export const useControlesReception = (receptionId?: string) =>
  useQuery({
    queryKey: ['controles-reception', receptionId],
    queryFn: () => api.get(`/controles-reception${receptionId ? `?receptionId=${receptionId}` : ''}`).then(r => r.data),
  });

export const useCreateControle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/controles-reception', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controles-reception'] }),
  });
};

export const useAddMesure = (controleId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/controles-reception/${controleId}/mesures`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controles-reception'] }),
  });
};

export const useFinaliserControle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resultat }: { id: string; resultat: 'OK' | 'NOK' }) =>
      api.put(`/controles-reception/${id}/finaliser`, { resultat }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controles-reception'] });
      qc.invalidateQueries({ queryKey: ['lots'] });
    },
  });
};

// ── Non-conformités ────────────────────────────────────────────────────────
export const useNonConformites = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['non-conformites', filters],
    queryFn: () => api.get(`/non-conformites?${params}`).then(r => r.data),
  });
};

export const useStatsNC = () =>
  useQuery({
    queryKey: ['non-conformites-stats'],
    queryFn: () => api.get('/non-conformites/stats').then(r => r.data),
  });

export const useCreateNC = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/non-conformites', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['non-conformites'] }),
  });
};

export const useAnalyserNC = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/non-conformites/${id}/analyser`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['non-conformites'] }),
  });
};

export const usePrendreDecisionNC = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/non-conformites/${id}/decision`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['non-conformites'] }),
  });
};

export const useCloturerNC = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/non-conformites/${id}/cloturer`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['non-conformites'] }),
  });
};

// ── Expéditions ────────────────────────────────────────────────────────────
export const useCommandesClients = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['commandes-clients', filters],
    queryFn: () => api.get(`/commandes-clients?${params}`).then(r => r.data),
  });
};

export const useCreateCC = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/commandes-clients', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-clients'] }),
  });
};

export const useAddLigneCC = (ccId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/commandes-clients/${ccId}/lignes`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes-clients'] }),
  });
};

export const useBonsLivraison = (commandeId?: string) =>
  useQuery({
    queryKey: ['bons-livraison', commandeId],
    queryFn: () => api.get(`/bons-livraison${commandeId ? `?commandeId=${commandeId}` : ''}`).then(r => r.data),
  });

export const useCreateBL = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/bons-livraison', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bons-livraison'] }),
  });
};

export const useExpedierBL = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/bons-livraison/${id}/expedier`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bons-livraison'] }),
  });
};

// ── Reporting ──────────────────────────────────────────────────────────────
export const useKpisDirecteur = () =>
  useQuery({
    queryKey: ['kpis-directeur'],
    queryFn: () => api.get('/reporting/kpis-directeur').then(r => r.data),
    refetchInterval: 60_000,
  });

export const useTrs = (periode: number = 30) =>
  useQuery({
    queryKey: ['trs', periode],
    queryFn: () => api.get(`/reporting/trs?periode=${periode}`).then(r => r.data),
  });

export const useEcartsConsommation = () =>
  useQuery({
    queryKey: ['ecarts-consommation'],
    queryFn: () => api.get('/reporting/ecarts-consommation').then(r => r.data),
  });

export const useClassementFournisseurs = () =>
  useQuery({
    queryKey: ['classement-fournisseurs'],
    queryFn: () => api.get('/reporting/fournisseurs/classement').then(r => r.data),
  });
