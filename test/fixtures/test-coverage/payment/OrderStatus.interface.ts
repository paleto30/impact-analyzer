export interface OrderStatus {
    status: "pending" | "paid" | "cancelled";
    updatedAt: string;
}