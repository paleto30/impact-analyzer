import { PaymentService } from "./PaymentService.js";

export class InvoiceService {
    constructor(private readonly paymentService: PaymentService) {}

    invoice(amount: number): number {
        return this.paymentService.calculate(amount);
    }
}