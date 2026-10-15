import {
  describe,
  expect,
  it
} from "vitest";

import {
  getMyTickets,
  getAvailableTrips,
  cancelTicket,
  changeTicket,
  isBeforeDeparture,
  canCancelTicket,
  canChangeTicket
} from "./ticketService";

describe("ticketService", () => {
  it("lấy được danh sách vé đầy đủ thông tin", async () => {
    const tickets = await getMyTickets();

    expect(Array.isArray(tickets)).toBe(true);

    expect(
      tickets.length
    ).toBeGreaterThan(0);

    expect(tickets[0]).toHaveProperty(
      "price"
    );

    expect(tickets[0]).toHaveProperty(
      "refundStatus"
    );

    expect(tickets[0]).toHaveProperty(
      "electronicTicketCode"
    );

    expect(tickets[0]).toHaveProperty(
      "departureTime"
    );
  });

  it("lấy được danh sách chuyến và số ghế trống", async () => {
    const trips =
      await getAvailableTrips();

    expect(Array.isArray(trips)).toBe(true);

    expect(
      trips.length
    ).toBeGreaterThan(0);

    expect(trips[0]).toHaveProperty(
      "availableSeats"
    );
  });

  it("nhận biết vé còn trước giờ khởi hành", () => {
    const futureTicket = {
      departureTime: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString()
    };

    expect(
      isBeforeDeparture(futureTicket)
    ).toBe(true);
  });

  it("nhận biết vé đã qua giờ khởi hành", () => {
    const expiredTicket = {
      departureTime: new Date(
        Date.now() - 60 * 60 * 1000
      ).toISOString()
    };

    expect(
      isBeforeDeparture(expiredTicket)
    ).toBe(false);
  });

  it("cho phép hủy vé hợp lệ trước giờ khởi hành", () => {
    const ticket = {
      status: "Đã thanh toán",
      canCancel: true,

      departureTime: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString()
    };

    expect(
      canCancelTicket(ticket)
    ).toBe(true);
  });

  it("không cho hủy vé sau giờ khởi hành", () => {
    const ticket = {
      status: "Đã thanh toán",
      canCancel: true,

      departureTime: new Date(
        Date.now() - 60 * 60 * 1000
      ).toISOString()
    };

    expect(
      canCancelTicket(ticket)
    ).toBe(false);
  });

  it("không cho hủy lại vé đã hủy", () => {
    const ticket = {
      status: "Đã hủy",
      canCancel: false,

      departureTime: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString()
    };

    expect(
      canCancelTicket(ticket)
    ).toBe(false);
  });

  it("cho phép đổi vé trước giờ khởi hành", () => {
    const ticket = {
      status: "Đã thanh toán",

      departureTime: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString()
    };

    expect(
      canChangeTicket(ticket)
    ).toBe(true);
  });

  it("không cho đổi vé sau giờ khởi hành", () => {
    const ticket = {
      status: "Đã thanh toán",

      departureTime: new Date(
        Date.now() - 60 * 60 * 1000
      ).toISOString()
    };

    expect(
      canChangeTicket(ticket)
    ).toBe(false);
  });

  it("đổi vé sang chuyến còn ghế và sinh vé điện tử mới", async () => {
    const result = await changeTicket(
      1,
      "Hà Nội → Bắc Ninh"
    );

    expect(result.success).toBe(true);

    expect(result.ticket.id).toBe(1);

    expect(result.ticket.route).toBe(
      "Hà Nội → Bắc Ninh"
    );

    expect(
      result.electronicTicketCode
    ).toBeDefined();

    expect(
      result.electronicTicketCode
    ).toMatch(/^DT\d+$/);

    expect(
      result.ticket.electronicTicketCode
    ).toBe(
      result.electronicTicketCode
    );

    const tickets =
      await getMyTickets();

    const changedTicket =
      tickets.find(
        (ticket) => ticket.id === 1
      );

    expect(
      changedTicket
    ).toBeDefined();

    expect(
      changedTicket.route
    ).toBe(
      "Hà Nội → Bắc Ninh"
    );

    expect(
      changedTicket.electronicTicketCode
    ).toBe(
      result.electronicTicketCode
    );
  });

  it("không cho đổi sang chuyến hết ghế", async () => {
    await expect(
      changeTicket(
        1,
        "Thái Nguyên → Bắc Giang"
      )
    ).rejects.toThrow(
      "Chuyến này đã hết ghế"
    );
  });

  it("hủy vé và tạo yêu cầu hoàn tiền", async () => {
    const result =
      await cancelTicket(2);

    expect(result.success).toBe(true);

    expect(result.ticket.id).toBe(2);

    expect(
      result.ticket.status
    ).toBe("Đã hủy");

    expect(
      result.ticket.canCancel
    ).toBe(false);

    expect(
      result.ticket.refundStatus
    ).toBe(
      "Chờ xử lý theo quy định"
    );

    expect(
      result.refundMessage
    ).toBe(
      "Yêu cầu hoàn tiền đang chờ xử lý theo quy định."
    );

    const tickets =
      await getMyTickets();

    const cancelledTicket =
      tickets.find(
        (ticket) => ticket.id === 2
      );

    expect(
      cancelledTicket
    ).toBeDefined();

    expect(
      cancelledTicket.status
    ).toBe("Đã hủy");

    expect(
      cancelledTicket.refundStatus
    ).toBe(
      "Chờ xử lý theo quy định"
    );
  });
});