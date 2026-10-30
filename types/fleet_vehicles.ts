/**
 * Fleet Vehicle Inventory Types & Database Definitions
 * Strict TypeScript definition for Supabase and Fleet Management Module
 */

export type VehicleType = 'motor' | 'mobil';
export type VehicleCategory = 'granmax' | 'truck_box' | 'pickup' | 'l300';
export type AssignedRole = 'kurir' | 'driver';

export interface FleetVehicle {
    id: string;
    plate_number: string;
    vehicle_type: VehicleType;
    vehicle_category?: VehicleCategory;
    assigned_person_id: string | null;
    assigned_person_name?: string | null;
    assigned_role: AssignedRole | null;
    assigned_person_phone: string | null;
    tax_due_date: string; // ISO date string (YYYY-MM-DD)
    kir_due_date: string | null; // ISO date string (YYYY-MM-DD) or null for motor
    service_due_date: string; // ISO date string (YYYY-MM-DD)
    service_details?: string | null; // Rincian item servis (e.g. Ganti Oli, Tune Up, Filter, Kampas Rem)
    fuel_barcode_url: string | null;
    fuel_barcode_code: string | null;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
}

export type FleetVehicleInsert = Omit<FleetVehicle, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
    created_at?: string;
    updated_at?: string;
};

export type FleetVehicleUpdate = Partial<FleetVehicleInsert>;

export interface FleetAlertStatus {
    isOverdue: boolean;
    isWarningH7: boolean;
    daysRemaining: number;
    targetName: 'Pajak / STNK' | 'KIR' | 'Servis Rutin';
    dueDate: string;
}

export interface VehicleHealthSummary {
    vehicle: FleetVehicle;
    alerts: FleetAlertStatus[];
    hasMissingPhoneWarning: boolean;
    worstStatus: 'overdue' | 'warning_h7' | 'safe';
}

export interface Database {
    public: {
        Tables: {
            fleet_vehicles: {
                Row: FleetVehicle;
                Insert: FleetVehicleInsert;
                Update: FleetVehicleUpdate;
            };
        };
    };
}
