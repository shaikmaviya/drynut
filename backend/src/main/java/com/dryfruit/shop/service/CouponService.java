package com.dryfruit.shop.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.dryfruit.shop.entity.CouponEntity;
import com.dryfruit.shop.repository.CouponRepository;

@Service
public class CouponService {

    private final CouponRepository couponRepository;

    public CouponService(CouponRepository couponRepository) {
        this.couponRepository = couponRepository;
    }

    public static class Result {
        public boolean valid;
        public String message;
        public int discountInPaise;

        public Result(boolean valid, String message, int discountInPaise) {
            this.valid = valid;
            this.message = message;
            this.discountInPaise = discountInPaise;
        }
    }

    public Result apply(String code, int originalAmountInPaise) {
        if (code == null || code.isBlank()) {
            return new Result(true, "No coupon applied", 0);
        }
        Optional<CouponEntity> found = couponRepository.findById(code.trim().toUpperCase());
        if (found.isEmpty() || !found.get().isActive()) {
            return new Result(false, "Invalid or inactive coupon code", 0);
        }
        CouponEntity coupon = found.get();
        int discount;
        if ("PERCENT".equalsIgnoreCase(coupon.getDiscountType())) {
            discount = (originalAmountInPaise * coupon.getDiscountValue()) / 100;
        } else {
            discount = coupon.getDiscountValue() * 100;
        }
        discount = Math.min(discount, originalAmountInPaise);
        return new Result(true, "Coupon applied", discount);
    }
}