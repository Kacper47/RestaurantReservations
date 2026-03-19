package io.github.kacper47.restaurant.reservations.controller;

import io.github.kacper47.restaurant.reservations.entity.Customer;
import io.github.kacper47.restaurant.reservations.entity.Reservation;
import io.github.kacper47.restaurant.reservations.entity.RestaurantTable;
import io.github.kacper47.restaurant.reservations.entity.Review;
import io.github.kacper47.restaurant.reservations.repository.CustomerRepository;
import io.github.kacper47.restaurant.reservations.repository.ReservationRepository;
import io.github.kacper47.restaurant.reservations.repository.RestaurantTableRepository;
import io.github.kacper47.restaurant.reservations.repository.ReviewRepository;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ReservationController {

    private static final String LARGE_RESERVATION_MESSAGE =
            "Dla rezerwacji powyżej 10 osób prosimy o kontakt telefoniczny.";

    private final ReservationRepository reservationRepository;
    private final RestaurantTableRepository tableRepository;
    private final ReviewRepository reviewRepository;
    private final CustomerRepository customerRepository;

    @Value("${app.admin.password}")
    private String adminPassword;

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final SecureRandom rng = new SecureRandom();

    public ReservationController(ReservationRepository reservationRepository,
                                 RestaurantTableRepository tableRepository,
                                 ReviewRepository reviewRepository,
                                 CustomerRepository customerRepository) {
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
        return tableRepository.findAll().stream()
                .sorted(Comparator.comparingInt(RestaurantTable::getSeats).thenComparing(RestaurantTable::getId))
                .toList();
    }

    @GetMapping("/tables/available")
    public List<RestaurantTable> availableTables(@RequestParam LocalDate date,
                                                 @RequestParam LocalTime time,
                                                 @RequestParam(required = false) Integer guests) {
        List<Long> busy = reservationRepository.findBusyTableIds(date, time);
        return tableRepository.findAll().stream()
                .filter(RestaurantTable::isAvailable)
                .filter(t -> !busy.contains(t.getId()))
                .filter(t -> guests == null || guests <= 0 || t.getSeats() >= guests)
                .sorted(Comparator.comparingInt(RestaurantTable::getSeats).thenComparing(RestaurantTable::getId))
                .toList();
    }

    @Transactional
    @PostMapping("/reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public Reservation createReservation(@RequestBody CreateReservationRequest req) {
        String normalizedPhone = normalizePhone(req.phone);
        validateGuests(req.guests);

        RestaurantTable table = tableRepository.findById(req.tableId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table not found: " + req.tableId));

        if (req.guests > table.getSeats()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wybrany stolik jest za mały dla tej liczby gości");
        }

        Customer customer = customerRepository.findByPhone(normalizedPhone)
                .orElseGet(() -> {
                    Customer c = new Customer();
                    c.setPhone(normalizedPhone);
                    c.setName(req.customerName);
                    return customerRepository.save(c);
                });

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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found: " + id));
        r.setStatus("CANCELED");
        reservationRepository.save(r);
    }

    @DeleteMapping("/reservations/by-code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteByPhoneAndCode(@RequestBody CancelReservationRequest req) {
        if (req == null || req.phone == null || req.code == null || req.phone.isBlank() || req.code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "phone and code required");
        }

        long deleted = reservationRepository.deleteByCodeAndCustomerPhone(req.code, normalizePhone(req.phone));
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found");
        }
    }

    @PutMapping("/reservations/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelByCode(@RequestBody CancelReservationRequest req) {
        Reservation r = reservationRepository.findByCodeAndCustomerPhone(req.code, normalizePhone(req.phone))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));

        r.setStatus("CANCELED");
        reservationRepository.save(r);
    }

    @GetMapping("/reservations/lookup")
    public Reservation lookup(@RequestParam("phone") String phone,
                              @RequestParam("code") String code) {
        return reservationRepository.findByCodeAndCustomerPhone(code, normalizePhone(phone))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
    }

    @PutMapping("/reservations/edit")
    public Reservation editByCode(@RequestBody EditReservationRequest req) {
        Reservation r = reservationRepository.findByCodeAndCustomerPhone(req.code, normalizePhone(req.phone))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));

        if (req.date != null && !req.date.isBlank()) {
            r.setDate(LocalDate.parse(req.date));
        }
        if (req.time != null && !req.time.isBlank()) {
            r.setTime(LocalTime.parse(req.time));
        }

        if (req.guests > 0) {
            validateGuests(req.guests);
        }

        if (req.tableId != null) {
            RestaurantTable table = tableRepository.findById(req.tableId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table not found: " + req.tableId));

            int effectiveGuests = req.guests > 0 ? req.guests : r.getGuests();
            if (effectiveGuests > table.getSeats()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Too many guests for this table (seats=" + table.getSeats() + ", guests=" + effectiveGuests + ")"
                );
            }

            boolean conflict = reservationRepository.existsByTableIdAndDateAndTime(
                    table.getId(), r.getDate(), r.getTime()
            );
            if (conflict && !table.getId().equals(r.getTable().getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Stolik zajęty w tym terminie");
            }

            r.setTable(table);
        }

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

    private void requireAdmin(String pass) {
        if (pass == null || !pass.equals(adminPassword)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin password");
        }
    }

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

    private String normalizePhone(String phone) {
        if (phone == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Telefon jest wymagany");
        }
        String normalized = phone.replaceAll("\\D", "");
        if (normalized.length() != 9) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Telefon musi mieć dokładnie 9 cyfr");
        }
        return normalized;
    }

    private void validateGuests(int guests) {
        if (guests < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Liczba gości musi być większa od zera");
        }
        if (guests > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, LARGE_RESERVATION_MESSAGE);
        }
    }

    public static class CancelReservationRequest {
        public String phone;
        public String code;
    }

    public static class CreateTableRequest {
        public int seats;
    }

    public static class CreateReservationRequest {
        public String customerName;
        public String phone;
        public String date;
        public String time;
        public int guests;
        public long tableId;
        public String meetingType;
        public String description;
    }

    public static class EditReservationRequest {
        public String phone;
        public String code;
        public String date;
        public String time;
        public int guests;
        public Long tableId;
        public String meetingType;
        public String description;
    }
}
