package com.dryfruit.shop.controller;

import com.dryfruit.shop.dto.OrderDtos.*;
import com.dryfruit.shop.entity.CouponEntity;
import com.dryfruit.shop.repository.CouponRepository;
import com.dryfruit.shop.service.CouponService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/coupons")
public class CouponController {

    private static final int PRICE_PER_PACK_RUPEES = 29;
    private static final Set<String> VALID_TYPES = Set.of("PERCENT", "FLAT");

    private final CouponRepository couponRepository;
    private final CouponService couponService;

    @Value("${app.admin-key:changeme}")
    private String adminKey;

    public CouponController(CouponRepository couponRepository, CouponService couponService) {
        this.couponRepository = couponRepository;
        this.couponService = couponService;
    }

    @PostMapping
    public ResponseEntity<?> createOrUpdate(@RequestParam String key, @Valid @RequestBody CouponRequest req) {
        if (!adminKey.equals(key)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid key"));
        }
        if (!VALID_TYPES.contains(req.discountType.toUpperCase())) {
            return ResponseEntity.status(400).body(Map.of("error", "discountType must be PERCENT or FLAT"));
        }
        CouponEntity coupon = new CouponEntity();
        coupon.setCode(req.code.trim().toUpperCase());
        coupon.setDiscountType(req.discountType.toUpperCase());
        coupon.setDiscountValue(req.discountValue);
        coupon.setActive(true);
        couponRepository.save(coupon);
        return ResponseEntity.ok(coupon);
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam String key) {
        if (!adminKey.equals(key)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid key"));
        }
        return ResponseEntity.ok(couponRepository.findAll());
    }

    @PatchMapping("/{code}/deactivate")
    public ResponseEntity<?> deactivate(@PathVariable String code, @RequestParam String key) {
        if (!adminKey.equals(key)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid key"));
        }
        return couponRepository.findById(code.trim().toUpperCase()).map(c -> {
            c.setActive(false);
            couponRepository.save(c);
            return ResponseEntity.ok(Map.of("code", c.getCode(), "active", false));
        }).orElse(ResponseEntity.status(404).body(Map.of("error", "Coupon not found")));
    }

    @PostMapping("/validate")
    public ResponseEntity<ValidateCouponResponse> validate(@Valid @RequestBody ValidateCouponRequest req) {
        int original = req.quantity * PRICE_PER_PACK_RUPEES * 100;
        CouponService.Result result = couponService.apply(req.code, original);
        int finalAmount = original - result.discountInPaise;
        return ResponseEntity.ok(new ValidateCouponResponse(
                result.valid, result.message, original, result.discountInPaise, finalAmount));
    }
}