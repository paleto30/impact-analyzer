import { describe, it } from "node:test";
import { CheckoutService } from "./CheckoutService.js";
import { PaymentService } from "./PaymentService.js";

describe("CheckoutService", () => {
    it("creates an order", () => {
        const service = new CheckoutService(new PaymentService());
        service.createOrder(50);
    });
});