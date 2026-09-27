export interface Category {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  unit: string;
  safety_stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductWithCategory extends Product {
  categories?: {
    id: string;
    name: string;
  };
}

export interface Unit {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}
