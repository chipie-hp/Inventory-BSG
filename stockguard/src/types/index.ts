// ============================================================
// StockGuard — TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'manager' | 'store_manager' | 'clerk' | 'requester'
export type MovementType = 'receipt' | 'issue' | 'adjustment' | 'transfer' | 'return'
export type AdjustmentType = 'physical_count' | 'spoilage' | 'damage' | 'theft' | 'transfer' | 'supplier_return' | 'other'
export type RequisitionStatus = 'draft' | 'pending' | 'approved' | 'issued' | 'rejected' | 'cancelled'
export type AlertStatus = 'open' | 'under_review' | 'escalated' | 'resolved' | 'dismissed'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type GrnStatus = 'draft' | 'submitted' | 'verified' | 'posted'
export type StockStatus = 'good' | 'watch' | 'low' | 'out_of_stock'

// ── Stores ────────────────────────────────────────────────
export interface Store {
  id: string
  name: string
  code: string
  location: string | null
  zone: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Profiles ──────────────────────────────────────────────
export interface Profile {
  id: string
  full_name: string
  role: UserRole
  is_active: boolean
  is_flagged: boolean
  flagged_reason: string | null
  created_at: string
  updated_at: string
}

export interface ProfileWithAccess extends Profile {
  store_access: Store[]
}

// ── Items ─────────────────────────────────────────────────
export interface ItemCategory {
  id: string
  name: string
}

export interface Item {
  id: string
  code: string
  name: string
  description: string | null
  category_id: string | null
  unit_of_measure: string
  reorder_point: number
  is_active: boolean
  created_at: string
  updated_at: string
  category?: ItemCategory
}

// ── Store Items ───────────────────────────────────────────
export interface StoreItem {
  id: string
  store_id: string
  item_id: string
  min_level: number
  max_level: number
  current_qty: number
  avg_unit_cost: number
  last_counted_at: string | null
  updated_at: string
}

// View: v_store_stock
export interface StoreStockRow {
  id: string
  store_id: string
  store_name: string
  store_code: string
  zone: string
  item_id: string
  item_code: string
  item_name: string
  unit_of_measure: string
  category: string
  current_qty: number
  min_level: number
  max_level: number
  avg_unit_cost: number
  stock_value: number
  stock_status: StockStatus
  last_counted_at: string | null
  updated_at: string
}

// View: v_store_summary
export interface StoreSummary {
  store_id: string
  store_name: string
  code: string
  zone: string
  total_items: number
  total_value: number
  low_stock_count: number
  out_of_stock_count: number
  open_alerts: number
}

// ── GRN ───────────────────────────────────────────────────
export interface GRN {
  id: string
  grn_number: string
  store_id: string
  supplier_id: string | null
  supplier_name: string | null
  invoice_number: string | null
  delivery_date: string
  status: GrnStatus
  notes: string | null
  received_by: string
  verified_by: string | null
  posted_at: string | null
  created_at: string
  updated_at: string
  store?: Store
  received_by_profile?: Profile
}

export interface GRNLine {
  id: string
  grn_id: string
  item_id: string
  qty_ordered: number
  qty_received: number
  unit_cost: number
  total_cost: number
  condition: 'good' | 'damaged' | 'partial'
  condition_notes: string | null
  item?: Item
}

// ── Requisitions ──────────────────────────────────────────
export interface Requisition {
  id: string
  req_number: string
  store_id: string
  department: string
  purpose: string | null
  status: RequisitionStatus
  requested_by: string
  approved_by: string | null
  approved_at: string | null
  issued_by: string | null
  issued_at: string | null
  rejected_reason: string | null
  created_at: string
  updated_at: string
  store?: Store
  requested_by_profile?: Profile
  lines?: RequisitionLine[]
}

export interface RequisitionLine {
  id: string
  req_id: string
  item_id: string
  qty_requested: number
  qty_issued: number | null
  unit_cost: number | null
  notes: string | null
  item?: Item
}

// ── Movements ─────────────────────────────────────────────
export interface Movement {
  id: string
  created_at: string
  store_name: string
  store_code: string
  item_name: string
  item_code: string
  unit_of_measure: string
  movement_type: MovementType
  qty_in: number
  qty_out: number
  qty_before: number
  qty_after: number
  unit_cost: number | null
  reference_type: string | null
  reference_number: string | null
  notes: string | null
  performed_by_name: string
}

// ── Adjustments ───────────────────────────────────────────
export interface StockAdjustment {
  id: string
  adj_number: string
  store_id: string
  item_id: string
  adjustment_type: AdjustmentType
  qty_before: number
  qty_adjusted: number
  qty_after: number
  reason: string
  evidence_notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  store?: Store
  item?: Item
  requested_by_profile?: Profile
}

// ── Alerts ────────────────────────────────────────────────
export interface Alert {
  id: string
  created_at: string
  updated_at: string
  store_name: string
  store_code: string
  item_name: string
  item_code: string
  severity: AlertSeverity
  status: AlertStatus
  title: string
  description: string | null
  variance_qty: number | null
  variance_value: number | null
  is_repeat: boolean
  repeat_count: number
  investigation_notes: string | null
  action_taken: string | null
  raised_by_name: string | null
  last_issued_by_name: string | null
  resolved_by_name: string | null
}

// ── Physical Count ────────────────────────────────────────
export interface PhysicalCount {
  id: string
  store_id: string
  item_id: string
  system_qty: number
  counted_qty: number
  variance: number
  counted_by: string
  count_date: string
  notes: string | null
  alert_raised: boolean
}

// ── Transfers ─────────────────────────────────────────────
export interface Transfer {
  id: string
  transfer_number: string
  from_store_id: string
  to_store_id: string
  item_id: string
  qty: number
  unit_cost: number | null
  reason: string | null
  status: string
  requested_by: string
  created_at: string
}

// ── Auth context ──────────────────────────────────────────
export interface AuthUser {
  id: string
  email: string
  profile: Profile
  storeAccess: Store[]   // empty array = all stores (for admin/manager)
  canAccessAllStores: boolean
}
