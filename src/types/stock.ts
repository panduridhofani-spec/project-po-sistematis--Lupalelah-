export type StockStatus = 'SAFE' | 'NEED_PO' | 'OUT_OF_STOCK';

export interface StockTaking {
  id: string;
  operational_date: string;
  shift_number: number;
  taken_by: string;
  taken_at: string;
  items: StockTakingItem[];
}

export interface StockTakingItem {
  product_id: string;
  beginning_stock: number; // AWAL
  in_stock: number;        // IN (from validated POs)
  out_stock: number;       // OUT (usage)
  actual_stock: number;    // SISA (AWAL + IN - OUT)
  stock_status: StockStatus;
}

export type POType = 'REGULAR' | 'URGENT';
export type POStatus = 'PENDING' | 'PARTIAL' | 'SENT' | 'VALIDATED' | 'COMPLETE';

export interface PurchaseOrder {
  id: string;
  type: POType;
  status: POStatus;
  
  // Creation
  operational_date: string;
  source_shift_number: number;
  requested_by: string;
  created_at: string;
  
  // Logistics Processing
  target_shift_number?: number;
  target_operational_date?: string; // Tgl untuk shift penerima
  processed_by?: string;
  processed_at?: string;
  
  // Validation by Leader
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string; // e.g., "Diedit oleh Leader: Gula dikirim 5, diterima 3"
  has_discrepancy?: boolean;
  discrepancy_resolved?: boolean;
  
  items: POItem[];
}

export interface POItem {
  product_id: string;
  requested_quantity: number;
  sent_quantity?: number;
  validated_quantity?: number;
  logistics_notes?: string;
}
