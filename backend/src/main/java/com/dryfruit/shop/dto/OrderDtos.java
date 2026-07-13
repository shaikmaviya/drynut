package com.dryfruit.shop.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public class OrderDtos {

    public static class CreateOrderRequest {
        @Min(1)
        public int quantity;
        @NotBlank
        public String customerName;
        @NotBlank
        public String customerPhone;
        @NotBlank
        public String address;
        @NotBlank
        public String pincode;
        public String couponCode;
    }

    public static class CreateOrderResponse {
        public String orderId;
        public int amountInPaise;
        public int originalAmountInPaise;
        public int discountInPaise;
        public String currency;
        public String keyId;

        public CreateOrderResponse(String orderId, int amountInPaise, int originalAmountInPaise,
                                    int discountInPaise, String currency, String keyId) {
            this.orderId = orderId;
            this.amountInPaise = amountInPaise;
            this.originalAmountInPaise = originalAmountInPaise;
            this.discountInPaise = discountInPaise;
            this.currency = currency;
            this.keyId = keyId;
        }
    }

    public static class VerifyRequest {
        @NotBlank
        public String razorpayOrderId;
        @NotBlank
        public String razorpayPaymentId;
        @NotBlank
        public String razorpaySignature;
    }

    public static class VerifyResponse {
        public boolean success;
        public String message;

        public VerifyResponse(boolean success, String message) {
            this.success = success;
            this.message = message;
        }
    }

    public static class ValidateCouponRequest {
        @NotBlank
        public String code;
        @Min(1)
        public int quantity;
    }

    public static class ValidateCouponResponse {
        public boolean valid;
        public String message;
        public int originalAmountInPaise;
        public int discountInPaise;
        public int finalAmountInPaise;

        public ValidateCouponResponse(boolean valid, String message, int originalAmountInPaise,
                                       int discountInPaise, int finalAmountInPaise) {
            this.valid = valid;
            this.message = message;
            this.originalAmountInPaise = originalAmountInPaise;
            this.discountInPaise = discountInPaise;
            this.finalAmountInPaise = finalAmountInPaise;
        }
    }

    public static class CouponRequest {
        @NotBlank
        public String code;
        @NotBlank
        public String discountType;
        @Min(1)
        public int discountValue;
    }
}