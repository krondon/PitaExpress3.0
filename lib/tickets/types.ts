export interface Ticket {
    id: number;
    user_name: string;
    base_code: string;
    full_code: string;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    print_count?: number;
}

export interface PrintHistory {
    id: number;
    ticket_id: number;
    printed_at: string;
    printed_by: string | null;
}

export interface CreateTicketRequest {
    user_name: string;
}

export interface UpdateTicketRequest {
    id: number;
    user_name: string;
}

export interface DeleteTicketRequest {
    id: number;
}

export interface PrintTicketRequest {
    ticket_id: number;
}
