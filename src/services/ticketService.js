const delay = (ms = 500) => {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
};

// =============================
// TẠO THỜI GIAN KHỞI HÀNH MOCK
// =============================
// Dùng thời gian tương đối để dữ liệu demo
// không bị hết hạn theo ngày thực tế.
const createDepartureTime = (hoursFromNow) => {
  return new Date(
    Date.now() + hoursFromNow * 60 * 60 * 1000
  ).toISOString();
};

// =============================
// DỮ LIỆU VÉ MÔ PHỎNG
// =============================
let tickets = [
  {
    id: 1,
    route: "Hà Nội → Thái Nguyên",
    seat: "A01",
    price: 120000,

    departureTime: createDepartureTime(24),

    status: "Đã thanh toán",

    canCancel: true,

    refundStatus: "Chưa yêu cầu",

    electronicTicketCode: null
  },
  {
    id: 2,
    route: "Thái Nguyên → Hà Nội",
    seat: "B05",
    price: 120000,

    departureTime: createDepartureTime(48),

    status: "Đã thanh toán",

    canCancel: true,

    refundStatus: "Chưa yêu cầu",

    electronicTicketCode: null
  }
];

// =============================
// DANH SÁCH CHUYẾN MÔ PHỎNG
// =============================
const availableTrips = [
  {
    id: 1,
    route: "Hà Nội → Bắc Ninh",
    availableSeats: 5
  },
  {
    id: 2,
    route: "Hà Nội → Hải Phòng",
    availableSeats: 3
  },
  {
    id: 3,
    route: "Thái Nguyên → Bắc Giang",
    availableSeats: 0
  }
];

// =============================
// KIỂM TRA VÉ CÒN TRƯỚC
// GIỜ KHỞI HÀNH HAY KHÔNG
// =============================
export function isBeforeDeparture(ticket) {
  if (!ticket?.departureTime) {
    return false;
  }

  const departureTime = new Date(
    ticket.departureTime
  ).getTime();

  return Date.now() < departureTime;
}

// =============================
// KIỂM TRA ĐIỀU KIỆN HỦY
// =============================
export function canCancelTicket(ticket) {
  if (!ticket) {
    return false;
  }

  if (ticket.status === "Đã hủy") {
    return false;
  }

  if (!ticket.canCancel) {
    return false;
  }

  return isBeforeDeparture(ticket);
}

// =============================
// KIỂM TRA ĐIỀU KIỆN ĐỔI
// =============================
export function canChangeTicket(ticket) {
  if (!ticket) {
    return false;
  }

  if (ticket.status === "Đã hủy") {
    return false;
  }

  return isBeforeDeparture(ticket);
}

// =============================
// LẤY DANH SÁCH VÉ
// =============================
export async function getMyTickets() {
  await delay();

  return tickets.map((ticket) => ({
    ...ticket
  }));
}

// =============================
// LẤY DANH SÁCH CHUYẾN
// =============================
export async function getAvailableTrips() {
  await delay();

  return availableTrips.map((trip) => ({
    ...trip
  }));
}

// =============================
// HỦY VÉ
// =============================
export async function cancelTicket(ticketId) {
  await delay();

  const ticketIndex = tickets.findIndex(
    (ticket) => ticket.id === ticketId
  );

  if (ticketIndex === -1) {
    throw new Error(
      "Không tìm thấy vé cần hủy."
    );
  }

  const ticket = tickets[ticketIndex];

  if (ticket.status === "Đã hủy") {
    throw new Error(
      "Vé này đã được hủy trước đó."
    );
  }

  if (!isBeforeDeparture(ticket)) {
    throw new Error(
      "Không thể hủy vé vì chuyến xe đã đến hoặc qua giờ khởi hành."
    );
  }

  if (!ticket.canCancel) {
    throw new Error(
      "Vé không đủ điều kiện hủy."
    );
  }

  tickets[ticketIndex] = {
    ...ticket,

    status: "Đã hủy",

    canCancel: false,

    refundStatus:
      "Chờ xử lý theo quy định"
  };

  return {
    success: true,

    message: "Hủy vé thành công.",

    refundMessage:
      "Yêu cầu hoàn tiền đang chờ xử lý theo quy định.",

    ticket: {
      ...tickets[ticketIndex]
    }
  };
}

// =============================
// ĐỔI VÉ
// =============================
export async function changeTicket(
  ticketId,
  newTrip
) {
  await delay();

  if (!newTrip || newTrip.trim() === "") {
    throw new Error(
      "Vui lòng chọn chuyến mới."
    );
  }

  const ticketIndex = tickets.findIndex(
    (ticket) => ticket.id === ticketId
  );

  if (ticketIndex === -1) {
    throw new Error(
      "Không tìm thấy vé cần đổi."
    );
  }

  const ticket = tickets[ticketIndex];

  if (ticket.status === "Đã hủy") {
    throw new Error(
      "Không thể đổi chuyến cho vé đã hủy."
    );
  }

  if (!isBeforeDeparture(ticket)) {
    throw new Error(
      "Không thể đổi vé vì chuyến xe đã đến hoặc qua giờ khởi hành."
    );
  }

  const selectedTrip = availableTrips.find(
    (trip) =>
      trip.route === newTrip.trim()
  );

  if (!selectedTrip) {
    throw new Error(
      "Không tìm thấy chuyến đã chọn."
    );
  }

  if (selectedTrip.availableSeats <= 0) {
    throw new Error(
      "Chuyến này đã hết ghế. Vui lòng chọn chuyến khác."
    );
  }

  const newElectronicTicketCode =
    `DT${Date.now()}`;

  tickets[ticketIndex] = {
    ...ticket,

    route: selectedTrip.route,

    electronicTicketCode:
      newElectronicTicketCode
  };

  return {
    success: true,

    message: "Đổi vé thành công.",

    electronicTicketCode:
      newElectronicTicketCode,

    ticket: {
      ...tickets[ticketIndex]
    }
  };
}