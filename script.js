
/* GHN ATTENDANCE - FRONTEND V16 */

const API_URL = "https://script.google.com/macros/s/AKfycbz-jo3LBDMwxjaY3UDqDMaNXDY2_h8ioZjV39RsESq9n0cK8taFyYc7sCQY_Alxr0i4Mg/exec";

let currentEmployee = null;
let currentShifts = [];
let checkoutEmployeeId = "";
let checkoutReady = false;

const $ = (id) => document.getElementById(id);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "-";
}

function setBusy(id, busy, busyText) {
  const el = $(id);
  if (!el) return;

  el.disabled = busy;

  if (busyText) {
    el.dataset.normalText ||= el.innerHTML;
  }

  if (busy) {
    el.innerHTML = busyText;
  } else if (el.dataset.normalText) {
    el.innerHTML = el.dataset.normalText;
  }
}

function showMessage(message, title = "THÔNG BÁO") {
  document.getElementById("popupMessage")?.remove();

  const popup = document.createElement("div");
  popup.id = "popupMessage";

  popup.innerHTML = `
    <div style="
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.65);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:999999;
      padding:20px;
    ">
      <div style="
        width:100%;
        max-width:420px;
        background:#0b1f26;
        border:1px solid #00d2d3;
        border-radius:18px;
        padding:24px;
        color:white;
        text-align:center;
      ">
        <h4 style="color:#00d2d3;font-weight:800">
          ${esc(title)}
        </h4>

        <div style="white-space:pre-line;line-height:1.6">
          ${esc(message)}
        </div>

        <button
          type="button"
          style="
            margin-top:20px;
            width:100%;
            padding:12px;
            border:0;
            border-radius:10px;
            background:#00d2d3;
            font-weight:bold;
          "
          onclick="document.getElementById('popupMessage').remove()"
        >
          ĐÓNG
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
}

function normalizeResult(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (_) {}
  }

  return data;
}

/* GET API bằng JSONP */
function apiGet(action, params = {}) {
  return new Promise((resolve, reject) => {

    const callbackName =
      "ghn_cb_" + Date.now() + "_" +
      Math.floor(Math.random() * 100000);

    const script = document.createElement("script");

    const query = new URLSearchParams({
      action,
      ...params,
      callback: callbackName
    });

    let finished = false;

    const cleanup = () => {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error("Kết nối máy chủ quá thời gian. Vui lòng thử lại.")
      );
    }, 20000);

    window[callbackName] = (result) => {
      cleanup();
      resolve(normalizeResult(result));
    };

    script.onerror = () => {
      cleanup();
      reject(
        new Error("Không thể kết nối máy chủ. Vui lòng tải lại trang.")
      );
    };

    script.src =
      API_URL +
      (API_URL.includes("?") ? "&" : "?") +
      query.toString();

    document.body.appendChild(script);
  });
}

/* CHECK IN / CHECK OUT dùng GET JSONP theo API hiện tại */
async function apiPost(action, params = {}) {
  return await apiGet(action, params);
}

function requireSuccess(result) {
  if (!result || result.success !== true) {
    throw new Error(
      result?.message || "Không thể thực hiện thao tác. Vui lòng thử lại."
    );
  }

  return result;
}

/* RESET THÔNG TIN CHECK IN */
function resetCheckInDetails() {

  currentEmployee = null;
  currentShifts = [];

  $("employeeInfo").classList.add("hidden");
  $("shiftGroup").classList.add("hidden");

  $("shiftSelect").innerHTML =
    '<option value="">-- Chọn ca làm việc --</option>';

  $("checkInBtn").disabled = true;

  setText("lookupStatus", "");
}

/* TRA CỨU NHÂN VIÊN */
async function lookupEmployee() {

  const employeeId = $("employeeId").value.trim();

  if (!employeeId) {
    return showMessage("Vui lòng nhập mã nhân viên.");
  }

  resetCheckInDetails();

  setBusy(
    "lookupBtn",
    true,
    '<i class="bi bi-hourglass-split"></i> ĐANG TRA CỨU...'
  );

  setText(
    "lookupStatus",
    "Đang kiểm tra thông tin nhân viên..."
  );

  try {

    const empResult = requireSuccess(
      await apiGet("getEmployee", { employeeId })
    );

    const emp =
      empResult.employee ||
      empResult.data?.employee;

    if (!emp) {
      throw new Error("Không nhận được thông tin nhân viên.");
    }

    currentEmployee = emp;

    setText("empName", emp.name);
    setText("empId", emp.id || employeeId);
    setText("empWarehouse", emp.warehouse);
    setText("empWorkPoint", emp.workPoint);
    setText("empManager", emp.manager);
    setText("empGroup", emp.workGroup);

    $("employeeInfo").classList.remove("hidden");

    /* LẤY DANH SÁCH CA THEO NHÂN VIÊN */
    const shiftResult = requireSuccess(
      await apiGet("getShifts", { employeeId })
    );

    currentShifts = Array.isArray(shiftResult.shifts)
      ? shiftResult.shifts
      : [];

    if (!currentShifts.length) {
      throw new Error(
        "Nhân viên chưa được thiết lập ca làm việc tại điểm làm việc này."
      );
    }

    $("shiftSelect").innerHTML =
      '<option value="">-- Chọn ca làm việc --</option>' +

      currentShifts.map(s => `
        <option value="${esc(s.shift)}">
          ${esc(s.shift)}
          ${s.breakTime
            ? " (Nghỉ: " + esc(s.breakTime) + ")"
            : ""}
        </option>
      `).join("");

    $("shiftGroup").classList.remove("hidden");

    setText(
      "lookupStatus",
      "Đã tìm thấy nhân viên. Vui lòng chọn ca làm việc."
    );

  } catch (err) {

    resetCheckInDetails();

    setText(
      "lookupStatus",
      err.message || "Có lỗi xảy ra."
    );

    showMessage(
      err.message || "Có lỗi xảy ra khi tra cứu nhân viên."
    );

  } finally {

    setBusy("lookupBtn", false);
  }
}

/* KIỂM TRA ĐIỀU KIỆN CHECK IN */
function updateCheckInButton() {

  $("checkInBtn").disabled = !(
    currentEmployee &&
    $("shiftSelect").value
  );
}

/* CHECK IN */
async function checkIn() {

  if (!currentEmployee) {
    return showMessage("Vui lòng tra cứu nhân viên trước.");
  }

  const shift = $("shiftSelect").value;

  if (!shift) {
    return showMessage("Vui lòng chọn ca làm việc.");
  }

  if (!confirm(
    `Xác nhận CHECK IN cho ${currentEmployee.name} - ca ${shift}?`
  )) {
    return;
  }

  setBusy(
    "checkInBtn",
    true,
    '<i class="bi bi-hourglass-split"></i> ĐANG GHI NHẬN...'
  );

  try {

    const result = requireSuccess(
      await apiPost("checkIn", {
        employeeId: currentEmployee.id,
        shift: shift
      })
    );

    showMessage(
      result.message || "Check In thành công!",
      "CHECK IN THÀNH CÔNG"
    );

    $("employeeId").value = "";
    $("checkInStatus").textContent = "";

    resetCheckInDetails();

  } catch (err) {

    showMessage(
      err.message || "Check In chưa thành công."
    );

  } finally {

    setBusy("checkInBtn", false);
    updateCheckInButton();
  }
}

/* RESET CHECK OUT */
function checkoutEmpty(
  message = "Nhập mã nhân viên để kiểm tra ca làm việc cần Check Out."
) {

  $("checkoutInfo").innerHTML = `
    <div class="empty-state">
      <i class="bi bi-clock-history"></i>
      <h5>CHƯA CÓ THÔNG TIN</h5>
      <p>${esc(message)}</p>
    </div>
  `;

  $("checkOutBtn").classList.add("hidden");

  checkoutReady = false;
  checkoutEmployeeId = "";
}

/* KIỂM TRA CA ĐANG MỞ */
async function kiemTraCheckOut() {

  const employeeId =
    $("checkoutEmployeeId").value.trim();

  if (!employeeId) {
    return showMessage("Vui lòng nhập mã nhân viên.");
  }

  checkoutEmpty("Đang kiểm tra ca làm việc...");

  setBusy(
    "checkoutLookupBtn",
    true,
    '<i class="bi bi-hourglass-split"></i> ĐANG KIỂM TRA...'
  );

  try {

    const result = requireSuccess(
      await apiGet("getCheckInInfo", { employeeId })
    );

    const emp = result.employee || {};

    checkoutEmployeeId = employeeId;
    checkoutReady = true;

    $("checkoutInfo").innerHTML = `
      <div class="mb-3">
        <b>Họ và tên:</b>
        ${esc(emp.name || "-")}
      </div>

      <div class="mb-3">
        <b>Mã nhân viên:</b>
        ${esc(emp.id || employeeId)}
      </div>

      <div class="mb-3">
        <b>Điểm làm việc:</b>
        ${esc(result.workPoint || emp.workPoint || "-")}
      </div>

      <div class="mb-3">
        <b>Ca làm việc:</b>
        ${esc(result.shift || "-")}
      </div>

      <div class="mb-3">
        <b>Giờ Check In:</b>
        ${esc(result.checkIn || "-")}
      </div>
    `;

    $("checkOutBtn").classList.remove("hidden");

    setText(
      "checkoutStatus",
      "Đã tìm thấy ca làm việc đang mở."
    );

  } catch (err) {

    checkoutEmpty(
      err.message || "Không tìm thấy ca làm việc cần Check Out."
    );

    setText(
      "checkoutStatus",
      err.message || "Không tìm thấy ca làm việc."
    );

    showMessage(
      err.message || "Không tìm thấy ca làm việc cần Check Out."
    );

  } finally {

    setBusy("checkoutLookupBtn", false);
  }
}

/* CHECK OUT */
async function checkOut() {

  if (!checkoutReady || !checkoutEmployeeId) {
    return showMessage(
      "Vui lòng kiểm tra ca làm trước khi Check Out."
    );
  }

  if (!confirm(
    "Xác nhận CHECK OUT cho mã nhân viên " +
    checkoutEmployeeId + "?"
  )) {
    return;
  }

  setBusy(
    "checkOutBtn",
    true,
    '<i class="bi bi-hourglass-split"></i> ĐANG GHI NHẬN...'
  );

  try {

    const result = requireSuccess(
      await apiPost("checkOut", {
        employeeId: checkoutEmployeeId
      })
    );

    showMessage(
      result.message ||
      "Check Out thành công!" +
      (result.totalText
        ? "\nTổng thời gian: " + result.totalText
        : ""),
      "CHECK OUT THÀNH CÔNG"
    );

    $("checkoutEmployeeId").value = "";
    setText("checkoutStatus", "");

    checkoutEmpty();

  } catch (err) {

    showMessage(
      err.message || "Check Out chưa thành công."
    );

  } finally {

    setBusy("checkOutBtn", false);
  }
}

/* KHỞI TẠO */
document.addEventListener("DOMContentLoaded", () => {

  checkoutEmpty();

  $("employeeId").addEventListener("keydown", e => {
    if (e.key === "Enter") lookupEmployee();
  });

  $("checkoutEmployeeId").addEventListener("keydown", e => {
    if (e.key === "Enter") kiemTraCheckOut();
  });

});
