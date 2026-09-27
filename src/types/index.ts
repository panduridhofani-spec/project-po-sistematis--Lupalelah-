export enum Role {
  MASTER_ADMIN = 'MASTER_ADMIN',
  LEADER_BARISTA = 'LEADER_BARISTA',
  LOGISTICS = 'LOGISTICS'
}

export enum Shift {
  SHIFT_1 = 'SHIFT_1',
  SHIFT_2 = 'SHIFT_2',
  SHIFT_3 = 'SHIFT_3',
  SHIFT_4 = 'SHIFT_4'
}

export enum StockStatus {
  SAFE = 'SAFE',
  NEED_PO = 'NEED_PO',
  OUT_OF_STOCK = 'OUT_OF_STOCK'
}

export enum POType {
  REGULAR = 'REGULAR',
  URGENT = 'URGENT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  unit: string;
  safetyStock: number;
}

export interface StockRecord {
  id: string;
  productId: string;
  shift: Shift;
  actualStock: number;
  status: StockStatus;
  recordedAt: string;
  recordedBy: string;
}

export interface PORequest {
  id: string;
  poNumber: string;
  type: POType;
  createdDate: string;
  createdShift: Shift;
  createdBy: string;
  receivingShift: Shift;
  status: 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED';
}

export interface POItem {
  id: string;
  poRequestId: string;
  productId: string;
  requestedQuantity: number;
  actualProvidedQuantity: number;
  fulfillmentStatus: 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'NOT_PROVIDED';
}

export interface DeliveryRecord {
  id: string;
  poRequestId: string;
  deliveredAt: string;
  deliveredBy: string;
}
