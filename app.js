const sb = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_KEY
);

const $ = x => document.querySelector(x);
const $$ = x => document.querySelectorAll(x);

let orders = [];
let boosters = [];

const money = n =>
  new Intl.NumberFormat("vi-VN").format(n || 0) + "đ";

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));

const cls = s =>
  s === "Đang cày" ? "doing" :
  s === "Hoàn thành" ? "done" :
  s === "Đã hủy" ? "cancel" :
  "wait";


/* ================= LOAD ================= */

async function load(){

  const a = await sb
    .from("orders")
    .select("*")
    .order("created_at", {ascending:false});

  const b = await sb
    .from("boosters")
    .select("*")
    .order("created_at", {ascending:false});

  if(a.error || b.error){
    alert((a.error || b.error).message);
    return;
  }

  orders = a.data || [];
  boosters = b.data || [];

  render();
}


/* ================= RENDER ================= */

function render(){

  const q = ($("#search")?.value || "").toLowerCase();
  const f = $("#filter")?.value || "";

  const os = orders.filter(o =>
    (!q ||
      `${o.id} ${o.customer} ${o.game} ${o.service}`
      .toLowerCase()
      .includes(q)
    ) &&
    (!f || o.status === f)
  );


  /* DASHBOARD */

  $("#total").textContent = orders.length;

  $("#doing").textContent =
    orders.filter(x => x.status === "Đang cày").length;

  $("#done").textContent =
    orders.filter(x => x.status === "Hoàn thành").length;

  $("#money").textContent =
    money(
      orders
        .filter(x => x.status === "Hoàn thành")
        .reduce((a,x) => a + Number(x.price || 0), 0)
    );


  /* ĐƠN GẦN ĐÂY */

  $("#recent").innerHTML =
    orders.slice(0,6).map(o => `
      <p>
        <b>${esc(o.customer)}</b>
        · ${esc(o.game)}
        · ${money(o.price)}
        <span class="badge ${cls(o.status)}">
          ${esc(o.status)}
        </span>
      </p>
    `).join("") || "Chưa có đơn";


  /* BẢNG ĐƠN */

  $("#rows").innerHTML =
    os.map(o => `

      <tr>

        <td>${esc(o.id.slice(0,8))}</td>

        <td>${esc(o.customer)}</td>

        <td>${esc(o.game)}</td>

        <td>${esc(o.service)}</td>

        <td>${money(o.price)}</td>

        <td>
          <span class="badge ${cls(o.status)}">
            ${esc(o.status)}
          </span>
        </td>

        <td>
          ${esc(o.booster || "—")}
        </td>

        <td>

          <button onclick="viewGameAccount('${o.id}')">
            👁 Tài khoản
          </button>

          <button onclick="editOrder('${o.id}')">
            Sửa
          </button>

          <button onclick="delOrder('${o.id}')">
            Xóa
          </button>

        </td>

      </tr>

    `).join("");


  /* KHÁCH HÀNG */

  let c = {};

  orders.forEach(o => {

    c[o.customer] ??= {
      contact:o.contact,
      count:0,
      total:0
    };

    c[o.customer].count++;

    c[o.customer].total += Number(o.price || 0);

  });


  $("#customersRows").innerHTML =
    Object.entries(c).map(([n,v]) => `

      <tr>

        <td>${esc(n)}</td>

        <td>${esc(v.contact)}</td>

        <td>${v.count}</td>

        <td>${money(v.total)}</td>

      </tr>

    `).join("");


  /* BOOSTERS */

  $("#boostersGrid").innerHTML =
    boosters.map(b => `

      <div class="person">

        <h3>🎮 ${esc(b.name)}</h3>

        <p>${esc(b.game)}</p>

        <p>${esc(b.contact)}</p>

        <small>
          ● ${b.online ? "Online" : "Offline"}
        </small>

      </div>

    `).join("");

}


/* ================= XEM TÀI KHOẢN GAME ================= */

