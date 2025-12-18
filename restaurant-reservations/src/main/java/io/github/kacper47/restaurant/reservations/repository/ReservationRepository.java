package io.github.kacper47.restaurant.reservations.repository;

import io.github.kacper47.restaurant.reservations.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;


public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    boolean existsByTableIdAndDateAndTime(Long tableId, LocalDate date, LocalTime time);

    @Transactional
    long deleteByCodeAndCustomerPhone(String code, String phone);

    @Query("select distinct r.table.id from Reservation r where r.date = :date and r.time = :time and r.status = 'ACTIVE'")
    List<Long> findBusyTableIds(@Param("date") LocalDate date, @Param("time") LocalTime time);

    List<Reservation> findByDate(LocalDate date);

    Optional<Reservation> findByCodeAndCustomerPhone(String code, String phone);

    boolean existsByCode(String code);
}
