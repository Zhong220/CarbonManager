// src/utils/storage/types.ts
import { FIXED_STAGE_TEMPLATES, StageConfig as StageCfg, LifeRecord as LR } from "../lifecycleTypes";

export type Role = "Farmer" | "Consumer" | "None";

export interface AccountMeta {
  role: Role;
  password?: string;
  shopIds?: string[];
  currentShopId?: string;
}

export interface TeaShop {
  id: string;
  name: string;
  owner: string;
}

// String, non-recyclable primary key + UI-friendly serialNo
export interface Product {
  id: string;         // e.g. "prod_3q9f..."
  name: string;
  serialNo?: number;  // friendly increasing number for UI
  categoryId?: string | null;
}

export interface Category {
  id: string;
  name: string;
  order: number; // for sorting
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: number;
}

export type StageConfig = StageCfg;
export type LifeRecord  = LR;

export { FIXED_STAGE_TEMPLATES };
