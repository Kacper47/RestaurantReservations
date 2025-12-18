package io.github.kacper47.restaurant.reservations.repository;

import io.github.kacper47.restaurant.reservations.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, Long> {
}

