package io.github.kacper47.restaurant.reservations.repository;

import io.github.kacper47.restaurant.reservations.entity.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {
}
