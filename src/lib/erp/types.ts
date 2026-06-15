export type ErpSale = {
  id: string;
  owner_id: string;
  erp_sale_id: string;
  sku: string | null;
  product_ref: string | null;
  quantity: number;
  total_value: number;
  customer: string | null;
  region: string | null;
  channel: string | null;
  sold_at: string | null;
  influencer_code: string | null;
  campaign_code: string | null;
  synced_at: string;
};

export type ErpInventory = {
  id: string;
  owner_id: string;
  sku: string;
  balance: number;
  location: string | null;
  erp_updated_at: string | null;
  synced_at: string;
};

export type ErpPurchase = {
  id: string;
  owner_id: string;
  erp_po_code: string;
  supplier: string | null;
  total_value: number;
  status: string | null;
  ordered_at: string | null;
  synced_at: string;
};
