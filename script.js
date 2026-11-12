
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


/* GPS: LẤY TỌA ĐỘ VÀ HƯỚNG DẪN CẤP QUYỀN */
let pendingGPSRetry = null;

function getCurrentGPS() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      const err = new Error(
        "Trang web chưa chạy trên kết nối bảo mật HTTPS nên không thể lấy GPS."
      );
      err.isGPS = true;
      err.gpsType = "insecure";
      reject(err);
      return;
    }

    if (!navigator.geolocation) {
      const err = new Error(
        "Trình duyệt này không hỗ trợ lấy vị trí GPS."
      );
      err.isGPS = true;
      err.gpsType = "unsupported";
      reject(err);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => {
        const err = new Error(
          error.code === 1
            ? "Trình duyệt chưa được cấp quyền truy cập vị trí."
            : error.code === 2
              ? "Thiết bị chưa xác định được vị trí. Vui lòng bật Dịch vụ vị trí (Location) và thử lại."
              : "Lấy vị trí GPS quá thời gian. Vui lòng kiểm tra kết nối và thử lại."
        );
        err.isGPS = true;
        err.gpsType =
          error.code === 1 ? "denied" :
          error.code === 2 ? "unavailable" : "timeout";
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  });
}

function showGPSHelp(error, retryAction) {
  document.getElementById("gpsHelpModal")?.remove();
  pendingGPSRetry = retryAction || null;

  const type = error?.gpsType || "unavailable";
  let steps;

  if (type === "insecure") {
    steps = [
      "Mở ứng dụng bằng đường dẫn HTTPS của GHN Attendance.",
      "Không sử dụng đường dẫn HTTP hoặc bản xem trước file trên máy."
    ];
  } else if (type === "denied") {
    steps = [
      "Trên máy tính: bấm biểu tượng ổ khóa bên trái thanh địa chỉ.",
      "Mở Cài đặt trang web → Vị trí (Location) → chọn Cho phép (Allow).",
      "Trên iPhone: vào Cài đặt → Quyền riêng tư & Bảo mật → Dịch vụ định vị; bật định vị và cho phép Safari truy cập vị trí.",
      "Quay lại trang chấm công rồi bấm THỬ LẠI GPS."
    ];
  } else if (type === "timeout") {
    steps = [
      "Kiểm tra thiết bị đã bật Dịch vụ vị trí (Location) chưa.",
      "Đảm bảo trình duyệt được phép truy cập vị trí.",
      "Thử di chuyển đến nơi thoáng hơn hoặc kiểm tra kết nối mạng rồi thử lại."
    ];
  } else {
    steps = [
      "Kiểm tra thiết bị đã bật Dịch vụ vị trí (Location) chưa.",
      "Trên máy tính: bấm ổ khóa cạnh địa chỉ website → Cài đặt trang web → Vị trí → Cho phép.",
      "Trên iPhone: bật Dịch vụ định vị và cấp quyền vị trí cho Safari hoặc trình duyệt đang sử dụng.",
      "Quay lại trang chấm công rồi bấm THỬ LẠI GPS."
    ];
  }

  const modal = document.createElement("div");
  modal.id = "gpsHelpModal";
  modal.style.cssText = [
    "position:fixed", "inset:0", "z-index:1000000",
    "background:rgba(0,0,0,.78)", "display:flex",
    "align-items:center", "justify-content:center",
    "padding:18px", "box-sizing:border-box"
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "width:100%", "max-width:480px", "max-height:90vh",
    "overflow:auto", "box-sizing:border-box",
    "background:#0b1f26", "border:1px solid #00d2d3",
    "border-radius:18px", "padding:24px",
    "color:#fff", "font-family:inherit"
  ].join(";");

  const heading = document.createElement("h3");
  heading.textContent = "CẦN BẬT ĐỊNH VỊ GPS";
  heading.style.cssText =
    "margin:0 0 12px;color:#00d2d3;text-align:center;font-weight:800";

  const description = document.createElement("p");
  description.textContent = error?.message ||
    "Ứng dụng chưa lấy được vị trí của bạn.";
  description.style.cssText =
    "text-align:center;line-height:1.6;margin:0 0 14px";

  const list = document.createElement("ol");
  list.style.cssText = "padding-left:22px;line-height:1.6;margin:0";
  steps.forEach(step => {
    const item = document.createElement("li");
    item.textContent = step;
    item.style.marginBottom = "8px";
    list.appendChild(item);
  });

  const note = document.createElement("p");
  note.textContent =
    "Lưu ý: website không thể tự bật quyền định vị hoặc tự mở cài đặt thiết bị. Bạn cần cấp quyền, sau đó quay lại bấm thử lại.";
  note.style.cssText =
    "font-size:13px;color:#b8c9d6;line-height:1.5;margin:16px 0 0";

  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;gap:10px;margin-top:20px;flex-wrap:wrap";

  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "THỬ LẠI GPS";
  retry.style.cssText =
    "flex:1;min-width:130px;padding:12px;border:0;border-radius:10px;background:#00d2d3;color:#001b20;font-weight:800;cursor:pointer";
  retry.addEventListener("click", () => {
    const action = pendingGPSRetry;
    pendingGPSRetry = null;
    modal.remove();
    if (typeof action === "function") action();
  });

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "ĐÓNG";
  close.style.cssText =
    "flex:1;min-width:100px;padding:12px;border:1px solid #00d2d3;border-radius:10px;background:transparent;color:#fff;font-weight:700;cursor:pointer";
  close.addEventListener("click", () => {
    pendingGPSRetry = null;
    modal.remove();
  });

  actions.append(retry, close);
  card.append(heading, description, list, note, actions);
  modal.appendChild(card);
  document.body.appendChild(modal);
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
async function checkIn(isGPSRetry = false) {

  if (!currentEmployee) {
    return showMessage("Vui lòng tra cứu nhân viên trước.");
  }

  const shift = $("shiftSelect").value;

  if (!shift) {
    return showMessage("Vui lòng chọn ca làm việc.");
  }

  if (!isGPSRetry && !confirm(
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

    const gps = await getCurrentGPS();

    const result = requireSuccess(
      await apiPost("checkIn", {
        employeeId: currentEmployee.id,
        shift: shift,
        latitude: gps.latitude,
        longitude: gps.longitude
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

    if (err.isGPS) {
      showGPSHelp(err, () => checkIn(true));
    } else {
      showMessage(
        err.message || "Check In chưa thành công."
      );
    }

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
async function checkOut(isGPSRetry = false) {

  if (!checkoutReady || !checkoutEmployeeId) {
    return showMessage(
      "Vui lòng kiểm tra ca làm trước khi Check Out."
    );
  }

  if (!isGPSRetry && !confirm(
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

    const gps = await getCurrentGPS();

    const result = requireSuccess(
      await apiPost("checkOut", {
        employeeId: checkoutEmployeeId,
        latitude: gps.latitude,
        longitude: gps.longitude
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

    if (err.isGPS) {
      showGPSHelp(err, () => checkOut(true));
    } else {
      showMessage(
        err.message || "Check Out chưa thành công."
      );
    }

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
