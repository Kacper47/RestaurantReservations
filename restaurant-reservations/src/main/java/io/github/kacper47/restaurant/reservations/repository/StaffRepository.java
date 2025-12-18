package io.github.kacper47.restaurant.reservations.repository;

import io.github.kacper47.restaurant.reservations.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StaffRepository extends JpaRepository<Staff, Long> {
    Optional<Staff> findByCode(String code);
}
