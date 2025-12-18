package io.github.kacper47.restaurant.reservations.controller;

import io.github.kacper47.restaurant.reservations.entity.Reservation;
import io.github.kacper47.restaurant.reservations.entity.RestaurantTable;
import io.github.kacper47.restaurant.reservations.repository.ReservationRepository;
import io.github.kacper47.restaurant.reservations.repository.RestaurantTableRepository;
import io.github.kacper47.restaurant.reservations.entity.Review;
import io.github.kacper47.restaurant.reservations.repository.ReviewRepository;
import io.github.kacper47.restaurant.reservations.entity.Customer;
import io.github.kacper47.restaurant.reservations.repository.CustomerRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;


import java.security.SecureRandom;
import java.util.Optional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;





@RestController
@RequestMapping("/api")
public class ReservationController {

    private final ReservationRepository reservationRepository;
    private final RestaurantTableRepository tableRepository;
    private final ReviewRepository reviewRepository;
    private final CustomerRepository customerRepository;

    public ReservationController(ReservationRepository reservationRepository,
                                 RestaurantTableRepository tableRepository, ReviewRepository reviewRepository, CustomerRepository customerRepository) {
        this.reservationRepository = reservationRepository;
        this.tableRepository = tableRepository;
        this.reviewRepository = reviewRepository;
        this.customerRepository = customerRepository;
    }

    @PostMapping("/tables")
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantTable createTable(@RequestBody CreateTableRequest req) {
        RestaurantTable t = new RestaurantTable();
        t.setSeats(req.seats);
        t.setAvailable(true);
        return tableRepository.save(t);
    }

    @GetMapping("/tables")
    public List<RestaurantTable> listTables() {
        return tableRepository.findAll();
    }

    @GetMapping("/tables/available")
    public List<RestaurantTable> availableTables(@RequestParam LocalDate date,
                                                 @RequestParam LocalTime time) {
        List<Long> busy = reservationRepository.findBusyTableIds(date, time);
        return tableRepository.findAll().stream()
                .filter(t -> !busy.contains(t.getId()))
                .toList();
    }

//    public List<RestaurantTable> listTables() {
//        return tableRepository.findAll();
//    }

    @Transactional
    @PostMapping("/reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public Reservation createReservation(@RequestBody CreateReservationRequest req) {
        RestaurantTable table = tableRepository.findById(req.tableId)
                .orElseThrow(() -> new IllegalArgumentException("Table not found: " + req.tableId));

        Customer customer = customerRepository.findByPhone(req.phone)
                .orElseGet(() -> {
                    Customer c = new Customer();
                    c.setPhone(req.phone);
                    c.setName(req.customerName);
                    return customerRepository.save(c);
                });

        // jeśli klient istnieje, możesz zaktualizować imię (opcjonalnie):
        if (customer.getName() == null || customer.getName().isBlank()) {
            customer.setName(req.customerName);
            customerRepository.save(customer);
        }

        Reservation r = new Reservation();
        r.setCustomer(customer);
        r.setDate(LocalDate.parse(req.date));
        r.setTime(LocalTime.parse(req.time));
        r.setGuests(req.guests);
        r.setTable(table);
        r.setStatus("ACTIVE");
        r.setMeetingType(req.meetingType);
        r.setDescription(req.description);
        r.setCode(generateUniqueCode());

        boolean conflict = reservationRepository.existsByTableIdAndDateAndTime(
                table.getId(), r.getDate(), r.getTime()
        );
        if (conflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stolik zajęty w tym terminie");
        }

        return reservationRepository.save(r);
    }

    @GetMapping("/reservations")
    public List<Reservation> listReservations(@RequestParam("date") String date) {
        return reservationRepository.findByDate(LocalDate.parse(date));
    }

    @DeleteMapping("/reservations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelReservation(@PathVariable Long id) {
        Reservation r = reservationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Reservation not found: " + id));
        r.setStatus("CANCELED");
        reservationRepository.save(r);
    }

    public static class CancelReservationRequest {
        public String phone;
        public String code;
    }

    @DeleteMapping("/reservations/by-code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteByPhoneAndCode(@RequestBody CancelReservationRequest req) {
        if (req == null || req.phone == null || req.code == null || req.phone.isBlank() || req.code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "phone and code required");
        }

