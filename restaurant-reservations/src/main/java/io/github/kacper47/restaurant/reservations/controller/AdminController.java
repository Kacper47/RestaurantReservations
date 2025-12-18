package io.github.kacper47.restaurant.reservations.controller;

import io.github.kacper47.restaurant.reservations.entity.Reservation;
import io.github.kacper47.restaurant.reservations.entity.RestaurantTable;
import io.github.kacper47.restaurant.reservations.repository.ReservationRepository;
import io.github.kacper47.restaurant.reservations.repository.RestaurantTableRepository;
import io.github.kacper47.restaurant.reservations.repository.StaffRepository;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class AdminController {

    private final ReservationRepository reservationRepository;
    private final RestaurantTableRepository tableRepository;
    private final StaffRepository staffRepository;

    public AdminController(ReservationRepository reservationRepository,
                           RestaurantTableRepository tableRepository,
                           StaffRepository staffRepository) {
        this.reservationRepository = reservationRepository;
        this.tableRepository = tableRepository;
        this.staffRepository = staffRepository;
    }

    // ====== "Logowanie" po kodzie (mega proste) ======
    // GET /api/staff/login?code=1234  -> { "role":"Kelner", "name":"Łukasz" }
    @GetMapping("/staff/login")
    public StaffDto staffLogin(@RequestParam String code) {
        return staffRepository.findByCode(code)
                .map(s -> new StaffDto(s.getRole(), s.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bad code"));
    }

    public record StaffDto(String role, String name) {}

    // ====== Stoliki ======
    // GET /api/admin/tables
    @GetMapping("/admin/tables")
    public List<RestaurantTable> tables() {
        return tableRepository.findAll();
    }

    // ====== Rezerwacje na dzień (z klientem -> bez undefined) ======
    // GET /api/admin/reservations?date=2025-12-20
    @GetMapping("/admin/reservations")
    public List<AdminReservationDto> reservationsByDate(@RequestParam String date) {
        LocalDate d = LocalDate.parse(date);

        // potrzebujesz w ReservationRepository: findByDate(d)
        List<Reservation> list = reservationRepository.findByDate(d);

        return list.stream().map(r -> new AdminReservationDto(
                r.getId(),
                r.getCode(),
                r.getStatus(),
                r.getDate().toString(),
                r.getTime().toString(),
                r.getGuests(),
                r.getTable().getId(),
                r.getTable().getSeats(),
                r.getCustomer().getName(),
                r.getCustomer().getPhone()
        )).toList();
    }

    public record AdminReservationDto(
            Long id,
            String code,
            String status,
            String date,
            String time,
            int guests,
            Long tableId,
            int tableSeats,
            String customerName,
            String customerPhone
    ) {}

    // ====== Anuluj (najprościej: usuń z bazy po ID) ======
    // DELETE /api/admin/reservations/123
    @DeleteMapping("/admin/reservations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReservation(@PathVariable Long id) {
        if (!reservationRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        reservationRepository.deleteById(id);
    }
}
