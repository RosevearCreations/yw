// Shared Core Data read-model contract for Schema 163.
// This helper is read-only and intentionally projects bounded identity/directory fields.

export type CoreEntityKey =
  | 'profile'
  | 'customer'
  | 'customer_site'
  | 'job'
  | 'equipment'
  | 'customer_asset'
  | 'service_document';

export const CORE_DATA_CONTRACT_VERSION = 1;

export const CORE_READ_MODELS: Record<CoreEntityKey, {
  relation: string;
  columns: string;
  orderColumn: string;
  ascending: boolean;
}> = {
  profile: {
    relation: 'profiles',
    columns: 'id,full_name,role,is_active',
    orderColumn: 'full_name',
    ascending: true,
  },
  customer: {
    relation: 'clients',
    columns: 'id,client_code,legal_name,display_name,client_type,is_active',
    orderColumn: 'legal_name',
    ascending: true,
  },
  customer_site: {
    relation: 'client_sites',
    columns: 'id,client_id,legacy_site_id,site_code,site_name,service_address,city,province,postal_code,is_active',
    orderColumn: 'site_name',
    ascending: true,
  },
  job: {
    relation: 'jobs',
    columns: 'id,job_code,job_name,site_id,job_type,status,priority,client_name,start_date,end_date,site_supervisor_profile_id,signing_supervisor_profile_id,admin_profile_id',
    orderColumn: 'job_code',
    ascending: true,
  },
  equipment: {
    relation: 'equipment_master',
    columns: 'id,equipment_code,item_name,equipment_category,manufacturer,model,ownership_type,is_active',
    orderColumn: 'item_name',
    ascending: true,
  },
  customer_asset: {
    relation: 'customer_assets',
    columns: 'id,asset_code,client_id,client_site_id,asset_name,asset_type,serial_number,manufacturer,model,is_active',
    orderColumn: 'asset_name',
    ascending: true,
  },
  service_document: {
    relation: 'service_contract_documents',
    columns: 'id,document_number,source_entity,source_id,estimate_id,agreement_id,job_id,client_id,client_site_id,document_kind,document_status,title,contract_reference,effective_date,expiry_date',
    orderColumn: 'document_number',
    ascending: true,
  },
};

export const CORE_ENTITY_KEYS = Object.freeze(Object.keys(CORE_READ_MODELS) as CoreEntityKey[]);

export function clampCoreReadLimit(value: unknown, fallback = 250) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(500, Math.trunc(parsed)));
}

export function normalizeCoreEntityKeys(value: unknown): CoreEntityKey[] {
  if (!Array.isArray(value) || value.length === 0) return [...CORE_ENTITY_KEYS];
  const allowed = new Set<CoreEntityKey>(CORE_ENTITY_KEYS);
  const result: CoreEntityKey[] = [];
  for (const raw of value) {
    const key = String(raw || '').trim().toLowerCase() as CoreEntityKey;
    if (allowed.has(key) && !result.includes(key)) result.push(key);
  }
  return result;
}

export async function readCoreDataModels(supabase: any, requested: unknown, limitValue: unknown = 250) {
  const entityKeys = normalizeCoreEntityKeys(requested);
  if (!entityKeys.length) throw new Error('No valid Shared Core entities were requested.');
  const limit = clampCoreReadLimit(limitValue, 250);

  const entries = await Promise.all(entityKeys.map(async (entityKey) => {
    const contract = CORE_READ_MODELS[entityKey];
    let query = supabase
      .from(contract.relation)
      .select(contract.columns)
      .order(contract.orderColumn, { ascending: contract.ascending })
      .limit(limit);

    if (entityKey === 'profile' || entityKey === 'customer' || entityKey === 'customer_site' || entityKey === 'equipment' || entityKey === 'customer_asset') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Shared Core read failed for ${entityKey} (${contract.relation}): ${error.message || 'query failed'}`);
    }
    return [entityKey, data || []] as const;
  }));

  const data = Object.fromEntries(entries) as Record<CoreEntityKey, unknown[]>;
  const counts = Object.fromEntries(entries.map(([key, rows]) => [key, rows.length]));
  return { entityKeys, limit, data, counts };
}
