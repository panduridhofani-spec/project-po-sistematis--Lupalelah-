export type POStatus = 'PENDING' | 'PARTIAL' | 'COMPLETE';

export interface PurchaseOrder {
  id: string;
  operational_date: string;
  source_shift_number: number;
  requested_by: string;
  status: POStatus;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  requested_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderReceipt {
  id: string;
  purchase_order_item_id: string;
  receiving_shift_number: number;
  receiving_operational_date: string;
  provided_quantity: number;
  received_by: string;
  received_at: string;
  created_at: string;
  updated_at: string;
}

// For creating new PO (RPC payload)
export interface CreatePOPayloadItem {
  product_id: string;
  requested_quantity: number;
}

// For receiving PO (RPC payload)
export interface ReceivePOPayloadItem {
  purchase_order_item_id: string;
  provided_quantity: number;
}

// ==========================================
// URGENT PO
// ==========================================

export interface UrgentPurchaseOrder {
  id: string;
  operational_date: string;
  source_shift_number: number;
  receiving_shift_number: number;
  requested_by: string;
  status: POStatus;
  created_at: string;
  updated_at: string;
}

export interface UrgentPurchaseOrderItem {
  id: string;
  urgent_purchase_order_id: string;
  product_id: string;
  requested_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface UrgentPurchaseOrderReceipt {
  id: string;
  urgent_purchase_order_item_id: string;
  receipt_group_id: string;
  receiving_shift_number: number;
  receiving_operational_date: string;
  provided_quantity: number;
  received_by: string;
  received_at: string;
  created_at: string;
  updated_at: string;
}

// For creating new Urgent PO (RPC payload)
export interface CreateUrgentPOPayloadItem {
  product_id: string;
  requested_quantity: number;
}

// For receiving Urgent PO (RPC payload)
export interface ReceiveUrgentPOPayloadItem {
  urgent_purchase_order_item_id: string;
  provided_quantity: number;
}
