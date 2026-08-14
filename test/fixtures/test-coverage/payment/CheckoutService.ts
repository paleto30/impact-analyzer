import { PaymentService } from "./PaymentService.js";

export class CheckoutService {
    constructor(private readonly paymentService: PaymentService) {}

    createOrder(amount: number): number {
        return this.paymentService.calculate(amount);
    }
}