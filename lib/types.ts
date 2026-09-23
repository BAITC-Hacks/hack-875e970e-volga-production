export type Profile = {
  id: string; anon_name: string; categories: string[]; city: string;
  city_imputed: boolean; synthetic: boolean; price_from_kzt: number;
  price_imputed: boolean; event_formats: string[]; languages: string[];
  max_hours: number | null; busy_dates: string[]; description: string;
};
export type Query = {
  city: string; date: string; format: string; category: string; budget: number;
  hours?: number; language?: string; wishes: string;
};
export type Reason = 'busy' | 'budget' | 'format' | 'language' | 'hours';
export type Card = Omit<Profile, 'busy_dates'> & {
  explanation: string; evidence: string; checks: string[];
};
export type Result = {
  status: 'matched' | 'category_absent' | 'no_match';
  cards: Card[]; query: Query; total: number; eligible: number;
  excluded: Record<Reason, number>; message: string;
  ranking: 'semantic' | 'price' | 'none';
  explanationMode: 'ai' | 'facts' | 'none'; warnings: string[];
};
export type Metadata = { cities: string[]; categories: string[]; formats: string[]; languages: string[]; total: number };
