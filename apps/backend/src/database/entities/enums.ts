// ═══════════════════════════════════════════════════════════════════════════
// ENUMS TypeScript — alignés avec les types ENUM PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════

export enum ArticleType {
  MP          = 'MP',
  SF          = 'SF',
  PF          = 'PF',
  CONSOMMABLE = 'CONSOMMABLE',
  EMBALLAGE   = 'EMBALLAGE',
}

export enum MouvementType {
  ENTREE_RECEPTION        = 'ENTREE_RECEPTION',
  ENTREE_PRODUCTION       = 'ENTREE_PRODUCTION',
  ENTREE_RETOUR_CLIENT    = 'ENTREE_RETOUR_CLIENT',
  ENTREE_AJUSTEMENT       = 'ENTREE_AJUSTEMENT',
  SORTIE_CONSOMMATION     = 'SORTIE_CONSOMMATION',
  SORTIE_EXPEDITION       = 'SORTIE_EXPEDITION',
  SORTIE_REBUT            = 'SORTIE_REBUT',
  SORTIE_AJUSTEMENT       = 'SORTIE_AJUSTEMENT',
  TRANSFERT_INTERNE       = 'TRANSFERT_INTERNE',
  RESERVATION             = 'RESERVATION',
  MISE_QUARANTAINE        = 'MISE_QUARANTAINE',
  LIBERATION_QUARANTAINE  = 'LIBERATION_QUARANTAINE',
}

export enum StatutLot {
  DISPONIBLE  = 'DISPONIBLE',
  RESERVE     = 'RESERVE',
  QUARANTAINE = 'QUARANTAINE',
  LIBERE      = 'LIBERE',
  CONSOMME    = 'CONSOMME',
  PERIME      = 'PERIME',
}

export enum StatutCA {
  BROUILLON = 'BROUILLON',
  VALIDEE   = 'VALIDEE',
  ENVOYEE   = 'ENVOYEE',
  AR_RECU   = 'AR_RECU',
  EN_COURS  = 'EN_COURS',
  RECUE     = 'RECUE',
  CLOTUREE  = 'CLOTUREE',
  ANNULEE   = 'ANNULEE',
}

export enum StatutOF {
  PLANIFIE = 'PLANIFIE',
  VALIDE   = 'VALIDE',
  LANCE    = 'LANCE',
  EN_COURS = 'EN_COURS',
  SUSPENDU = 'SUSPENDU',
  TERMINE  = 'TERMINE',
  CLOS     = 'CLOS',
  ANNULE   = 'ANNULE',
}

export enum StatutCommandeClient {
  RECUE          = 'RECUE',
  VALIDEE        = 'VALIDEE',
  PLANIFIEE      = 'PLANIFIEE',
  EN_PREPARATION = 'EN_PREPARATION',
  PREPAREE       = 'PREPAREE',
  EXPEDIEE       = 'EXPEDIEE',
  LIVREE         = 'LIVREE',
  FACTUREE       = 'FACTUREE',
  CLOSE          = 'CLOSE',
}

export enum NiveauControle {
  REDUIT        = 'REDUIT',
  NORMAL        = 'NORMAL',
  RENFORCE      = 'RENFORCE',
  RENFORCE_LABO = 'RENFORCE_LABO',
}

export enum StatutNC {
  OUVERTE              = 'OUVERTE',
  EN_ANALYSE           = 'EN_ANALYSE',
  EN_ATTENTE_DECISION  = 'EN_ATTENTE_DECISION',
  CLOTUREE             = 'CLOTUREE',
}

export enum DecisionNC {
  ACCEPTATION        = 'ACCEPTATION',
  DEROGATION         = 'DEROGATION',
  TRI                = 'TRI',
  RETOUCHE           = 'RETOUCHE',
  REBUT              = 'REBUT',
  RETOUR_FOURNISSEUR = 'RETOUR_FOURNISSEUR',
}

export enum UserRole {
  ADMIN       = 'ADMIN',
  DIRECTEUR   = 'DIRECTEUR',
  RESP_ACHATS = 'RESP_ACHATS',
  GEST_STOCK  = 'GEST_STOCK',
  RESP_PROD   = 'RESP_PROD',
  OPERATEUR   = 'OPERATEUR',
  QUALITE     = 'QUALITE',
  LOGISTICIEN = 'LOGISTICIEN',
  LECTURE     = 'LECTURE',
}
