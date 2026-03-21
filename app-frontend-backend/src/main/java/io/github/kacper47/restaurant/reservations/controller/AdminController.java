package io.github.kacper47.restaurant.reservations.controller;

import io.github.kacper47.restaurant.reservations.entity.Reservation;
import io.github.kacper47.restaurant.reservations.entity.RestaurantTable;
import io.github.kacper47.restaurant.reservations.repository.ReservationRepository;
import io.github.kacper47.restaurant.reservations.repository.RestaurantTableRepository;
import io.github.kacper47.restaurant.reservations.repository.StaffRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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

    @GetMapping("/staff/login")
    public StaffDto staffLogin(@RequestParam String code,
                               @RequestParam(required = false) String name) {
        String normalizedName = name == null ? null : name.trim();
        return staffRepository.findByCode(code)
                .filter(s -> normalizedName == null || s.getName().equalsIgnoreCase(normalizedName))
                .map(s -> new StaffDto(s.getRole(), s.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bad code or name"));
    }

    public record StaffDto(String role, String name) {}

    @GetMapping("/admin/tables")
    public List<RestaurantTable> tables() {
        return tableRepository.findAll();
    }

    @GetMapping("/admin/reservations")
    public List<AdminReservationDto> reservationsByDate(@RequestParam String date) {
        LocalDate d = LocalDate.parse(date);
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

    @GetMapping("/admin/dashboard")
    public AdminDashboardDto dashboard(@RequestParam String date) {
        return new AdminDashboardDto(
                tableRepository.findAll(),
                reservationsByDate(date)
        );
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

    public record AdminDashboardDto(
            List<RestaurantTable> tables,
            List<AdminReservationDto> reservations
    ) {}

    @DeleteMapping("/admin/reservations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReservation(@PathVariable Long id) {
        if (!reservationRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
        reservationRepository.deleteById(id);
    }
}
