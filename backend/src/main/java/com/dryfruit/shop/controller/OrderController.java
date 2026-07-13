package com.dryfruit.shop.controller;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.dryfruit.shop.dto.OrderDtos.CreateOrderRequest;
import com.dryfruit.shop.dto.OrderDtos.CreateOrderResponse;
import com.dryfruit.shop.dto.OrderDtos.VerifyRequest;
import com.dryfruit.shop.dto.OrderDtos.VerifyResponse;
import com.dryfruit.shop.entity.OrderEntity;
import com.dryfruit.shop.repository.OrderRepository;
import com.dryfruit.shop.service.CouponService;
import com.dryfruit.shop.service.EmailService;
import com.dryfruit.shop.service.RazorpayService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final RazorpayService razorpayService;
    private final OrderRepository orderRepository;
    private final CouponService couponService;
    private final EmailService emailService;

    private static final int PRICE_PER_PACK_RUPEES = 29;
    private static final Set<String> VALID_STATUSES = Set.of("CONFIRMED", "PACKED", "SHIPPED", "DELIVERED");

    @Value("${app.admin-key:changeme}")
    private String adminKey;

    public OrderController(RazorpayService razorpayService, OrderRepository orderRepository, CouponService couponService, EmailService emailService) {
        this.razorpayService = razorpayService;
        this.orderRepository = orderRepository;
        this.couponService = couponService;
        this.emailService = emailService;
    }

    @PostMapping
    public ResponseEntity<?> createOrder(@Valid @RequestBody CreateOrderRequest req) {
        try {
            int originalAmount = req.quantity * PRICE_PER_PACK_RUPEES * 100;

            CouponService.Result couponResult = couponService.apply(req.couponCode, originalAmount);
            if (!couponResult.valid) {
                return ResponseEntity.status(400).body(Map.of("error", couponResult.message));
            }
            int finalAmount = originalAmount - couponResult.discountInPaise;

            JSONObject order = razorpayService.createOrder(finalAmount);
            String orderId = order.getString("id");

            OrderEntity entity = new OrderEntity();
            entity.setOrderId(orderId);
            entity.setCustomerName(req.customerName);
            entity.setCustomerPhone(req.customerPhone);
            entity.setAddress(req.address);
            entity.setPincode(req.pincode);
            entity.setQuantity(req.quantity);
            entity.setOriginalAmountInPaise(originalAmount);
            entity.setDiscountInPaise(couponResult.discountInPaise);
            entity.setAmountInPaise(finalAmount);
            if (req.couponCode != null && !req.couponCode.isBlank()) {
                entity.setCouponCode(req.couponCode.trim().toUpperCase());
            }
            orderRepository.save(entity);

            CreateOrderResponse response = new CreateOrderResponse(
                    orderId, finalAmount, originalAmount, couponResult.discountInPaise, "INR", razorpayService.getKeyId());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Could not create order: " + e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<VerifyResponse> verifyPayment(@Valid @RequestBody VerifyRequest req) {
        boolean valid = razorpayService.verifySignature(
                req.razorpayOrderId, req.razorpayPaymentId, req.razorpaySignature);

        if (valid) {
            orderRepository.findById(req.razorpayOrderId).ifPresent(entity -> {
                entity.setPaid(true);
                orderRepository.save(entity);
                emailService.sendOrderNotification(entity);
            });
            return ResponseEntity.ok(new VerifyResponse(true, "Payment verified"));
        }
        return ResponseEntity.status(400).body(new VerifyResponse(false, "Signature verification failed"));
    }

    @GetMapping("/track")
    public ResponseEntity<?> track(@RequestParam String phone) {
        List<OrderEntity> orders = orderRepository.findByCustomerPhoneOrderByCreatedAtDesc(phone);
        List<Map<String, Object>> result = orders.stream()
                .filter(OrderEntity::isPaid)
                .map(o -> Map.<String, Object>of(
                        "orderId", o.getOrderId(),
                        "quantity", o.getQuantity(),
                        "status", o.getStatus(),
                        "orderedAt", o.getCreatedAt().toString()
                ))
                .toList();
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{orderId}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String orderId,
                                           @RequestParam String key,
                                           @RequestBody Map<String, String> body) {
        if (!adminKey.equals(key)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid key"));
        }
        String newStatus = body.get("status");
        if (newStatus == null || !VALID_STATUSES.contains(newStatus.toUpperCase())) {
            return ResponseEntity.status(400).body(Map.of("error", "Status must be one of " + VALID_STATUSES));
        }
        return orderRepository.findById(orderId).map(entity -> {
            entity.setStatus(newStatus.toUpperCase());
            orderRepository.save(entity);
            return ResponseEntity.ok(Map.of("orderId", orderId, "status", entity.getStatus()));
        }).orElse(ResponseEntity.status(404).body(Map.of("error", "Order not found")));
    }

    @GetMapping("/summary")
    public ResponseEntity<?> summary(@RequestParam String key) {
        if (!adminKey.equals(key)) {
            return ResponseEntity.status(403).body(Map.of("error", "Invalid key"));
        }
        List<OrderEntity> all = orderRepository.findAll();
        long paidOrders = all.stream().filter(OrderEntity::isPaid).count();
        int paidPacks = all.stream().filter(OrderEntity::isPaid).mapToInt(OrderEntity::getQuantity).sum();
        return ResponseEntity.ok(Map.of(
                "totalOrdersStarted", all.size(),
                "ordersPaid", paidOrders,
                "packsSold", paidPacks,
                "orders", all
        ));
    }
}