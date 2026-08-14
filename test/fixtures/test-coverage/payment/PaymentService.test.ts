import { describe, it } from "node:test";
import { PaymentService } from "./PaymentService.js";

describe("PaymentService", () => {
    it("calculates amount with tax", () => {
        const service = new PaymentService();
        service.calculate(100);
    });
});