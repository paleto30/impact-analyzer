import { PaymentService, formatAmount } from "./index.js";

export class CheckoutController {
    private readonly paymentService = new PaymentService();

    checkout(amount: number): string {
        const cents = this.paymentService.calculate(amount);
        return formatAmount(cents);
    }
}
