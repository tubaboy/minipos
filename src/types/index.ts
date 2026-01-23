export interface Product {
  id: string;
  name: string;
  price: number;
  sku?: string;
  category?: string;
  category_id?: string;
  stock?: number;
  modifier_groups?: ModifierGroup[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  extra_price: number;
}

export interface CartItem extends Product {
  quantity: number;
  selectedModifiers: SelectedModifier[];
  uuid: string; // Unique ID for cart item (product + modifiers)
}

export interface SelectedModifier {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
}
