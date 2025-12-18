package io.github.kacper47.restaurant.reservations.repository;

import io.github.kacper47.restaurant.reservations.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByPhone(String phone);
}
