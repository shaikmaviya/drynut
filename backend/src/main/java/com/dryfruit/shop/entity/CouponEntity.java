package com.dryfruit.shop.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class CouponEntity {

    @Id
    private String code;

    private String discountType; // "PERCENT" or "FLAT"
    private int discountValue;   // PERCENT: e.g. 10 for 10%. FLAT: whole rupees, e.g. 5
    private boolean active = true;

    public CouponEntity() {}

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDiscountType() { return discountType; }
    public void setDiscountType(String discountType) { this.discountType = discountType; }

    public int getDiscountValue() { return discountValue; }
    public void setDiscountValue(int discountValue) { this.discountValue = discountValue; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}