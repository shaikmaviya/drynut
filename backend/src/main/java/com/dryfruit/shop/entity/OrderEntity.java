package com.dryfruit.shop.entity;

import java.time.Instant;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class OrderEntity {

    @Id
    private String orderId;
    private String customerName;
    private String customerPhone;

    @jakarta.persistence.Column(length = 500)
    private String address;
    private String pincode;

    private int quantity;
    private int amountInPaise;
    private int originalAmountInPaise;
    private String couponCode;
    private int discountInPaise;
    private boolean paid;

    // One of: CONFIRMED, PACKED, SHIPPED, DELIVERED
    private String status = "CONFIRMED";

    private Instant createdAt = Instant.now();

    public OrderEntity() {}

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public int getAmountInPaise() { return amountInPaise; }
    public void setAmountInPaise(int amountInPaise) { this.amountInPaise = amountInPaise; }

    public boolean isPaid() { return paid; }
    public void setPaid(boolean paid) { this.paid = paid; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    public int getOriginalAmountInPaise() { return originalAmountInPaise; }
    public void setOriginalAmountInPaise(int originalAmountInPaise) { this.originalAmountInPaise = originalAmountInPaise; }

    public String getCouponCode() { return couponCode; }
    public void setCouponCode(String couponCode) { this.couponCode = couponCode; }

    public int getDiscountInPaise() { return discountInPaise; }
    public void setDiscountInPaise(int discountInPaise) { this.discountInPaise = discountInPaise; }
}