export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type FlashDealsTable = {
  Row: {
    id: string;
    partner_id: string;
    title: string;
    description: string | null;
    deal_type: string;
    slug: string | null;
    discount_percent: number;
    min_visitors: number;
    valid_from: string | null;
    valid_to: string | null;
    valid_days: number[] | null;
    commission_percent: number;
    price_override_czk: number | null;
    bonus_points_override: number | null;
    is_featured: boolean;
    banner_lead_hours: number;
    ticket_requirements: Json | null;
    qr_validity_seconds: number;
    usage_limit: number | null;
    usage_limit_daily: number | null;
    usage_count: number;
    auto_expire: boolean;
    send_reminders: boolean;
    tags: string[];
    audience: string[];
    ticket_types: string[] | null;
    city: string | null;
    status: "draft" | "scheduled" | "live" | "paused" | "expired";
    time_zone: string;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    partner_id: string;
    title: string;
    description?: string | null;
    deal_type?: string;
    slug?: string | null;
    discount_percent: number;
    min_visitors: number;
    valid_from?: string | null;
    valid_to?: string | null;
    valid_days?: number[] | null;
    commission_percent: number;
    price_override_czk?: number | null;
    bonus_points_override?: number | null;
    is_featured?: boolean;
    banner_lead_hours?: number;
    ticket_requirements?: Json | null;
    qr_validity_seconds: number;
    usage_limit?: number | null;
    usage_limit_daily?: number | null;
    usage_count?: number;
    auto_expire?: boolean;
    send_reminders?: boolean;
    tags?: string[];
    audience?: string[];
    ticket_types?: string[] | null;
    city?: string | null;
    status?: "draft" | "scheduled" | "live" | "paused" | "expired";
    time_zone?: string;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    partner_id?: string;
    title?: string;
    description?: string | null;
    deal_type?: string;
    slug?: string | null;
    discount_percent?: number;
    min_visitors?: number;
    valid_from?: string | null;
    valid_to?: string | null;
    valid_days?: number[] | null;
    commission_percent?: number;
    price_override_czk?: number | null;
    bonus_points_override?: number | null;
    is_featured?: boolean;
    banner_lead_hours?: number;
    ticket_requirements?: Json | null;
    qr_validity_seconds?: number;
    usage_limit?: number | null;
    usage_limit_daily?: number | null;
    usage_count?: number;
    auto_expire?: boolean;
    send_reminders?: boolean;
    tags?: string[];
    audience?: string[];
    ticket_types?: string[] | null;
    city?: string | null;
    status?: "draft" | "scheduled" | "live" | "paused" | "expired";
    time_zone?: string;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type FlashDealRedemptionsTable = {
  Row: {
    id: string;
    flash_deal_id: string;
    visit_id: string | null;
    status: string;
    metadata: Json | null;
    created_at: string;
    updated_at: string | null;
  };
  Insert: {
    id?: string;
    flash_deal_id: string;
    visit_id?: string | null;
    status?: string;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string | null;
  };
  Update: {
    id?: string;
    flash_deal_id?: string;
    visit_id?: string | null;
    status?: string;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string | null;
  };
  Relationships: [];
};

type TransportServicesTable = {
  Row: {
    id: string;
    partner_id: string;
    name: string;
    service_type: "taxi" | "bus" | "limo" | string;
    qr_validity_days: number;
    commission_per_ride: number;
    notes: string | null;
    enabled: boolean;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    partner_id: string;
    name: string;
    service_type: "taxi" | "bus" | "limo" | string;
    qr_validity_days?: number;
    commission_per_ride: number;
    notes?: string | null;
    enabled?: boolean;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    partner_id?: string;
    name?: string;
    service_type?: "taxi" | "bus" | "limo" | string;
    qr_validity_days?: number;
    commission_per_ride?: number;
    notes?: string | null;
    enabled?: boolean;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type TransportRidesTable = {
  Row: {
    id: string;
    service_id: string;
    visit_id: string | null;
    fare_amount: number | null;
    status: string;
    metadata: Json | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    service_id: string;
    visit_id?: string | null;
    fare_amount?: number | null;
    status?: string;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    service_id?: string;
    visit_id?: string | null;
    fare_amount?: number | null;
    status?: string;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type CmsEntriesTable = {
  Row: {
    id: string;
    slug: string;
    locale: string;
    title: string;
    content: Json;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    slug: string;
    locale?: string;
    title: string;
    content?: Json;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    slug?: string;
    locale?: string;
    title?: string;
    content?: Json;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type CmsPagesTable = {
  Row: {
    id: string;
    slug: string;
    display_name: string;
    description: string | null;
    status: 'draft' | 'ready' | 'archived' | string;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    slug: string;
    display_name: string;
    description?: string | null;
    status?: 'draft' | 'ready' | 'archived' | string;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    slug?: string;
    display_name?: string;
    description?: string | null;
    status?: 'draft' | 'ready' | 'archived' | string;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type CmsPageVersionsTable = {
  Row: {
    id: string;
    page_id: string;
    locale: string;
    version_number: number;
    status: 'draft' | 'published' | 'archived' | string;
    summary: string | null;
    created_by: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    page_id: string;
    locale?: string;
    version_number?: number;
    status?: 'draft' | 'published' | 'archived' | string;
    summary?: string | null;
    created_by?: string | null;
    published_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    page_id?: string;
    locale?: string;
    version_number?: number;
    status?: 'draft' | 'published' | 'archived' | string;
    summary?: string | null;
    created_by?: string | null;
    published_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "cms_page_versions_page_id_fkey";
      columns: ["page_id"];
      referencedRelation: "cms_pages";
      referencedColumns: ["id"];
    },
  ];
};

type CmsBlocksTable = {
  Row: {
    id: string;
    page_version_id: string;
    sort_order: number;
    block_type: string;
    data: Json;
    visible: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    page_version_id: string;
    sort_order?: number;
    block_type: string;
    data?: Json;
    visible?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    page_version_id?: string;
    sort_order?: number;
    block_type?: string;
    data?: Json;
    visible?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "cms_blocks_page_version_id_fkey";
      columns: ["page_version_id"];
      referencedRelation: "cms_page_versions";
      referencedColumns: ["id"];
    },
  ];
};

type DealMediaTable = {
  Row: {
    id: string;
    deal_id: string;
    media_type: string;
    url: string;
    alt_text: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    deal_id: string;
    media_type: string;
    url: string;
    alt_text?: string | null;
    sort_order?: number;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    deal_id?: string;
    media_type?: string;
    url?: string;
    alt_text?: string | null;
    sort_order?: number;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type DealUsageStatsTable = {
  Row: {
    deal_id: string;
    qr_generated: number;
    qr_scanned: number;
    qr_rejected: number;
    commission_czk: number;
    bonus_awarded: number;
    updated_at: string;
  };
  Insert: {
    deal_id: string;
    qr_generated?: number;
    qr_scanned?: number;
    qr_rejected?: number;
    commission_czk?: number;
    bonus_awarded?: number;
    updated_at?: string;
  };
  Update: {
    deal_id?: string;
    qr_generated?: number;
    qr_scanned?: number;
    qr_rejected?: number;
    commission_czk?: number;
    bonus_awarded?: number;
    updated_at?: string;
  };
  Relationships: [];
};

type DealReminderQueueTable = {
  Row: {
    id: string;
    deal_id: string;
    qr_id: string | null;
    user_email: string | null;
    reminder_type: string;
    scheduled_at: string;
    status: string;
    last_attempt_at: string | null;
    metadata: Json | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    deal_id: string;
    qr_id?: string | null;
    user_email?: string | null;
    reminder_type: string;
    scheduled_at: string;
    status?: string;
    last_attempt_at?: string | null;
    metadata?: Json | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    deal_id?: string;
    qr_id?: string | null;
    user_email?: string | null;
    reminder_type?: string;
    scheduled_at?: string;
    status?: string;
    last_attempt_at?: string | null;
    metadata?: Json | null;
    created_at?: string;
  };
  Relationships: [];
};

type GlobalValuesTable = {
  Row: {
    id: string;
    value_type: "ticket_type" | "category" | "tag" | "listing_tier";
    key: string;
    label: string;
    description: string | null;
    metadata: Json;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    value_type: "ticket_type" | "category" | "tag" | "listing_tier";
    key: string;
    label: string;
    description?: string | null;
    metadata?: Json | null;
    sort_order?: number;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    value_type?: "ticket_type" | "category" | "tag" | "listing_tier";
    key?: string;
    label?: string;
    description?: string | null;
    metadata?: Json | null;
    sort_order?: number;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type PartnerUsersTable = {
  Row: {
    email: string;
    password_hash: string | null;
    partner_id: string | null;
    role: "partner" | "admin";
    name: string | null;
    metadata: Json | null;
    created_at: string;
    updated_at: string;
    last_login_at: string | null;
    verified_at: string | null;
    last_invited_at: string | null;
    invited_by: string | null;
  };
  Insert: {
    email: string;
    password_hash?: string | null;
    partner_id?: string | null;
    role?: "partner" | "admin";
    name?: string | null;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string;
    last_login_at?: string | null;
    verified_at?: string | null;
    last_invited_at?: string | null;
    invited_by?: string | null;
  };
  Update: {
    email?: string;
    password_hash?: string | null;
    partner_id?: string | null;
    role?: "partner" | "admin";
    name?: string | null;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string;
    last_login_at?: string | null;
    verified_at?: string | null;
    last_invited_at?: string | null;
    invited_by?: string | null;
  };
  Relationships: [];
};

type AdminInvitesTable = {
  Row: {
    id: string;
    email: string;
    inviter_email: string | null;
    token: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
    metadata: Json | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    email: string;
    inviter_email?: string | null;
    token: string;
    role?: string;
    expires_at: string;
    accepted_at?: string | null;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    email?: string;
    inviter_email?: string | null;
    token?: string;
    role?: string;
    expires_at?: string;
    accepted_at?: string | null;
    metadata?: Json | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type TimezoneSettingsTable = {
  Row: {
    id: number;
    admin_time_zone: string;
    source: "admin" | "partner";
    created_by: string | null;
    created_at: string;
  };
  Insert: {
    admin_time_zone: string;
    source: "admin" | "partner";
    created_by?: string | null;
    created_at?: string;
  };
  Update: {
    id?: number;
    admin_time_zone?: string;
    source?: "admin" | "partner";
    created_by?: string | null;
    created_at?: string;
  };
  Relationships: [];
};

type TypedTables = {
  flash_deals: FlashDealsTable;
  flash_deal_redemptions: FlashDealRedemptionsTable;
  transport_services: TransportServicesTable;
  transport_rides: TransportRidesTable;
  deal_media: DealMediaTable;
  deal_usage_stats: DealUsageStatsTable;
  deal_reminder_queue: DealReminderQueueTable;
  global_values: GlobalValuesTable;
  cms_entries: CmsEntriesTable;
  cms_pages: CmsPagesTable;
  cms_page_versions: CmsPageVersionsTable;
  cms_blocks: CmsBlocksTable;
  partner_users: PartnerUsersTable;
  admin_invites: AdminInvitesTable;
  timezone_settings: TimezoneSettingsTable;
};

type ExtendedTables = TypedTables & {
  [TableName in string]: TableName extends keyof TypedTables
    ? TypedTables[TableName]
    : GenericTable;
};

export interface Database {
  public: {
    Tables: ExtendedTables;
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