window.viewGameAccount = id => {

  const o = orders.find(x => x.id === id);

  if(!o){
    alert("Không tìm thấy đơn.");
    return;
  }

  const username = o.game_username || "Chưa có";
  const password = o.game_password || "Chưa có";

  alert(
`🎮 THÔNG TIN TÀI KHOẢN

Game: ${o.game || ""}
Dịch vụ: ${o.service || ""}

👤 Tài khoản:
${username}

🔑 Mật khẩu:
${password}`
  );

};


/* ================= ORDER ================= */

function openOrder(o){

  $("#oid").value = o?.id || "";

  [
    "customer",
    "contact",
    "game",
    "service",
    "price",
    "booster",
    "status",
    "note"
  ].forEach(k => {

    $("#" + k).value =
      o?.[k] ??
      (k === "status" ? "Chờ xử lý" : "");

  });

  $("#modal").classList.add("show");
}


$("#add").onclick = () => openOrder();

$("#close").onclick = () =>
  $("#modal").classList.remove("show");


/* ================= LOGIN ================= */

$("#loginForm").onsubmit = async e => {

  e.preventDefault();

  $("#loginMsg").textContent =
    "Đang đăng nhập...";

  const email =
    $("#email").value.trim();

  const password =
    $("#password").value;

  const { error } =
    await sb.auth.signInWithPassword({
      email,
      password
    });

  if(error){

    $("#loginMsg").textContent =
      error.message;

  }

};


/* ================= SESSION ================= */

sb.auth.onAuthStateChange(
  (_event, session) => {

    if(session){

      $("#login").classList.add("hidden");

      $("#app").classList.remove("hidden");

      load();

    }else{

      $("#login").classList.remove("hidden");

      $("#app").classList.add("hidden");

    }

  }
);


/* ================= LOGOUT ================= */

$("#logout").onclick = () =>
  sb.auth.signOut({
    scope:"local"
  });


/* ================= NAV ================= */

$$(".nav").forEach(n => {

  n.onclick = () => {

    $$(".nav").forEach(x =>
      x.classList.remove("active")
    );

    n.classList.add("active");

    $$(".page").forEach(x =>
      x.classList.remove("active")
    );

    $("#" + n.dataset.page)
      .classList.add("active");

    $("#title").textContent =
      n.textContent.replace(/^\S+\s/, "");

  };

});


/* ================= SEARCH ================= */

$("#search").oninput = render;

$("#filter").onchange = render;


/* ================= SAVE ORDER ================= */

$("#orderForm").onsubmit = async e => {

  e.preventDefault();

  const o = {

    customer:$("#customer").value,

    contact:$("#contact").value,

    game:$("#game").value,

    service:$("#service").value,

    price:Number($("#price").value),

    booster:$("#booster").value,

    status:$("#status").value,

    note:$("#note").value

  };

  const oid = $("#oid").value;

  const r = oid

    ? await sb
        .from("orders")
        .update(o)
        .eq("id",oid)

    : await sb
        .from("orders")
        .insert(o);


  if(r.error){

    alert(r.error.message);
    return;

  }

  $("#modal")
    .classList.remove("show");

  load();

};


window.editOrder = id =>
  openOrder(
    orders.find(x => x.id === id)
  );


/* ================= DELETE ================= */

window.delOrder = async id => {

  if(!confirm("Xóa đơn này?"))
    return;

  const r =
    await sb
      .from("orders")
      .delete()
      .eq("id",id);

  if(r.error){

    alert(r.error.message);
    return;

  }

  load();

};


/* ================= BOOSTER ================= */

$("#addBooster").onclick = () =>
  $("#bmodal").classList.add("show");

$("#bclose").onclick = () =>
  $("#bmodal").classList.remove("show");


$("#boosterForm").onsubmit = async e => {

  e.preventDefault();

  const r =
    await sb
      .from("boosters")
      .insert({

        name:$("#bn").value,

        game:$("#bg").value,

        contact:$("#bc").value

      });


  if(r.error){

    alert(r.error.message);
    return;

  }

  $("#bmodal")
    .classList.remove("show");

  e.target.reset();

  load();

};
