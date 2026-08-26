import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// ── Nomenclatures ─────────────────────────────────────────────────────────────
export const useNomenclature = (articleId: string, niveaux = 1) =>
  useQuery({
    queryKey: ['nomenclatures', articleId, niveaux],
    queryFn: () => api.get(`/nomenclatures?articleId=${articleId}&niveaux=${niveaux}`).then(r => r.data),
    enabled: !!articleId,
  });

export const useBesoinsNomenclature = (articleId: string, quantite: number) =>
  useQuery({
    queryKey: ['nomenclatures-besoins', articleId, quantite],
    queryFn: () => api.get(`/nomenclatures/besoins?articleId=${articleId}&quantite=${quantite}`).then(r => r.data),
    enabled: !!articleId && quantite > 0,
  });

export const useCreateNomenclature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/nomenclatures', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nomenclatures'] }),
  });
};

export const useDesactiverNomenclature = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/nomenclatures/${id}/desactiver`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nomenclatures'] }),
  });
};

// ── Gammes ────────────────────────────────────────────────────────────────────
export const useGammes = (articleId?: string) =>
  useQuery({
    queryKey: ['gammes', articleId],
    queryFn: () => api.get(`/gammes${articleId ? `?articleId=${articleId}` : ''}`).then(r => r.data),
  });

export const useGamme = (id: string) =>
  useQuery({
    queryKey: ['gammes', id],
    queryFn: () => api.get(`/gammes/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateGamme = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/gammes', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gammes'] }),
  });
};

export const useAddOperation = (gammeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/gammes/${gammeId}/operations`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gammes', gammeId] }),
  });
};

// ── Ordres de fabrication ─────────────────────────────────────────────────────
export const useOrdresFabrication = (filters: Record<string, any> = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, String(v)));
  return useQuery({
    queryKey: ['ordres-fabrication', filters],
    queryFn: () => api.get(`/ordres-fabrication?${params}`).then(r => r.data),
  });
};

export const useOrdreFabrication = (id: string) =>
  useQuery({
    queryKey: ['ordres-fabrication', id],
    queryFn: () => api.get(`/ordres-fabrication/${id}`).then(r => r.data),
    enabled: !!id,
  });

export const useDisponibiliteMp = (id: string) =>
  useQuery({
    queryKey: ['ordres-fabrication', id, 'disponibilite-mp'],
    queryFn: () => api.get(`/ordres-fabrication/${id}/disponibilite-mp`).then(r => r.data),
    enabled: !!id,
  });

export const useDeclarationsOf = (id: string) =>
  useQuery({
    queryKey: ['ordres-fabrication', id, 'declarations'],
    queryFn: () => api.get(`/ordres-fabrication/${id}/declarations`).then(r => r.data),
    enabled: !!id,
  });

export const useConsommationsOf = (id: string) =>
  useQuery({
    queryKey: ['ordres-fabrication', id, 'consommations'],
    queryFn: () => api.get(`/ordres-fabrication/${id}/consommations`).then(r => r.data),
    enabled: !!id,
  });

export const useCreateOF = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/ordres-fabrication', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordres-fabrication'] }),
  });
};

export const useValiderOF = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/ordres-fabrication/${id}/valider`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordres-fabrication'] }),
  });
};

export const useLancerOF = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/ordres-fabrication/${id}/lancer`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordres-fabrication'] }),
  });
};

export const useSuspendreOF = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motif }: { id: string; motif: string }) =>
      api.put(`/ordres-fabrication/${id}/suspendre`, { motif }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordres-fabrication'] }),
  });
};

export const useReprendreOF = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.put(`/ordres-fabrication/${id}/reprendre`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordres-fabrication'] }),
  });
};

export const useDeclarer = (ofId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/ordres-fabrication/${ofId}/declarations`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ordres-fabrication', ofId] }),
  });
};

export const useConsommer = (ofId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/ordres-fabrication/${ofId}/consommations`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordres-fabrication', ofId] });
      qc.invalidateQueries({ queryKey: ['stock-actuel'] });
    },
  });
};

export const useCloturerOF = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/ordres-fabrication/${id}/cloturer`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ordres-fabrication'] });
      qc.invalidateQueries({ queryKey: ['stock-actuel'] });
    },
  });
};
