package com.dryfruit.shop.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.dryfruit.shop.entity.CouponEntity;

public interface CouponRepository extends JpaRepository<CouponEntity, String> {
}