        long deleted = reservationRepository.deleteByCodeAndCustomerPhone(req.code, req.phone);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
    }

    @PutMapping("/reservations/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelByCode(@RequestBody CancelReservationRequest req) {
        Reservation r = reservationRepository.findByCodeAndCustomerPhone(req.code, req.phone)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));

        r.setStatus("CANCELED");
        reservationRepository.save(r);
    }

    public static class CreateTableRequest {
        public int seats;
    }

    public static class CreateReservationRequest {
        public String customerName;
        public String phone;
        public String date; // YYYY-MM-DD
        public String time; // HH:MM
        public int guests;
        public long tableId;
        public String meetingType;
        public String description;
    }

    @Value("${app.admin.password}")
    private String adminPassword;

    private void requireAdmin(String pass) {
        if (pass == null || !pass.equals(adminPassword)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin password");
        }
    }

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom rng = new SecureRandom();

    private String generateCode() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(CODE_CHARS.charAt(rng.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }

    private String generateUniqueCode() {
        for (int i = 0; i < 20; i++) {
            String c = generateCode();
            if (!reservationRepository.existsByCode(c)) {
                return c;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate reservation code");
    }

    @GetMapping("/reservations/lookup")
    public Reservation lookup(@RequestParam("phone") String phone,
                              @RequestParam("code") String code) {
        return reservationRepository.findByCodeAndCustomerPhone(code, phone)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
    }

    @PutMapping("/reservations/edit")
    public Reservation editByCode(@RequestBody EditReservationRequest req) {
        Reservation r = reservationRepository.findByCodeAndCustomerPhone(req.code, req.phone)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));

        if (req.date != null && !req.date.isBlank()) {
            r.setDate(java.time.LocalDate.parse(req.date));
        }
        if (req.time != null && !req.time.isBlank()) {
            r.setTime(java.time.LocalTime.parse(req.time));
        }
        if (req.guests > 0) {
            r.setGuests(req.guests);
        }
        if (req.tableId != null) {
            RestaurantTable table = tableRepository.findById(req.tableId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table not found: " + req.tableId));

            int effectiveGuests = (req.guests > 0) ? req.guests : r.getGuests();

            if (effectiveGuests > table.getSeats()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Too many guests for this table (seats=" + table.getSeats() + ", guests=" + effectiveGuests + ")"
                );
            }
            r.setTable(table);
        }

        // jeśli zmieniasz guests, też sprawdź czy mieści się na aktualnym stoliku
        if (req.guests > 0) {
            if (req.guests > r.getTable().getSeats()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Too many guests for current table (seats=" + r.getTable().getSeats() + ", guests=" + req.guests + ")"
                );
            }
            r.setGuests(req.guests);
        }


        if (req.meetingType != null && !req.meetingType.isBlank()) {
            r.setMeetingType(req.meetingType);
        }
        if (req.description != null && !req.description.isBlank()) {
            r.setDescription(req.description);
        }

        return reservationRepository.save(r);
    }

    public static class EditReservationRequest {
        public String phone;
        public String code;
        public String date;   // YYYY-MM-DD (opcjonalnie)
        public String time;   // HH:MM (opcjonalnie)
        public int guests;    // >0 (opcjonalnie)
        public Long tableId;  // opcjonalnie
        public String meetingType; // opcjonalnie
        public String description; // opcjonalnie
    }

//    @GetMapping("/admin/reservations")
//    public List<Reservation> adminListReservations(@RequestHeader(value = "X-ADMIN-PASS", required = false) String pass,
//                                                   @RequestParam("date") String date) {
//        requireAdmin(pass);
//        return reservationRepository.findByDate(java.time.LocalDate.parse(date));
//    }

//    @DeleteMapping("/admin/reservations/{id}")
//    @ResponseStatus(HttpStatus.NO_CONTENT)
//    public void adminCancel(@RequestHeader(value = "X-ADMIN-PASS", required = false) String pass,
//                            @PathVariable Long id) {
//        requireAdmin(pass);
//        Reservation r = reservationRepository.findById(id)
//                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found: " + id));
//        r.setStatus("CANCELED");
//        reservationRepository.save(r);
//    }

    @PostMapping("/reviews")
    public Review addReview(@RequestBody Review req) {
        if (req.getRate() < 1 || req.getRate() > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "rate must be 1..5");
        }
        return reviewRepository.save(req);
    }

    @GetMapping("/reviews")
    public List<Review> listReviews() {
        return reviewRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }

}
