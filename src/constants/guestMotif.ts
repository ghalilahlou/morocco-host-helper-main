/** Motifs de séjour — valeurs stockées en base, libellés via i18n. */
export const MOTIF_STAY_OPTIONS = [
  { value: 'TOURISME', labelKey: 'motif.tourism' },
  { value: 'AFFAIRES', labelKey: 'motif.business' },
  { value: 'FAMILLE', labelKey: 'motif.family' },
  { value: 'ÉTUDES', labelKey: 'motif.studies' },
  { value: 'MÉDICAL', labelKey: 'motif.medical' },
  { value: 'AUTRE', labelKey: 'motif.other' },
] as const;

export type MotifStayValue = (typeof MOTIF_STAY_OPTIONS)[number]['value'];
