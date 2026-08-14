export class PaymentService {
    calculate(amount: number): number {
        return amount * 0.19;
    }
}