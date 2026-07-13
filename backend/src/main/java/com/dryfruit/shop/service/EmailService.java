package com.dryfruit.shop.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import com.dryfruit.shop.entity.OrderEntity;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    @Value("${app.notify-email}")
    private String notifyEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendOrderNotification(OrderEntity order) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(notifyEmail);
            message.setSubject("New order - " + order.getQuantity() + " pack(s) - Rs " + (order.getAmountInPaise() / 100.0));
            message.setText(
                    "New paid order received.\n\n" +
                    "Order ID: " + order.getOrderId() + "\n" +
                    "Customer: " + order.getCustomerName() + "\n" +
                    "Phone: " + order.getCustomerPhone() + "\n" +
                    "Address: " + order.getAddress() + ", " + order.getPincode() + "\n" +
                    "Quantity: " + order.getQuantity() + " pack(s)\n" +
                    "Amount paid: Rs " + (order.getAmountInPaise() / 100.0) +
                        (order.getCouponCode() != null ? " (coupon: " + order.getCouponCode() + ")" : "") + "\n" +
                    "Status: " + order.getStatus()
            );
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("Could not send order notification email: " + e.getMessage());
            e.printStackTrace();
}        
    }
}