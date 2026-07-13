package com.dryfruit.shop.repository;

import com.dryfruit.shop.entity.OrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<OrderEntity, String> {
    List<OrderEntity> findByCustomerPhoneOrderByCreatedAtDesc(String customerPhone);
}