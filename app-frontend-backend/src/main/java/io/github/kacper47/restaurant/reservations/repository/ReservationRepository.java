package io.github.kacper47.restaurant.reservations.repository;

import io.github.kacper47.restaurant.reservations.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;


public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    @Transactional
    long deleteByCodeAndCustomerPhone(String code, String phone);

    List<Reservation> findByDate(LocalDate date);
    List<Reservation> findByDateAndStatus(LocalDate date, String status);
    List<Reservation> findByTableIdAndDateAndStatus(Long tableId, LocalDate date, String status);

    Optional<Reservation> findByCodeAndCustomerPhone(String code, String phone);

    boolean existsByCode(String code);
}
